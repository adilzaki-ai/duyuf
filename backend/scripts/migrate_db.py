"""Apply db/migrations/*.sql in order, each once, each in its own transaction.

    .venv/bin/python scripts/migrate_db.py            apply what is new
    .venv/bin/python scripts/migrate_db.py --status   list applied and pending
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys

import psycopg

HERE = pathlib.Path(__file__).resolve().parent.parent
DSN = os.environ.get("DUYUF_DSN", "host=/tmp port=5432 user=duyuf dbname=duyuf_dev")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()

    files = sorted((HERE / "db" / "migrations").glob("*.sql"))
    with psycopg.connect(DSN) as conn:
        conn.execute("CREATE SCHEMA IF NOT EXISTS duyuf")
        conn.execute("""CREATE TABLE IF NOT EXISTS duyuf.schema_migration (
                            name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())""")
        conn.commit()
        done = {r[0] for r in conn.execute("SELECT name FROM duyuf.schema_migration")}
        pending = [f for f in files if f.name not in done]
        if args.status:
            for f in files:
                print(("applied  " if f.name in done else "pending  ") + f.name)
            return 0
        for f in pending:
            try:
                conn.execute(f.read_text())
                conn.execute("INSERT INTO duyuf.schema_migration (name) VALUES (%s)", (f.name,))
                conn.commit()
            except Exception as exc:
                conn.rollback()
                print(f"FAILED {f.name}: {exc}", file=sys.stderr)
                return 1
            print(f"applied {f.name}")
    print("up to date" if not pending else f"{len(pending)} applied")
    return 0


if __name__ == "__main__":
    sys.exit(main())
