"""Create an operator (a Hajj/Umrah service company) and its first administrator.

    .venv/bin/python scripts/provision.py --slug al-noor --name "Al Noor Travel" --name-ar "النور للسفر"
    .venv/bin/python scripts/provision.py --slug duyuf-demo --name "Duyuf (demonstration)" --demo

Running it again for an existing slug changes nothing and says so. Whether an
operator is a demonstration is fixed here, at creation, for good.
"""
from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "api"))

from duyuf.core.db import owner_session  # noqa: E402


def provision(slug: str, name: str, name_ar: str | None = None, demo: bool = False) -> str:
    with owner_session() as conn:
        row = conn.execute("SELECT id::text, is_demo FROM tenant WHERE slug = %s", (slug,)).fetchone()
        if row:
            if row["is_demo"] != demo:
                raise SystemExit(f"{slug} exists and is {'a' if row['is_demo'] else 'not a'} demonstration; "
                                 "that cannot be changed")
            print(f"{slug} already exists ({row['id']})")
            return row["id"]
        tid = conn.execute("INSERT INTO tenant (slug, name, name_ar, is_demo) VALUES (%s, %s, %s, %s) "
                           "RETURNING id::text", (slug, name, name_ar, demo)).fetchone()["id"]
        conn.execute("INSERT INTO principal (tenant_id, external_id, display_name, role) "
                     "VALUES (%s, 'admin', 'Administrator', 'administrator')", (tid,))
    print(f"created {slug} ({tid}){' — demonstration' if demo else ''}")
    return tid


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--name-ar")
    ap.add_argument("--demo", action="store_true")
    a = ap.parse_args()
    provision(a.slug, a.name, a.name_ar, a.demo)


if __name__ == "__main__":
    main()
