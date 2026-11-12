"""The first screen: where every pilgrim is, and which groups move this week."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..core.auth import Identity, require
from ..core.db import tenant_session
from ..pilgrims.status import STATUSES

router = APIRouter(prefix="/v1", tags=["overview"])

WINDOW_DAYS = 7


@router.get("/overview")
def overview(who: Identity = Depends(require("pilgrim:read"))):
    with tenant_session(who.tenant_id) as conn:
        today = conn.execute("SELECT current_date AS d").fetchone()["d"]
        counts = {r["status"]: r["n"] for r in conn.execute(
            "SELECT status, count(*)::int AS n FROM pilgrim GROUP BY status")}
        needs = {r["need"]: r["n"] for r in conn.execute(
            """SELECT unnest(needs) AS need, count(*)::int AS n FROM pilgrim
                WHERE status <> 'departed' GROUP BY 1""")}
        groups = conn.execute("SELECT count(*)::int AS n FROM pilgrim_group").fetchone()["n"]
        moving = """SELECT g.id::text, g.code, g.name, g.kind, g.origin_country, g.{col} AS on_date,
                           (SELECT count(*)::int FROM pilgrim p WHERE p.group_id = g.id) AS pilgrims
                      FROM pilgrim_group g
                     WHERE g.{col} BETWEEN current_date AND current_date + %s
                     ORDER BY g.{col}, g.code"""
        arriving = conn.execute(moving.format(col="arrival_date"), (WINDOW_DAYS,)).fetchall()
        departing = conn.execute(moving.format(col="departure_date"), (WINDOW_DAYS,)).fetchall()
    return {
        "today": today,
        "window_days": WINDOW_DAYS,
        "groups": groups,
        "pilgrims": sum(counts.values()),
        "by_status": {s: counts.get(s, 0) for s in STATUSES},
        "needs": needs,
        "arriving": arriving,
        "departing": departing,
    }
