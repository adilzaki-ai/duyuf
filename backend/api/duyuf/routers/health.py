"""Health: pilgrims' readings and places, for medics and administrators.

Health readings are special personal data (PDPL): every route here needs
health:read, except the door for a wearable maker's system (device:write).
Other staff see a medical incident and the place to go, never the numbers.
Only pilgrims who agreed to share appear here at all.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.auth import Identity, require
from ..core.db import tenant_session
from ..health import record
from ..health.rules import WINDOW_MIN, assess
from .rafeeq import PlaceIn, ReadingIn

router = APIRouter(tags=["health"])

_RANK = {"danger": 0, "warning": 1, "watch": 2, "ok": 3, "unknown": 4}


@router.get("/v1/health")
def health_board(who: Identity = Depends(require("health:read"))):
    """Everyone sharing readings or their place, the most serious first."""
    with tenant_session(who.tenant_id) as conn:
        now = conn.execute("SELECT now() AS n").fetchone()["n"]
        people = conn.execute(
            """SELECT p.id::text AS pilgrim_id, p.full_name, p.full_name_ar, p.status, p.needs,
                      g.id::text AS group_id, g.code AS group_code, g.name AS group_name,
                      (c.health_at IS NOT NULL) AS shares_health, (c.location_at IS NOT NULL) AS shares_location
                 FROM pilgrim_consent c JOIN pilgrim p ON p.id = c.pilgrim_id JOIN pilgrim_group g ON g.id = p.group_id
                WHERE c.health_at IS NOT NULL OR c.location_at IS NOT NULL""").fetchall()
        ids = [p["pilgrim_id"] for p in people]
        readings: dict[str, list] = {i: [] for i in ids}
        for r in conn.execute(
                """SELECT pilgrim_id::text, at, heart_rate, temperature FROM vital_reading
                    WHERE pilgrim_id = ANY(%s::uuid[]) AND at > now() - make_interval(mins => %s)""",
                (ids, WINDOW_MIN)):
            readings[r["pilgrim_id"]].append((r["at"], r["heart_rate"], r["temperature"]))
        water = {r["pilgrim_id"]: r["at"] for r in conn.execute(
            "SELECT pilgrim_id::text, max(at) AS at FROM water_log WHERE pilgrim_id = ANY(%s::uuid[]) GROUP BY 1", (ids,))}
        places = {r["pilgrim_id"]: r for r in conn.execute(
            """SELECT DISTINCT ON (pilgrim_id) pilgrim_id::text, lat, lon, accuracy_m, at, source
                 FROM pilgrim_location WHERE pilgrim_id = ANY(%s::uuid[]) ORDER BY pilgrim_id, at DESC""", (ids,))}
        alerts = {r["pilgrim_id"]: r for r in conn.execute(
            """SELECT DISTINCT ON (a.pilgrim_id) a.pilgrim_id::text, a.id::text, a.state, a.reasons, a.fires_at,
                      a.incident_id::text, i.ref AS incident_ref, i.status AS incident_status
                 FROM health_alert a LEFT JOIN incident i ON i.id = a.incident_id
                WHERE a.pilgrim_id = ANY(%s::uuid[])
                  AND (a.state = 'counting' OR (a.state = 'sent' AND i.status <> 'resolved'))
                ORDER BY a.pilgrim_id, a.started_at DESC""", (ids,))}
        simulated = {r["pilgrim_id"] for r in conn.execute(
            """SELECT DISTINCT pilgrim_id::text FROM vital_reading
                WHERE pilgrim_id = ANY(%s::uuid[]) AND source = 'simulated' AND at > now() - interval '1 day'""", (ids,))}
        items = []
        for p in people:
            i = p["pilgrim_id"]
            h = assess(readings[i], water.get(i), now) if p["shares_health"] else None
            if h:
                h["simulated"] = i in simulated
            items.append({**p, "health": h, "place": places.get(i) if p["shares_location"] else None,
                          "alert": alerts.get(i)})
        items.sort(key=lambda x: (0 if x["alert"] else 1, _RANK[(x["health"] or {}).get("level", "unknown")],
                                  x["full_name"]))
        level = lambda x, v: (x["health"] or {}).get("level") == v
        reason = lambda x, r: r in (x["health"] or {}).get("reasons", [])
        stats = {
            "danger": sum(1 for x in items if level(x, "danger")),
            "fever": sum(1 for x in items if reason(x, "fever")),
            "heart": sum(1 for x in items if any(reason(x, r) for r in ("heart_high", "heart_unstable",
                                                                       "heart_danger_high", "heart_danger_low"))),
            "dehydration": sum(1 for x in items if reason(x, "dehydration_risk")),
            "sharing_health": sum(1 for x in items if x["shares_health"]),
            "sharing_location": sum(1 for x in items if x["shares_location"]),
            # sharing, but the watch has gone quiet: off the wrist, flat, or out of signal
            "no_readings": sum(1 for x in items if x["health"] and x["health"]["heart"]["state"] == "unknown"
                               and x["health"]["temperature"]["state"] == "unknown"),
            "alerts": sum(1 for x in items if x["alert"]),
        }
        return {"items": items, "stats": stats, "at": now}


@router.get("/v1/health/pilgrims/{pilgrim_id}")
def pilgrim_health(pilgrim_id: str, who: Identity = Depends(require("health:read"))):
    """One pilgrim: the state now, the last six hours of readings, alerts, and recent places."""
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("SELECT 1 FROM pilgrim WHERE id = %s", (pilgrim_id,)).fetchone():
            raise HTTPException(404, "no such pilgrim")
        agreed = record.consent(conn, pilgrim_id)
        return {
            "consent": agreed,
            "health": record.state(conn, pilgrim_id) if agreed["health"] else None,
            "readings": conn.execute(
                """SELECT at, heart_rate, temperature::float AS temperature, source FROM vital_reading
                    WHERE pilgrim_id = %s AND at > now() - interval '6 hours' ORDER BY at""",
                (pilgrim_id,)).fetchall() if agreed["health"] else [],
            "alerts": conn.execute(
                """SELECT a.id::text, a.state, a.reasons, a.heart_rate, a.temperature::float AS temperature,
                          a.started_at, a.ended_at, a.incident_id::text, i.ref AS incident_ref
                     FROM health_alert a LEFT JOIN incident i ON i.id = a.incident_id
                    WHERE a.pilgrim_id = %s ORDER BY a.started_at DESC LIMIT 10""", (pilgrim_id,)).fetchall(),
            "places": conn.execute(
                """SELECT lat, lon, accuracy_m, at, source FROM pilgrim_location WHERE pilgrim_id = %s
                    ORDER BY at DESC LIMIT 20""", (pilgrim_id,)).fetchall() if agreed["location"] else [],
        }


class DeviceIn(BaseModel):
    pilgrim_id: str
    readings: list[ReadingIn] = Field(default=[], max_length=500)
    places: list[PlaceIn] = Field(default=[], max_length=500)
    device: str | None = Field(default=None, max_length=80)


@router.post("/v1/devices/readings")
def device_readings(body: DeviceIn, who: Identity = Depends(require("device:write"))):
    """The door for a wearable maker's system: readings and places for one pilgrim who agreed.
    Judged like readings from the pilgrim's own page."""
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("SELECT 1 FROM pilgrim WHERE id = %s", (body.pilgrim_id,)).fetchone():
            raise HTTPException(404, "no such pilgrim")
        out = None
        if body.readings:
            out = record.take_readings(conn, body.pilgrim_id, [r.model_dump() for r in body.readings], "device",
                                       body.device)
        for pl in sorted(body.places, key=lambda x: x.at.timestamp() if x.at else float("inf")):
            record.take_location(conn, body.pilgrim_id, pl.lat, pl.lon, pl.accuracy_m, pl.at, "device")
        return {"level": out["level"] if out else None, "alert": record.counting(conn, body.pilgrim_id)}
