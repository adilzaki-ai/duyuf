"""What each AI helper may see: built here, in the operator's own database session.

The briefing and the advisor see totals and flight numbers, never a person.
The co-pilot sees the one incident it is helping with: the pilgrim's first
name, language, needs and stage, never a passport, a birth date, a surname
or a phone number.
"""
from __future__ import annotations

from datetime import datetime

from ..arrivals.brief import KSA, SLOT_HOURS
from ..health import record
from ..routers.arrivals import _board
from ..routers.incidents import _one, _stats


def _when(t: datetime) -> str:
    return t.astimezone(KSA).strftime("%a %H:%M")


def _gaps(board: dict) -> list[dict]:
    """Each shortfall on the board, numbered, with its block and flights."""
    out = []
    for row in board["load"]:
        for s in row["short"]:
            out.append({"gap": len(out) + 1, "airport": row["airport"], "from": _when(row["start"]),
                        "hours": SLOT_HOURS, "kind": s["kind"], "language": s["language"], "short": s["short"],
                        "flights": row["flights"]})
    return out


def brief(conn, operator: str) -> dict:
    board = _board(conn, 48)
    by_status = {r["status"]: r["n"] for r in conn.execute("SELECT status, count(*)::int AS n FROM pilgrim GROUP BY 1")}
    needs = {r["need"]: r["n"] for r in conn.execute(
        "SELECT unnest(needs) AS need, count(*)::int AS n FROM pilgrim WHERE status <> 'departed' GROUP BY 1")}
    open_by_kind = {r["kind"]: r["n"] for r in conn.execute(
        "SELECT kind, count(*)::int AS n FROM incident WHERE status <> 'resolved' GROUP BY 1")}
    waiting = conn.execute(
        "SELECT count(*)::int AS n FROM incident WHERE status = 'open' AND opened_at < now() - interval '15 minutes'"
    ).fetchone()["n"]
    flights = [f for f in board["flights"] if not f["landed_at"]]
    health = conn.execute(
        """SELECT (SELECT count(*)::int FROM pilgrim_consent WHERE health_at IS NOT NULL) AS sharing,
                  (SELECT count(*)::int FROM health_alert a JOIN incident i ON i.id = a.incident_id
                    WHERE a.state = 'sent' AND i.status <> 'resolved') AS open_medical_alerts,
                  (SELECT count(*)::int FROM health_alert WHERE state = 'counting') AS counting_down""").fetchone()
    return {
        "saudi_time": datetime.now(KSA).strftime("%A %d %B %Y, %H:%M"),
        "operator": operator,
        "pilgrims_by_stage": by_status,
        "needs_of_pilgrims_not_yet_home": needs,
        "arrivals_next_48h": {
            "flights": len(flights),
            "pilgrims": sum(f["brief"]["pilgrims"] for f in flights),
            "delayed": sum(1 for f in flights if f["state"] == "delayed"),
            "due_not_confirmed": sum(1 for f in flights if f["state"] == "due"),
            "no_visa_yet": sum(f["brief"]["no_visa"] for f in flights),
            "gaps": _gaps(board),
            "groups_landing_with_pilgrims_on_no_flight": [
                {"group": g["code"], "arrives": g["arrival_date"], "on_no_flight": g["without_flight"]}
                for g in board["unplanned"]],
        },
        "incidents": {**_stats(conn), "open_by_kind": open_by_kind, "open_waiting_over_15_min": waiting},
        "health": health,
    }


def advisor(conn, hours: int) -> dict:
    board = _board(conn, hours)
    blocks = []
    for row in board["load"]:
        spare = {
            "wheelchair": row["have"]["wheelchair"] - row["need"]["wheelchair"],
            "bus": row["have"]["bus"] - row["need"]["bus"],
            "interpreter": {l: n - row["need"]["interpreter"].get(l, 0) for l, n in row["have"]["interpreter"].items()},
        }
        blocks.append({"airport": row["airport"], "from": _when(row["start"]), "flights": row["flights"],
                       "need": row["need"], "on_shift": row["have"], "spare": spare})
    return {"saudi_time": datetime.now(KSA).strftime("%A %H:%M"), "hours_ahead": hours, "block_hours": SLOT_HOURS,
            "gaps": _gaps(board), "blocks": blocks}


def copilot(conn, incident_id: str, who) -> dict:
    i = _one(conn, incident_id, who)
    p = None
    if i["pilgrim_id"]:
        p = conn.execute(
            "SELECT p.full_name, p.language, p.needs, p.status FROM pilgrim p WHERE p.id = %s",
            (i["pilgrim_id"],)).fetchone()
    leader = conn.execute("SELECT leader_name FROM pilgrim_group WHERE id = %s",
                          (i["group_id"],)).fetchone() if i["group_id"] else None
    teams = [r["team"] for r in conn.execute(
        "SELECT team FROM incident WHERE team IS NOT NULL GROUP BY team ORDER BY max(updated_at) DESC LIMIT 8")]
    minutes_open = int((datetime.now(KSA) - i["opened_at"]).total_seconds() // 60)
    out = {
        "incident": {"kind": i["kind"], "priority": i["priority"], "status": i["status"],
                     "minutes_open": minutes_open, "location": i["location"], "description": i["description"],
                     "raised_by": i["reported_by"], "from_the_pilgrims_phone": i["from_rafeeq"],
                     "pilgrim_said_fine": bool(i["pilgrim_ok_at"]), "team": i["team"],
                     "live_location_known": bool(i.get("live_location"))},
        "history": [{"step": h["kind"], "note": h["note"], "team": h["team"]} for h in i["history"][-8:]],
        "group": {"name": i["group_name"], "leader_first_name": (leader["leader_name"] or "").split(" ")[0] if leader and leader["leader_name"] else None},
        "teams_used_lately": teams,
    }
    if p:
        out["pilgrim"] = {
            "first_name": p["full_name"].split(" ")[0],
            "language": p["language"] or "en",
            # "elderly" is among the needs when it applies; the birth date itself stays out
            "needs": p["needs"], "stage": p["status"],
        }
        if who.can("health:read") and record.consent(conn, i["pilgrim_id"])["health"]:
            h = record.state(conn, i["pilgrim_id"])
            out["pilgrim"]["health_now"] = {"overall": h["level"], "reasons": h["reasons"]}
    return out
