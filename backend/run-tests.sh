#!/usr/bin/env bash
# The backend tests, against a database rebuilt from the migrations on every
# run (duyuf_test) — never against duyuf_dev, whose demo the tests would litter.
#
#   ./run-tests.sh                  everything
#   ./run-tests.sh -k journey       pytest arguments pass through
set -euo pipefail
cd "$(dirname "$0")"

PGBIN=/Applications/Postgres.app/Contents/Versions/16/bin
[ -d "$PGBIN" ] && PATH="$PGBIN:$PATH"

dropdb --if-exists -h /tmp -U duyuf duyuf_test
createdb -h /tmp -U duyuf -O duyuf duyuf_test

export DUYUF_DSN="host=/tmp port=5432 user=duyuf dbname=duyuf_test"
.venv/bin/python scripts/migrate_db.py >/dev/null
exec .venv/bin/python -m pytest -q tests "$@"
