#!/usr/bin/env bash
# Start the Duyuf backend locally (Postgres.app 16 + uvicorn on :8100).
#
# Port 8100, not 8000: Sky Logics uses 8000 on this Mac, and the two can run
# side by side. Same Postgres server, separate database (duyuf_dev) and role.
set -euo pipefail
cd "$(dirname "$0")"

PGBIN="/Applications/Postgres.app/Contents/Versions/16/bin"
PGDATA="$HOME/Library/Application Support/Postgres/var-16"

export DUYUF_DSN="${DUYUF_DSN:-host=/tmp port=5432 user=duyuf dbname=duyuf_dev}"
export DUYUF_TIMEZONE="${DUYUF_TIMEZONE:-Asia/Riyadh}"
# The web app's dev server proxies /v1 here, so CORS is only for a front end
# served from somewhere else. Named origins, never `*`.
export DUYUF_CORS_ORIGINS="${DUYUF_CORS_ORIGINS:-http://localhost:5180,http://127.0.0.1:5180}"
# Header auth (X-Duyuf-Tenant) trusts anyone who reaches the port. Off unless asked:
#   DUYUF_DEV_AUTH=1 ./run-backend.sh
export DUYUF_DEV_AUTH="${DUYUF_DEV_AUTH:-0}"

if ! "$PGBIN/pg_isready" -h /tmp -p 5432 >/dev/null 2>&1; then
  echo "starting postgres…"
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" -o "-p 5432 -k /tmp" -w start
fi

.venv/bin/python scripts/migrate_db.py

# `python -m uvicorn`: a venv's console scripts break when a folder above is renamed.
exec .venv/bin/python -m uvicorn duyuf.main:app --app-dir api --host 127.0.0.1 --port 8100 "$@"
