"""Readings, places and water in; a countdown, then an incident, when the readings are dangerous.

Everything here runs inside one operator's tenant_session. The pilgrim's page
(routers/rafeeq.py) and a wearable maker's system (routers/health.py) both
come through `take_readings` and `take_location`, so a reading is judged the
same way whichever door it used.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import HTTPException

from ..rafeeq.help import LANGUAGE_NAMES
from .rules import COUNTDOWN_S, QUIET_AFTER_OK_MIN, WINDOW_MIN, assess

READINGS_KEPT = timedelta(days=7)      # PROPOSED retention
PLACES_KEPT = timedelta(hours=48)      # PROPOSED retention
# a place older than this is not "where they are now"
PLACE_FRESH = timedelta(minutes=30)
ALERT_ACTOR = "Rafeeq health alert"


def consent(conn, pilgrim_id: str) -> dict:
    row = conn.execute("SELECT health_at, location_at FROM pilgrim_consent WHERE pilgrim_id = %s",
                       (pilgrim_id,)).fetchone()
    return {"health": bool(row and row["health_at"]), "location": bool(row and row["location_at"])}


def set_consent(conn, pilgrim_id: str, health: bool | None, location: bool | None) -> dict:
    conn.execute(
        """INSERT INTO pilgrim_consent (pilgrim_id, health_at, location_at)
           VALUES (%(p)s, CASE WHEN %(h)s THEN now() END, CASE WHEN %(l)s THEN now() END)
           ON CONFLICT (tenant_id, pilgrim_id) DO UPDATE SET
             health_at = CASE WHEN %(h)s IS NULL THEN pilgrim_consent.health_at
                              WHEN %(h)s THEN coalesce(pilgrim_consent.health_at, now()) END,
             location_at = CASE WHEN %(l)s IS NULL THEN pilgrim_consent.location_at
                                WHEN %(l)s THEN coalesce(pilgrim_consent.location_at, now()) END,
             updated_at = now()""",
        {"p": pilgrim_id, "h": health, "l": location})
    # Withdrawing consent stops sharing and removes what was shared.
    if health is False:
        conn.execute("DELETE FROM vital_reading WHERE pilgrim_id = %s", (pilgrim_id,))
        conn.execute("DELETE FROM water_log WHERE pilgrim_id = %s", (pilgrim_id,))
        conn.execute("""UPDATE health_alert SET state = 'cancelled', ended_at = now()
                         WHERE pilgrim_id = %s AND state = 'counting'""", (pilgrim_id,))
    if location is False:
        conn.execute("DELETE FROM pilgrim_location WHERE pilgrim_id = %s", (pilgrim_id,))
    return consent(conn, pilgrim_id)


def _now(conn) -> datetime:
    return conn.execute("SELECT now() AS n").fetchone()["n"]


def state(conn, pilgrim_id: str) -> dict:
    """What the readings say now, by the rules in rules.py."""
    now = _now(conn)
    rows = conn.execute(
        """SELECT at, heart_rate, temperature FROM vital_reading
            WHERE pilgrim_id = %s AND at > now() - make_interval(mins => %s) ORDER BY at""",
        (pilgrim_id, WINDOW_MIN)).fetchall()
    water = conn.execute("SELECT max(at) AS at FROM water_log WHERE pilgrim_id = %s", (pilgrim_id,)).fetchone()["at"]
    out = assess([(r["at"], r["heart_rate"], r["temperature"]) for r in rows], water, now)
    out["simulated"] = bool(conn.execute(
        "SELECT 1 FROM vital_reading WHERE pilgrim_id = %s AND source = 'simulated' AND at > now() - interval '1 day' LIMIT 1",
        (pilgrim_id,)).fetchone())
    return out


def counting(conn, pilgrim_id: str) -> dict | None:
    return conn.execute(
        """SELECT id::text, reasons, heart_rate, temperature, started_at, fires_at,
                  greatest(0, ceil(extract(epoch FROM fires_at - now())))::int AS seconds_left
             FROM health_alert WHERE pilgrim_id = %s AND state = 'counting'""", (pilgrim_id,)).fetchone()


def take_readings(conn, pilgrim_id: str, readings: list[dict], source: str, device: str | None) -> dict:
    """Store readings (consent first), judge them, and start a countdown if they are dangerous."""
    if not consent(conn, pilgrim_id)["health"]:
        raise HTTPException(409, "the pilgrim has not agreed to share health readings")
    now = _now(conn)
    # a demonstration button replaces the last one's readings, so scenarios do not mix
    if source == "simulated":
        conn.execute("DELETE FROM vital_reading WHERE pilgrim_id = %s AND source = 'simulated'", (pilgrim_id,))
    for r in readings:
        at = r.get("at") or now
        if at > now + timedelta(minutes=5) or at < now - timedelta(days=1):
            raise HTTPException(422, "a reading must be from the last day, not the future")
        conn.execute(
            """INSERT INTO vital_reading (pilgrim_id, at, heart_rate, temperature, source, device)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (pilgrim_id, at, r.get("heart_rate"), r.get("temperature"), source, device))
    conn.execute("DELETE FROM vital_reading WHERE pilgrim_id = %s AND at < now() - %s", (pilgrim_id, READINGS_KEPT))
    now_state = state(conn, pilgrim_id)
    _maybe_count_down(conn, pilgrim_id, now_state)
    return now_state


def take_water(conn, pilgrim_id: str) -> dict:
    if not consent(conn, pilgrim_id)["health"]:
        raise HTTPException(409, "the pilgrim has not agreed to share health readings")
    conn.execute("INSERT INTO water_log (pilgrim_id) VALUES (%s)", (pilgrim_id,))
    conn.execute("DELETE FROM water_log WHERE pilgrim_id = %s AND at < now() - %s", (pilgrim_id, READINGS_KEPT))
    return state(conn, pilgrim_id)


def take_location(conn, pilgrim_id: str, lat: float, lon: float, accuracy_m: float | None,
                  at: datetime | None, source: str) -> None:
    if not consent(conn, pilgrim_id)["location"]:
        raise HTTPException(409, "the pilgrim has not agreed to share where they are")
    now = _now(conn)
    at = at or now
    if at > now + timedelta(minutes=5) or at < now - PLACES_KEPT:
        raise HTTPException(422, "a place must be from the last two days, not the future")
    conn.execute(
        "INSERT INTO pilgrim_location (pilgrim_id, at, lat, lon, accuracy_m, source) VALUES (%s, %s, %s, %s, %s, %s)",
        (pilgrim_id, at, lat, lon, accuracy_m, source))
    conn.execute("DELETE FROM pilgrim_location WHERE pilgrim_id = %s AND at < now() - %s", (pilgrim_id, PLACES_KEPT))
    # an open call for help follows them
    text = place_text({"lat": lat, "lon": lon, "accuracy_m": accuracy_m})
    conn.execute("""UPDATE incident SET location = %s, updated_at = now()
                     WHERE pilgrim_id = %s AND status <> 'resolved'
                       AND (rafeeq_card_id IS NOT NULL OR reported_by = %s)""",
                 (text, pilgrim_id, ALERT_ACTOR))


def last_place(conn, pilgrim_id: str, fresh_only: bool = False) -> dict | None:
    row = conn.execute(
        """SELECT lat, lon, accuracy_m, at, source FROM pilgrim_location WHERE pilgrim_id = %s
            ORDER BY at DESC LIMIT 1""", (pilgrim_id,)).fetchone()
    if row and fresh_only and row["at"] < _now(conn) - PLACE_FRESH:
        return None
    return row


# "where most of your group is": shown only when enough of them share, as one point, never anyone's own place
GROUP_FRESH = timedelta(minutes=15)
GROUP_AT_LEAST = 3


def group_centre(conn, group_id: str, but_not: str) -> dict | None:
    """The middle (median) of where the rest of the group is now, from those who share their place."""
    rows = conn.execute(
        # the demonstration's pretend places stay "now" on a demonstration operator, so the demo does not go stale
        """SELECT DISTINCT ON (l.pilgrim_id) l.lat, l.lon, l.at
             FROM pilgrim_location l JOIN pilgrim p ON p.id = l.pilgrim_id JOIN tenant t ON t.id = p.tenant_id
             JOIN pilgrim_consent c ON c.pilgrim_id = l.pilgrim_id AND c.location_at IS NOT NULL
            WHERE p.group_id = %s AND l.pilgrim_id <> %s
              AND (l.at > now() - %s OR (l.source = 'simulated' AND t.is_demo))
            ORDER BY l.pilgrim_id, l.at DESC""", (group_id, but_not, GROUP_FRESH)).fetchall()
    if len(rows) < GROUP_AT_LEAST:
        return None
    mid = lambda xs: sorted(xs)[len(xs) // 2]
    return {"lat": round(mid([r["lat"] for r in rows]), 5), "lon": round(mid([r["lon"] for r in rows]), 5),
            "count": len(rows), "at": max(r["at"] for r in rows)}


def place_text(p: dict) -> str:
    acc = f" (±{round(p['accuracy_m'])} m)" if p.get("accuracy_m") is not None else ""
    return f"{p['lat']:.5f}, {p['lon']:.5f}{acc}"


def _maybe_count_down(conn, pilgrim_id: str, now_state: dict) -> None:
    if now_state["level"] != "danger" or counting(conn, pilgrim_id):
        return
    # already sent and still being dealt with: the readings go on the open case, no new countdown
    if conn.execute(
            """SELECT 1 FROM health_alert a JOIN incident i ON i.id = a.incident_id
                WHERE a.pilgrim_id = %s AND a.state = 'sent' AND i.status <> 'resolved' LIMIT 1""",
            (pilgrim_id,)).fetchone():
        return
    # they said "I am OK" a moment ago
    if conn.execute(
            """SELECT 1 FROM health_alert WHERE pilgrim_id = %s AND state = 'cancelled'
                AND ended_at > now() - make_interval(mins => %s) LIMIT 1""",
            (pilgrim_id, QUIET_AFTER_OK_MIN)).fetchone():
        return
    danger = [r for r in now_state["reasons"] if r in ("heart_danger_high", "heart_danger_low", "high_fever",
                                                         "fever_and_heart")]
    conn.execute(
        """INSERT INTO health_alert (pilgrim_id, reasons, heart_rate, temperature, fires_at)
           VALUES (%s, %s, %s, %s, now() + make_interval(secs => %s))""",
        (pilgrim_id, danger, now_state["heart"]["bpm"], now_state["temperature"]["c"], COUNTDOWN_S))


def cancel(conn, pilgrim_id: str, alert_id: str) -> bool:
    """'I am OK': the countdown stops. False if it had already gone out or was not theirs."""
    return bool(conn.execute(
        """UPDATE health_alert SET state = 'cancelled', ended_at = now()
            WHERE id = %s AND pilgrim_id = %s AND state = 'counting' RETURNING id""",
        (alert_id, pilgrim_id)).fetchone())


def fire(conn, alert_id: str) -> str | None:
    """The count ran out: an urgent medical incident with their last place. Its id, or None if
    the alert was cancelled or sent meanwhile. The description carries no readings: only medics
    and administrators see those (routers/health.py)."""
    a = conn.execute(
        """SELECT a.id::text, a.pilgrim_id::text, p.group_id::text, p.language,
                  (SELECT c.id FROM rafeeq_card c WHERE c.pilgrim_id = a.pilgrim_id AND c.revoked_at IS NULL) AS card,
                  (SELECT c.language FROM rafeeq_card c WHERE c.pilgrim_id = a.pilgrim_id AND c.revoked_at IS NULL) AS card_language
             FROM health_alert a JOIN pilgrim p ON p.id = a.pilgrim_id
            WHERE a.id = %s AND a.state = 'counting' AND a.fires_at <= now() FOR UPDATE OF a""",
        (alert_id,)).fetchone()
    if not a:
        return None
    place = last_place(conn, a["pilgrim_id"], fresh_only=True)
    language = a["card_language"] or a["language"]
    speaks = f" Speaks {LANGUAGE_NAMES[language]}." if language in LANGUAGE_NAMES else ""
    iid = conn.execute(
        """INSERT INTO incident (kind, priority, pilgrim_id, group_id, location, description, reported_by, rafeeq_card_id)
           VALUES ('medical', 'urgent', %s, %s, %s, %s, %s, %s) RETURNING id::text""",
        (a["pilgrim_id"], a["group_id"], place_text(place) if place else None,
         "Automatic medical alert from health readings. The pilgrim did not press “I am OK”."
         + speaks, ALERT_ACTOR, a["card"])).fetchone()["id"]
    conn.execute("INSERT INTO incident_event (incident_id, kind, actor) VALUES (%s, 'opened', %s)", (iid, ALERT_ACTOR))
    conn.execute("UPDATE health_alert SET state = 'sent', ended_at = now(), incident_id = %s WHERE id = %s",
                 (iid, alert_id))
    return iid
