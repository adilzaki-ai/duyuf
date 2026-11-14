"""Work the platform does on its own, every few seconds while it runs.

A job finds what is due across every operator as the owner (it cannot know
which operator to ask for first), then does each piece inside that
operator's tenant_session, like a request would. Nothing else here reads
across operators.
"""
from __future__ import annotations

import asyncio
import logging

from ..health.record import fire
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


async def run_forever() -> None:
    while True:
        try:
            raised = await asyncio.to_thread(fire_due_alerts)
            if raised:
                log.warning("automatic medical alerts raised: %d", len(raised))
        except Exception:  # a bad round must not stop the next one
            log.exception("job round failed")
        await asyncio.sleep(EVERY_S)
