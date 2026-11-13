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

Staff sign in with their own email and password. The demo operator has one
login per role, all with the password `duyuf-demo-1448` (invented people,
demonstration operators only; set `DUYUF_DEMO_PASSWORD` to change it):

| Email | Role |
|---|---|
| amina@duyuf.demo | administrator |
| omar@duyuf.demo | supervisor |
| desk@duyuf.demo | desk staff |
| viewer@duyuf.demo | viewer |

To sign in on this Mac, leave `VITE_DUYUF_API_KEY` empty in
`frontend/.env.local` and restart `npm run dev`. With a key there, the web app
skips sign in and acts as that key's person (handy for development).

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
.venv/bin/python scripts/set_login.py --tenant al-noor --email amina@alnoor.sa --name "Amina Al-Harbi"
```

`set_login.py` gives the operator its first administrator and prints a
password once, to be changed at first sign in. That administrator adds the rest
of the staff on the *Staff* screen. API keys (`issue_key.py`) remain for
integrations.

Sessions are an HttpOnly cookie for 12 hours (`DUYUF_SESSION_HOURS`); set
`DUYUF_COOKIE_SECURE=1` behind HTTPS. Five wrong passwords in 15 minutes lock
that email for the rest of the 15 minutes. Switching someone off, or resetting
their password, signs them out everywhere.

Roles: administrator, supervisor, staff, viewer. Staff and viewers see only the
last four characters of a passport and no birth date (Saudi PDPL).
Administrators and supervisors plan flights; staff can mark a flight landed,
which moves everyone on it who has a visa to "arrived".

## Adding pilgrims

Groups and pilgrims are added and edited in the web app (*Groups → New group*;
on a group, *Add pilgrim* or *Import from CSV*). The import takes a CSV with
these columns, and offers a template:

```
full_name, full_name_ar, gender, date_of_birth, nationality, passport_no, phone, language, needs
```

It is all or nothing: the platform checks every row first and lists each
problem by row and column; one bad row and nothing is saved. Passport, birth
date and nationality are fixed once a pilgrim is registered.

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

## Incidents

Something has happened to a pilgrim or a group (SOS, lost, medical, heat,
transport): anyone on staff raises it (*Incidents → Report incident*, or from a
pilgrim's panel), gives it to a team, and resolves it; viewers follow along.
The queue puts what is still waiting first, urgent before high, longest waiting
first, and counts the median time to a team and to resolution over the last
seven days. Every step is kept with who took it and when; nothing is deleted.
Moves: `incidents/flow.py` ↔ `domain/incidents.ts`, pinned by a test.

## The AI analyst

Staff ask questions in Arabic or English (*Analyst*) and get answers from the
operator's live totals, with a chart where it helps and the data each answer
came from. It runs Claude Opus 5.5 from the backend, with refusals retried on
Anthropic's recommended fallback model.

**It sees totals only.** Its tools return counts and operational facts: no
pilgrim names, passports, birth dates or phones, no leader names or phones,
no incident descriptions. A test runs every tool over the demo and fails if
any of those appear. Every question, answer and the data behind it is kept
(`analyst_question`). Answers are advice; a person decides.

To turn it on, put the key in `backend/.env.local` (git-ignored; the run
script loads it) and restart the backend:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-…' > backend/.env.local
```

Without a key the screen says so and nothing is sent. Sample mode never sends
questions out.

## Tests

```bash
cd backend && ./run-tests.sh               # against duyuf_test, rebuilt every run
cd frontend && npx tsc -b && npx vitest run
```
