"""Covering gaps from the roster, against the database.

One round (`tick`), run by core/jobs.py every minute for each operator whose
dispatch is not Off, and by a supervisor's "Find people now":

1. Requests past their answer time become `expired`.
2. The gaps within the operator's horizon (the arrivals board's own rule),
   and roster shifts that lost people (declined, expired), are planned with
   planner.plan.
3. Automatic: the people are asked at once (a roster shift and one
   assignment each, with a personal link and the message). Approve: the plan
   waits as the operator's one proposed plan, for a supervisor.
4. Personal links of shifts that are over are cleared.

Everything here runs inside the operator's tenant_session.
"""
from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone

from ..arrivals.brief import KSA, SLOT_HOURS
from ..core.auth import hash_key
from . import planner

WORK_PREFIX = "wk_"
AUTO = "Auto-dispatch"
ROLE_EN = {"interpreter": "interpreter", "wheelchair": "wheelchair helper", "bus": "bus driver"}
ROLE_AR = {"interpreter": "مترجم", "wheelchair": "مساعد كراسي متحركة", "bus": "سائق حافلة"}
LANG_EN = {"ar": "Arabic", "en": "English", "ur": "Urdu", "id": "Indonesian", "ms": "Malay", "tr": "Turkish",
           "fr": "French", "ha": "Hausa", "bn": "Bengali", "fa": "Persian", "hi": "Hindi", "ru": "Russian"}
AIRPORT_EN = {"JED": "Jeddah airport", "MED": "Madinah airport", "TIF": "Taif airport", "RUH": "Riyadh airport"}
AIRPORT_AR = {"JED": "مطار جدة", "MED": "مطار المدينة المنورة", "TIF": "مطار الطائف", "RUH": "مطار الرياض"}


def new_token() -> str:
    return WORK_PREFIX + secrets.token_urlsafe(18)


def settings(conn) -> dict:
    row = conn.execute("SELECT mode, horizon_hours, answer_minutes, updated_by, updated_at FROM dispatch_setting").fetchone()
    return row or {"mode": "approve", "horizon_hours": 24, "answer_minutes": 30, "updated_by": None, "updated_at": None}


def message(operator: str, kind: str, language: str | None, airport: str, start: datetime, end: datetime,
            link: str) -> str:
    """The request as the person reads it, in English and Arabic: who asks, what, where, when, and the link."""
    s, e = start.astimezone(KSA), end.astimezone(KSA)
    what_en = ROLE_EN[kind] + (f" ({LANG_EN.get(language, language)})" if language else "")
    when = f"{s:%a %d %b} {s:%H:%M}–{e:%H:%M}"
    return (f"{operator}: can you work as {what_en} at {AIRPORT_EN.get(airport, airport)}, {when} (Saudi time)? "
            f"Please answer here: {link}\n"
            f"{operator}: هل يمكنك العمل {ROLE_AR[kind]} في {AIRPORT_AR.get(airport, airport)}، "
            f"{s:%d/%m} من {s:%H:%M} إلى {e:%H:%M}؟ أجب هنا: {link}")


def _workers(conn) -> list[dict]:
    return conn.execute(
        """SELECT id::text, name, roles, languages, airports, max_hours_week, active FROM worker""").fetchall()


def _busy_and_hours(conn, now: datetime) -> tuple[dict, dict]:
    rows = conn.execute(
        """SELECT a.worker_id::text AS w, s.starts_at, s.ends_at FROM assignment a
             JOIN resource_shift s ON s.id = a.shift_id
            WHERE a.status = ANY(%s) AND s.ends_at > %s""",
        (list(planner.HOLDING), now - timedelta(days=7))).fetchall()
    busy: dict[str, list] = {}
    hours: dict[str, float] = {}
    for r in rows:
        busy.setdefault(r["w"], []).append((r["starts_at"], r["ends_at"]))
        hours[r["w"]] = hours.get(r["w"], 0) + (r["ends_at"] - r["starts_at"]).total_seconds() / 3600
    return busy, hours


def board_gaps(conn, horizon: int) -> list[dict]:
    """The board's gaps within `horizon` hours, as planner gaps (block start to block end)."""
    from ..routers.arrivals import _board  # the board's own rule; imported late to avoid a cycle
    board = _board(conn, horizon, roster_as_planned=True)
    out = []
    for row in board["load"]:
        for s in row["short"]:
            out.append({"airport": row["airport"], "kind": s["kind"], "language": s["language"],
                        "start": row["start"], "end": row["start"] + timedelta(hours=SLOT_HOURS), "short": s["short"]})
    return out


def lost_people(conn, now: datetime) -> list[dict]:
    """Roster shifts still to come that hold fewer people than they need (someone said no or did not answer)."""
    rows = conn.execute(
        """SELECT s.id::text AS shift_id, s.airport, s.kind, s.language, s.starts_at, s.ends_at, s.quantity,
                  count(a.id) FILTER (WHERE a.status = ANY(%s))::int AS holding,
                  array_agg(a.worker_id::text) FILTER (WHERE a.id IS NOT NULL) AS tried
             FROM resource_shift s LEFT JOIN assignment a ON a.shift_id = s.id
            WHERE s.source = 'roster' AND s.starts_at > %s
            GROUP BY s.id""", (list(planner.HOLDING), now)).fetchall()
    return [{"shift_id": r["shift_id"], "airport": r["airport"], "kind": r["kind"], "language": r["language"],
             "start": r["starts_at"], "end": r["ends_at"], "short": r["quantity"] - r["holding"],
             "exclude": r["tried"] or []}
            for r in rows if r["quantity"] > r["holding"]]


def expire(conn, now: datetime) -> int:
    return conn.execute(
        """UPDATE assignment SET status = 'expired', answered_at = now()
            WHERE status = 'asked' AND answer_by <= %s""", (now,)).rowcount


def make_items(conn, horizon: int, now: datetime) -> list[dict]:
    """The plan: what to ask for, with the people's names for the screen."""
    workers = _workers(conn)
    busy, hours = _busy_and_hours(conn, now)
    gaps = lost_people(conn, now) + board_gaps(conn, horizon)
    items = planner.plan(gaps, workers, busy, hours)
    names = {w["id"]: w["name"] for w in workers}
    return [{**i, "start": _iso(i["start"]), "end": _iso(i["end"]),
             "people": [{"id": w, "name": names[w]} for w in i["ask"]]}
            for i in items if i["ask"] or i["missing"]]


def _iso(v) -> str:
    return (v if isinstance(v, datetime) else datetime.fromisoformat(str(v))).isoformat()


def carry_out(conn, items: list[dict], by: str, operator: str, link_base: str, answer_minutes: int,
              now: datetime) -> int:
    """Ask the people in `items`: a roster shift for a new gap, then one assignment each. How many were asked."""
    asked = 0
    for i in items:
        if not i["ask"]:
            continue
        start, end = datetime.fromisoformat(i["start"]), datetime.fromisoformat(i["end"])
        shift_id = i.get("shift_id")
        if not shift_id:
            shift_id = conn.execute(
                """INSERT INTO resource_shift (airport, kind, language, quantity, starts_at, ends_at, note, created_by,
                                               source)
                   VALUES (%s, %s, %s, %s, %s, %s, 'From the roster', %s, 'roster') RETURNING id::text""",
                (i["airport"], i["kind"], i["language"], i["short"], start, end, by)).fetchone()["id"]
        # a person has until the time given, but never past an hour before the shift starts
        answer_by = min(now + timedelta(minutes=answer_minutes), start - timedelta(hours=1))
        answer_by = max(answer_by, now + timedelta(minutes=5))
        for w in i["ask"]:
            token = new_token()
            text = message(operator, i["kind"], i["language"], i["airport"], start, end, f"{link_base}#{token}")
            hit = conn.execute(
                """INSERT INTO assignment (shift_id, worker_id, token, token_hash, message, asked_by, answer_by)
                   VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (shift_id, worker_id) DO NOTHING RETURNING id""",
                (shift_id, w, token, hash_key(token), text, by, answer_by)).fetchone()
            asked += 1 if hit else 0
    return asked


def tick(conn, operator: str, link_base: str, now: datetime | None = None, by: str = AUTO,
         force: bool = False) -> dict:
    """One round for this operator. `force`: plan even when dispatch is Off (a supervisor pressed the button)."""
    now = now or datetime.now(timezone.utc)
    s = settings(conn)
    expired = expire(conn, now)
    conn.execute("UPDATE assignment SET token = NULL WHERE token IS NOT NULL AND shift_id IN "
                 "(SELECT id FROM resource_shift WHERE ends_at < %s)", (now,))
    if s["mode"] == "off" and not force:
        return {"mode": "off", "expired": expired, "asked": 0, "plan": None}
    if not conn.execute("SELECT 1 FROM worker WHERE active LIMIT 1").fetchone():
        # no roster yet: nothing to dispatch with
        return {"mode": s["mode"], "expired": expired, "asked": 0, "plan": None}
    items = make_items(conn, s["horizon_hours"], now)
    if s["mode"] == "auto":
        asked = carry_out(conn, items, by, operator, link_base, s["answer_minutes"], now)
        if asked:
            conn.execute("INSERT INTO dispatch_plan (status, items, made_by, decided_by, decided_at) "
                         "VALUES ('approved', %s, %s, %s, now())", (json.dumps(items), by, AUTO))
        return {"mode": "auto", "expired": expired, "asked": asked, "plan": None}
    # Approve: one proposed plan, refreshed when what it would do changes
    current = conn.execute("SELECT id::text, items FROM dispatch_plan WHERE status = 'proposed'").fetchone()
    if not items:
        if current:
            conn.execute("UPDATE dispatch_plan SET status = 'discarded', decided_by = %s, decided_at = now() "
                         "WHERE id = %s", ("Nothing left to cover", current["id"]))
        return {"mode": s["mode"], "expired": expired, "asked": 0, "plan": None}
    if current and _same(current["items"], items):
        return {"mode": s["mode"], "expired": expired, "asked": 0, "plan": current["id"]}
    if current:
        conn.execute("UPDATE dispatch_plan SET items = %s, made_by = %s, made_at = now() WHERE id = %s",
                     (json.dumps(items), by, current["id"]))
        return {"mode": s["mode"], "expired": expired, "asked": 0, "plan": current["id"]}
    pid = conn.execute("INSERT INTO dispatch_plan (items, made_by) VALUES (%s, %s) RETURNING id::text",
                       (json.dumps(items), by)).fetchone()["id"]
    return {"mode": s["mode"], "expired": expired, "asked": 0, "plan": pid}


def _same(a: list, b: list) -> bool:
    key = lambda xs: sorted(json.dumps({k: x.get(k) for k in ("airport", "kind", "language", "start", "ask", "missing",
                                                               "shift_id")}, sort_keys=True) for x in xs)
    return key(a) == key(b)
