"""Give a person a sign-in for the web app, or reset theirs, from the command line.

    .venv/bin/python scripts/set_login.py --tenant al-noor --email amina@alnoor.sa \
        --name "Amina Al-Harbi" --role administrator

This is how an operator gets its first administrator; after that, administrators
add the rest of their staff on the Staff screen. A password is made up and
printed once; it must be changed at the first sign in.
"""
from __future__ import annotations

import argparse
import pathlib
import secrets
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "api"))

from duyuf.core.auth import ROLE_SCOPES, hash_password  # noqa: E402
from duyuf.core.db import owner_session  # noqa: E402


def set_login(tenant: str, email: str, name: str, role: str, password: str | None = None,
              must_change: bool = True) -> str:
    """Create the person if needed, give them this password (or a new one), return it."""
    email = email.strip().lower()
    if role not in ROLE_SCOPES:
        raise SystemExit(f"no role {role!r}; one of {', '.join(ROLE_SCOPES)}")
    password = password or secrets.token_urlsafe(12)
    with owner_session() as conn:
        t = conn.execute("SELECT id FROM tenant WHERE slug = %s", (tenant,)).fetchone()
        if not t:
            raise SystemExit(f"no operator {tenant!r}; run provision.py first")
        other = conn.execute("SELECT t.slug FROM principal p JOIN tenant t ON t.id = p.tenant_id "
                             "WHERE p.email = %s AND p.tenant_id <> %s", (email, t["id"])).fetchone()
        if other:
            raise SystemExit(f"{email} already signs in to {other['slug']}; one email, one operator")
        conn.execute(
            """INSERT INTO principal (tenant_id, external_id, display_name, role, email, password_hash,
                                      must_change_password)
               VALUES (%(t)s, %(email)s, %(name)s, %(role)s, %(email)s, %(hash)s, %(must)s)
               ON CONFLICT (tenant_id, external_id) DO UPDATE
                  SET display_name = EXCLUDED.display_name, role = EXCLUDED.role, email = EXCLUDED.email,
                      password_hash = EXCLUDED.password_hash, must_change_password = EXCLUDED.must_change_password,
                      disabled_at = NULL, sessions_valid_from = now()""",
            {"t": t["id"], "email": email, "name": name, "role": role, "hash": hash_password(password),
             "must": must_change})
    return password


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tenant", required=True)
    ap.add_argument("--email", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--role", default="administrator", choices=sorted(ROLE_SCOPES))
    a = ap.parse_args()
    pw = set_login(a.tenant, a.email, a.name, a.role)
    print(f"{a.email} can sign in to {a.tenant} as {a.role}.")
    print(f"Password (shown once, to be changed at first sign in): {pw}")


if __name__ == "__main__":
    main()
