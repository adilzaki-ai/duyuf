"""Issue an API key for one person at one operator. The key is printed once.

    .venv/bin/python scripts/issue_key.py --tenant duyuf-demo --name "local web" \
        --principal admin --expires-days 30

--principal names an existing person (external id); with --role as well, the
person is created if missing. Put the key in frontend/.env.local as
VITE_DUYUF_API_KEY.
"""
from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "api"))

from duyuf.core.auth import ROLE_SCOPES, hash_key, new_key  # noqa: E402
from duyuf.core.db import owner_session  # noqa: E402


def issue(tenant: str, name: str, principal: str = "admin", role: str | None = None,
          display_name: str | None = None, expires_days: int | None = 30) -> str:
    with owner_session() as conn:
        t = conn.execute("SELECT id FROM tenant WHERE slug = %s", (tenant,)).fetchone()
        if not t:
            raise SystemExit(f"no operator {tenant!r}; run provision.py first")
        p = conn.execute("SELECT id FROM principal WHERE tenant_id = %s AND external_id = %s",
                         (t["id"], principal)).fetchone()
        if not p:
            if not role:
                raise SystemExit(f"no person {principal!r} at {tenant}; pass --role to create them")
            if role not in ROLE_SCOPES:
                raise SystemExit(f"no role {role!r}; one of {', '.join(ROLE_SCOPES)}")
            p = conn.execute("INSERT INTO principal (tenant_id, external_id, display_name, role) "
                             "VALUES (%s, %s, %s, %s) RETURNING id",
                             (t["id"], principal, display_name or principal, role)).fetchone()
        key = new_key()
        conn.execute(
            """INSERT INTO api_key (tenant_id, principal_id, name, prefix, key_hash, expires_at)
               VALUES (%s, %s, %s, %s, %s,
                       CASE WHEN %s::int IS NULL THEN NULL ELSE now() + make_interval(days => %s::int) END)""",
            (t["id"], p["id"], name, key[:8], hash_key(key), expires_days, expires_days))
    return key


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tenant", required=True)
    ap.add_argument("--name", required=True, help="what the key is for")
    ap.add_argument("--principal", default="admin")
    ap.add_argument("--role", choices=sorted(ROLE_SCOPES))
    ap.add_argument("--display-name")
    ap.add_argument("--expires-days", type=int, default=30)
    a = ap.parse_args()
    print(issue(a.tenant, a.name, a.principal, a.role, a.display_name, a.expires_days))


if __name__ == "__main__":
    main()
