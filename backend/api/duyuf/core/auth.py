"""Who is calling, and what they may do.

Three ways in for staff and integrations, checked in this order:

1. `Authorization: Bearer dyf_…`: an API key from scripts/issue_key.py, for
   integrations. Only its SHA-256 is stored.
2. The `duyuf_session` cookie: a person on the operator's staff who signed in
   with their email and password (POST /v1/auth/sign-in). HttpOnly, SameSite
   Strict, 12 hours. A request that changes something must also carry
   `X-Duyuf-Client: web`, which another site's page cannot send, so a cookie
   alone can never be used from elsewhere.
3. With DUYUF_DEV_AUTH=1 (tests, curl on this Mac) `X-Duyuf-Tenant: <slug>` is
   accepted, as that operator's administrator. Off by default.

A pilgrim comes in a fourth way, to their own Rafeeq page only: the secret on
their card (`Bearer rfq_…`), checked by `card_holder`. A card opens nothing
else; on any other route it is just an unknown key.

Passwords are scrypt hashes (standard library). The app's database role
cannot read them; checking a password, opening and closing sessions happen
here, as the owner, like resolving a key: before any operator is known.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass, replace
from datetime import timedelta

from fastapi import Depends, HTTPException, Request

from ..rafeeq.help import DAYS_AFTER_DEPARTURE
from .db import owner_session

KEY_PREFIX = "dyf_"
SESSION_PREFIX = "dys_"
CARD_PREFIX = "rfq_"
SESSION_COOKIE = "duyuf_session"
CLIENT_HEADER = "x-duyuf-client"
SESSION_HOURS = float(os.environ.get("DUYUF_SESSION_HOURS", "12") or 12)
MIN_PASSWORD = 10
# Five wrong passwords for one email within this window, and it waits out the window.
LOCKOUT_TRIES = 5
LOCKOUT_WINDOW = timedelta(minutes=15)

# What each role may do. Routes ask for a scope, never a role, so a role can
# be widened here without touching a route.
# Marking a flight landed moves its pilgrims, so it needs pilgrim:status, which
# the desk staff at the airport hold; planning flights needs flight:write.
# Incidents are raised and worked by anyone on staff; viewers only follow them.
# Anyone may ask the analyst: it sees totals only, never a person.
# Only administrators add staff, change roles and reset passwords.
# Anyone working with pilgrims hands out Rafeeq cards; viewers do not.
ROLE_SCOPES: dict[str, frozenset[str]] = {
    "administrator": frozenset({"group:read", "group:write", "pilgrim:read", "pilgrim:write",
                                "pilgrim:status", "pilgrim:identity", "flight:read", "flight:write",
                                "incident:read", "incident:write", "analyst:ask", "staff:manage",
                                "rafeeq:issue"}),
    "supervisor": frozenset({"group:read", "group:write", "pilgrim:read", "pilgrim:write",
                             "pilgrim:status", "pilgrim:identity", "flight:read", "flight:write",
                             "incident:read", "incident:write", "analyst:ask", "rafeeq:issue"}),
    "staff": frozenset({"group:read", "pilgrim:read", "pilgrim:status", "flight:read",
                        "incident:read", "incident:write", "analyst:ask", "rafeeq:issue"}),
    "viewer": frozenset({"group:read", "pilgrim:read", "flight:read", "incident:read", "analyst:ask"}),
}


@dataclass(frozen=True)
class Identity:
    tenant_id: str
    tenant_slug: str
    tenant_name: str
    tenant_name_ar: str | None
    is_demo: bool
    principal_id: str | None
    display_name: str
    role: str
    # how they came in: key, session or dev
    via: str = "key"
    email: str | None = None
    must_change_password: bool = False
    session_id: str | None = None

    @property
    def scopes(self) -> frozenset[str]:
        return ROLE_SCOPES.get(self.role, frozenset())

    def can(self, scope: str) -> bool:
        return scope in self.scopes


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def new_key() -> str:
    return KEY_PREFIX + secrets.token_urlsafe(32)


def new_card_token() -> str:
    # 18 bytes: as hard to guess as a key, short enough for a QR code a cheap phone reads
    return CARD_PREFIX + secrets.token_urlsafe(18)


def dev_auth_enabled() -> bool:
    return os.environ.get("DUYUF_DEV_AUTH", "0") == "1"


# ---- passwords ----

_SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    b64 = lambda b: base64.b64encode(b).decode()
    return f"scrypt${_SCRYPT['n']}${_SCRYPT['r']}${_SCRYPT['p']}${b64(salt)}${b64(digest)}"


def check_password(password: str, stored: str | None) -> bool:
    if not stored:
        # Same work as a real check, so a missing account takes as long as a wrong password.
        hashlib.scrypt(password.encode(), salt=b"duyuf-no-account", dklen=32, **_SCRYPT)
        return False
    try:
        _, n, r, p, salt, digest = stored.split("$")
        got = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), dklen=32,
                             n=int(n), r=int(r), p=int(p))
    except ValueError:
        return False
    return hmac.compare_digest(got, base64.b64decode(digest))


def password_problem(password: str) -> str | None:
    """Why a new password will not do, or None."""
    if len(password) < MIN_PASSWORD:
        return f"a password needs at least {MIN_PASSWORD} characters"
    if len(password) > 200:
        return "a password can be at most 200 characters"
    if len(set(password)) < 4:
        return "a password needs more than a few different characters"
    return None


# ---- who is calling ----

_TENANT_COLS = ("t.id::text AS tenant_id, t.slug AS tenant_slug, t.name AS tenant_name, "
                "t.name_ar AS tenant_name_ar, t.is_demo")
_PERSON_COLS = ("p.id::text AS principal_id, p.display_name, p.role, p.email, p.must_change_password")


def _by_key(key: str) -> Identity | None:
    with owner_session() as conn:
        row = conn.execute(
            f"""SELECT {_TENANT_COLS}, {_PERSON_COLS}
                  FROM api_key k
                  JOIN tenant t ON t.id = k.tenant_id
                  JOIN principal p ON p.id = k.principal_id
                 WHERE k.key_hash = %s AND k.revoked_at IS NULL AND p.disabled_at IS NULL
                   AND (k.expires_at IS NULL OR k.expires_at > now())""",
            (hash_key(key),)).fetchone()
    # A key acts for its person, but a key is not a sign in: no password change is forced on it.
    return Identity(**{**row, "must_change_password": False}, via="key") if row else None


def _by_session(token: str) -> Identity | None:
    with owner_session() as conn:
        row = conn.execute(
            f"""SELECT {_TENANT_COLS}, {_PERSON_COLS}, s.id::text AS session_id,
                       (s.last_seen_at < now() - interval '5 minutes') AS stale
                  FROM staff_session s
                  JOIN tenant t ON t.id = s.tenant_id
                  JOIN principal p ON p.id = s.principal_id
                 WHERE s.token_hash = %s AND s.revoked_at IS NULL AND s.expires_at > now()
                   AND p.disabled_at IS NULL
                   AND s.created_at >= coalesce(p.sessions_valid_from, '-infinity')""",
            (hash_key(token),)).fetchone()
        if row and row.pop("stale"):
            conn.execute("UPDATE staff_session SET last_seen_at = now() WHERE id = %s", (row["session_id"],))
    return Identity(**row, via="session") if row else None


def _by_dev_header(slug: str) -> Identity | None:
    with owner_session() as conn:
        row = conn.execute(f"SELECT {_TENANT_COLS} FROM tenant t WHERE t.slug = %s", (slug,)).fetchone()
    if not row:
        return None
    return Identity(**row, principal_id=None, display_name="developer", role="administrator", via="dev")


_SAFE = {"GET", "HEAD", "OPTIONS"}


def identity(request: Request) -> Identity:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        who = _by_key(auth[7:].strip())
        if who is None:
            raise HTTPException(401, "this key is not recognised, has expired or was revoked")
        return who
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        who = _by_session(token)
        if who is None:
            raise HTTPException(401, "your session has ended; sign in again")
        if request.method not in _SAFE and request.headers.get(CLIENT_HEADER) != "web":
            raise HTTPException(403, "this request did not come from the Duyuf web app")
        return who
    slug = request.headers.get("x-duyuf-tenant")
    if slug and dev_auth_enabled():
        who = _by_dev_header(slug)
        if who is None:
            raise HTTPException(401, f"no operator named {slug!r}")
        return who
    raise HTTPException(401, "sign in first")


def require(scope: str):
    """A dependency: the caller, refused with 403 unless they hold `scope`."""
    def check(who: Identity = Depends(identity)) -> Identity:
        if who.must_change_password:
            raise HTTPException(403, "choose a new password first")
        if not who.can(scope):
            raise HTTPException(403, f"your role ({who.role}) may not do this: needs {scope}")
        return who
    return check


# ---- a pilgrim's Rafeeq card ----

@dataclass(frozen=True)
class CardHolder:
    """A pilgrim holding a Rafeeq card: their own page, and calls for help. Nothing else."""
    tenant_id: str
    card_id: str
    pilgrim_id: str
    language: str
    is_demo: bool


def card_holder(request: Request) -> CardHolder:
    auth = request.headers.get("authorization", "")
    token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    if not token.startswith(CARD_PREFIX):
        raise HTTPException(401, "open Rafeeq from your card")
    with owner_session() as conn:
        row = conn.execute(
            """SELECT c.id::text AS card_id, c.tenant_id::text, c.pilgrim_id::text, c.language, t.is_demo,
                      (c.last_used_at IS NULL OR c.last_used_at < now() - interval '5 minutes') AS stale
                 FROM rafeeq_card c
                 JOIN tenant t ON t.id = c.tenant_id
                 JOIN pilgrim p ON p.id = c.pilgrim_id
                 JOIN pilgrim_group g ON g.id = p.group_id
                WHERE c.token_hash = %s AND c.revoked_at IS NULL
                  AND (g.departure_date IS NULL OR g.departure_date >= current_date - %s)""",
            (hash_key(token), DAYS_AFTER_DEPARTURE)).fetchone()
        if row and row.pop("stale"):
            conn.execute("UPDATE rafeeq_card SET last_used_at = now() WHERE id = %s", (row["card_id"],))
    if row is None:
        raise HTTPException(401, "this card no longer works; ask your group leader for a new one")
    return CardHolder(**row)


# ---- signing in and out ----

class SignInRefused(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def sign_in(email: str, password: str, user_agent: str | None = None) -> tuple[str, Identity]:
    """A new session for this email and password, or SignInRefused. The same
    words for a wrong password and an unknown email, so neither gives away
    who has an account."""
    email = email.strip().lower()
    with owner_session() as conn:
        tries = conn.execute(
            """SELECT count(*)::int AS n FROM signin_attempt
                WHERE email = %s AND NOT ok AND at > now() - %s
                  AND at > coalesce((SELECT max(at) FROM signin_attempt WHERE email = %s AND ok), '-infinity')""",
            (email, LOCKOUT_WINDOW, email)).fetchone()["n"]
        if tries >= LOCKOUT_TRIES:
            raise SignInRefused(429, "too many wrong passwords; wait 15 minutes and try again")
        row = conn.execute(
            f"""SELECT {_TENANT_COLS}, {_PERSON_COLS}, p.password_hash, p.disabled_at
                  FROM principal p JOIN tenant t ON t.id = p.tenant_id WHERE p.email = %s""",
            (email,)).fetchone()
        ok = check_password(password, row["password_hash"] if row else None)
        conn.execute("INSERT INTO signin_attempt (email, ok) VALUES (%s, %s)", (email, ok and not row["disabled_at"]))
    # Refused only after that transaction commits: a failed try must be counted, not rolled back with it.
    if not ok:
        raise SignInRefused(401, "that email and password do not match")
    if row["disabled_at"]:
        raise SignInRefused(403, "this account is switched off; ask your administrator")
    with owner_session() as conn:
        token = SESSION_PREFIX + secrets.token_urlsafe(32)
        sid = conn.execute(
            """INSERT INTO staff_session (tenant_id, principal_id, token_hash, expires_at, user_agent)
               VALUES (%s, %s, %s, now() + make_interval(secs => %s), %s) RETURNING id::text""",
            (row["tenant_id"], row["principal_id"], hash_key(token), SESSION_HOURS * 3600,
             (user_agent or "")[:300] or None)).fetchone()["id"]
        conn.execute("UPDATE principal SET last_signed_in_at = now() WHERE id = %s", (row["principal_id"],))
    row.pop("password_hash")
    row.pop("disabled_at")
    return token, Identity(**row, via="session", session_id=sid)


def sign_out(token: str) -> None:
    with owner_session() as conn:
        conn.execute("UPDATE staff_session SET revoked_at = now() WHERE token_hash = %s AND revoked_at IS NULL",
                     (hash_key(token),))


def change_password(who: Identity, current: str, new: str) -> Identity:
    """Their own password: the current one first. Every other session of theirs ends."""
    if who.via != "session" or not who.principal_id:
        raise SignInRefused(400, "sign in with your email to change your password")
    why = password_problem(new)
    if why:
        raise SignInRefused(422, why)
    with owner_session() as conn:
        stored = conn.execute("SELECT password_hash FROM principal WHERE id = %s",
                              (who.principal_id,)).fetchone()["password_hash"]
        if not check_password(current, stored):
            raise SignInRefused(403, "the current password is not right")
        if check_password(new, stored):
            raise SignInRefused(422, "choose a password different from the current one")
        conn.execute("UPDATE principal SET password_hash = %s, must_change_password = false WHERE id = %s",
                     (hash_password(new), who.principal_id))
        conn.execute("""UPDATE staff_session SET revoked_at = now()
                         WHERE principal_id = %s AND id <> %s AND revoked_at IS NULL""",
                     (who.principal_id, who.session_id))
    return replace(who, must_change_password=False)
