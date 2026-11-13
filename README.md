# Duyuf — ضيوف

Operations for Hajj and Umrah service companies in Saudi Arabia: pilgrim
groups, the pilgrims in them, and where each one is on the journey —
registered, visa issued, arrived, in Makkah, in Madinah, departed — plus an
arrivals board: the flights landing in the next 48 hours, and what each one's
pilgrims will need at the gate.

Built the way Sky Logics is built: a FastAPI + Postgres backend that keeps every
operator's data apart with row-level security, and a React web app that talks
to it — or, with no backend, shows a built-in sample.

```
backend/    FastAPI (api/duyuf), SQL migrations (db/migrations), scripts, tests
frontend/   Vite + React + TypeScript, English and Arabic (right-to-left)
sample/     demo.json — the invented operator both halves show
```

## Run it on this Mac

```bash
# backend → http://localhost:8100/docs  (starts Postgres.app if needed, applies migrations)
cd backend && ./run-backend.sh

# web app → http://localhost:5180
cd frontend && npm run dev
```

It runs beside Sky Logics (5173 / 8000) without clashing.

The web app signs in with the key in `frontend/.env.local` (not committed). For
a new one:

```bash
cd backend
.venv/bin/python scripts/issue_key.py --tenant duyuf-demo --name "local web" --expires-days 90
```

With no backend running, the web app falls back to the sample and says so in a
banner. `VITE_DATA_SOURCE=mock` forces the sample.

## The demo operator

`duyuf-demo` holds 16 invented groups, 524 invented pilgrims and 7 flights,
with dates counted from today so a group always lands this week and flights
always land in the next two days. Reload it before showing
it:

```bash
cd backend && .venv/bin/python scripts/seed_demo.py --reset
```

It refuses any operator that is not a demonstration. To change the sample,
edit `backend/scripts/make_demo_sample.py`, run it, and reload: the database and
the web app's sample mode then show the same thing.

## A real operator

```bash
cd backend
.venv/bin/python scripts/provision.py --slug al-noor --name "Al Noor Travel" --name-ar "النور للسفر"
.venv/bin/python scripts/issue_key.py --tenant al-noor --name "office" --principal admin
```

Roles: administrator, supervisor, staff, viewer. Staff and viewers see only the
last four characters of a passport and no birth date (Saudi PDPL).
Administrators and supervisors plan flights; staff can mark a flight landed,
which moves everyone on it who has a visa to "arrived".

## The arrivals board

Each flight gets a brief before it lands: pilgrims, over 75 on the day,
wheelchairs, medical, no visa yet, buses (49 seats each) and interpreters (one
per 40 speakers of a language other than Arabic or English). The rules live in
`backend/api/duyuf/arrivals/brief.py`; change them there and in
`frontend/src/domain/brief.ts` — a frontend test reads the Python file.

**Resources and gaps.** Shifts record what is at each airport and when
(wheelchairs, buses, interpreters by language; *Arrivals → Resources*). The
board sets need against them block by block: each flight holds what its brief
asks for through the 3-hour block it lands in, and a shift counts for a block
it covers whole. **What if…** tries delays and extra resources against the
board without saving anything. Rule: `arrivals/plan.py` ↔ `domain/plan.ts`,
tested on the same case on both sides.

## Tests

```bash
cd backend && ./run-tests.sh               # against duyuf_test, rebuilt every run
cd frontend && npx tsc -b && npx vitest run
```
