"""Work the platform does on its own, every few seconds while it runs.

A job finds what is due across every operator as the owner (it cannot know
which operator to ask for first), then does each piece inside that
operator's tenant_session, like a request would. Nothing else here reads
across operators.
"""
from __future__ import annotations

import asyncio
import logging

from ..dispatch import run as dispatch_run
from ..health.record import fire
from ..weather import forecast
from ..weather.rules import REFRESH_MIN
from .db import owner_session, tenant_session

log = logging.getLogger("duyuf.jobs")
EVERY_S = 5


def fire_due_alerts() -> list[str]:
    """Countdowns that ran out become urgent medical incidents. The incident ids raised."""
    with owner_session() as conn:
        due = conn.execute(
            """SELECT id::text, tenant_id::text FROM health_alert
                WHERE state = 'counting' AND fires_at <= now() ORDER BY fires_at LIMIT 200""").fetchall()
    raised = []
    for a in due:
        with tenant_session(a["tenant_id"]) as conn:
            iid = fire(conn, a["id"])
        if iid:
            raised.append(iid)
    return raised


# the dispatcher looks at the board this often (every 12th round of EVERY_S)
DISPATCH_EVERY = 12


def dispatch_round() -> int:
    """For each operator whose dispatcher is not Off: expire unanswered requests, then plan or ask
    (dispatch/run.py). How many people were asked. Operators with no setting yet are on Approve."""
    from ..routers.dispatch import link_base
    with owner_session() as conn:
        tenants = conn.execute(
            """SELECT t.id::text, t.name FROM tenant t LEFT JOIN dispatch_setting d ON d.tenant_id = t.id
                WHERE coalesce(d.mode, 'approve') <> 'off'
                  AND EXISTS (SELECT 1 FROM worker w WHERE w.tenant_id = t.id AND w.active)""").fetchall()
    asked = 0
    for t in tenants:
        try:
            with tenant_session(t["id"]) as conn:
                asked += dispatch_run.tick(conn, t["name"], link_base())["asked"]
        except Exception:  # one operator's bad round must not stop the others
            log.exception("dispatch round failed for %s", t["id"])
    return asked


async def run_forever() -> None:
    n = 0
    while True:
        try:
            raised = await asyncio.to_thread(fire_due_alerts)
            if raised:
                log.warning("automatic medical alerts raised: %d", len(raised))
            if n % DISPATCH_EVERY == 0:
                asked = await asyncio.to_thread(dispatch_round)
                if asked:
                    log.info("dispatcher asked %d people", asked)
        except Exception:  # a bad round must not stop the next one
            log.exception("job round failed")
        n += 1
        await asyncio.sleep(EVERY_S)


async def weather_forever() -> None:
    """The forecast for Rafeeq's weather report, fetched again every REFRESH_MIN minutes
    (sooner after a failure, keeping the last good one meanwhile)."""
    while True:
        ok = await asyncio.to_thread(forecast.refresh)
        await asyncio.sleep(REFRESH_MIN * 60 if ok else 300)
