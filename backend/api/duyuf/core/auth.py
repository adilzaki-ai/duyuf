"""Who is calling, and what they may do.

A caller presents `Authorization: Bearer dyf_…`, an API key from
scripts/issue_key.py. Only its SHA-256 is stored, so the database never holds
a working key.

With DUYUF_DEV_AUTH=1 (tests, curl on this Mac) `X-Duyuf-Tenant: <slug>` is
accepted instead, as that operator's administrator. Off by default: with it
on, anyone who reaches the port is trusted.
"""
from __future__ import annotations

import hashlib
import os
import secrets
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request

from .db import owner_session

KEY_PREFIX = "dyf_"

# What each role may do. Routes ask for a scope, never a role, so a role can
# be widened here without touching a route.
ROLE_SCOPES: dict[str, frozenset[str]] = {
    "administrator": frozenset({"group:read", "group:write", "pilgrim:read",
                                "pilgrim:write", "pilgrim:status", "pilgrim:identity"}),
    "supervisor": frozenset({"group:read", "group:write", "pilgrim:read",
                             "pilgrim:write", "pilgrim:status", "pilgrim:identity"}),
    "staff": frozenset({"group:read", "pilgrim:read", "pilgrim:status"}),
    "viewer": frozenset({"group:read", "pilgrim:read"}),
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

    @property
    def scopes(self) -> frozenset[str]:
        return ROLE_SCOPES.get(self.role, frozenset())

    def can(self, scope: str) -> bool:
        return scope in self.scopes


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def new_key() -> str:
    return KEY_PREFIX + secrets.token_urlsafe(32)


def dev_auth_enabled() -> bool:
    return os.environ.get("DUYUF_DEV_AUTH", "0") == "1"


_TENANT_COLS = ("t.id::text AS tenant_id, t.slug AS tenant_slug, t.name AS tenant_name, "
                "t.name_ar AS tenant_name_ar, t.is_demo")


def _by_key(key: str) -> Identity | None:
    with owner_session() as conn:
        row = conn.execute(
            f"""SELECT {_TENANT_COLS}, p.id::text AS principal_id, p.display_name, p.role
                  FROM api_key k
                  JOIN tenant t ON t.id = k.tenant_id
                  JOIN principal p ON p.id = k.principal_id
                 WHERE k.key_hash = %s AND k.revoked_at IS NULL
                   AND (k.expires_at IS NULL OR k.expires_at > now())""",
            (hash_key(key),)).fetchone()
    return Identity(**row) if row else None


def _by_dev_header(slug: str) -> Identity | None:
    with owner_session() as conn:
        row = conn.execute(f"SELECT {_TENANT_COLS} FROM tenant t WHERE t.slug = %s",
                           (slug,)).fetchone()
    if not row:
        return None
    return Identity(**row, principal_id=None, display_name="developer", role="administrator")


def identity(request: Request) -> Identity:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        who = _by_key(auth[7:].strip())
        if who is None:
            raise HTTPException(401, "this key is not recognised, has expired or was revoked")
        return who
    slug = request.headers.get("x-duyuf-tenant")
    if slug and dev_auth_enabled():
        who = _by_dev_header(slug)
        if who is None:
            raise HTTPException(401, f"no operator named {slug!r}")
        return who
    raise HTTPException(401, "sign in first: send an API key as a Bearer token")


def require(scope: str):
    """A dependency: the caller, refused with 403 unless they hold `scope`."""
    def check(who: Identity = Depends(identity)) -> Identity:
        if not who.can(scope):
            raise HTTPException(403, f"your role ({who.role}) may not do this: needs {scope}")
        return who
    return check
