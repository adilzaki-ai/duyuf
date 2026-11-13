"""How a pilgrim's readings are judged: heart, temperature, water.

Every number here is PROPOSED, chosen from common first-aid guidance for heat
illness and fever. None has been signed off by a doctor yet; a medical lead
must agree them before a real season. They are kept together so that review
is one file.

"Held" means every reading for at least that many minutes, up to the latest
one, passed the test: one high reading is not a fever, and the alarm should
not ring for a single bad value from a loose watch.

The front end holds the same numbers and rules (frontend/src/rafeeq/vitals.ts)
so the pilgrim's page shows what the platform decides; a test there reads
this file.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable

# ---- the numbers (PROPOSED) ----
FEVER_C = 38.0
FEVER_FOR_MIN = 30
HIGH_FEVER_C = 39.5
HIGH_FEVER_FOR_MIN = 10
RAISED_C = 37.5

HEART_HIGH = 120
HEART_HIGH_FOR_MIN = 10
HEART_DANGER_HIGH = 150
HEART_DANGER_LOW = 40
HEART_DANGER_FOR_MIN = 5
# a jump of this much between two readings, this many times within the window, is "unstable"
HEART_SWING = 40
HEART_SWINGS = 3
HEART_SWING_WINDOW_MIN = 15

# a body under strain, and no water for a while
STRAIN_HEART = 110
STRAIN_C = 37.8
STRAIN_FOR_MIN = 10
# Heat, judged from the body (there is no weather feed yet): strain on either
# the heart or the temperature is heat stress; on both at once, the signs of
# heat exhaustion. A high fever, or a fever with a fast heart, is heat stroke
# risk, and already counts down to a medical call.
WATER_RISK_MIN = 90
WATER_DUE_MIN = 120

# readings older than this say nothing about now
HEART_STALE_MIN = 15
TEMP_STALE_MIN = 30
WINDOW_MIN = 90

COUNTDOWN_S = 30
# after "I am OK", wait this long before counting down again for the same danger
QUIET_AFTER_OK_MIN = 10

# Reasons, most serious first. The page and the staff screens put words to them.
DANGER = ("heart_danger_high", "heart_danger_low", "high_fever", "fever_and_heart")
WARNING = ("fever", "heart_high", "heart_unstable", "dehydration_risk", "heat_exhaustion")
WATCH = ("temperature_raised", "heat_stress", "water_due")


Reading = tuple[datetime, float | None, float | None]   # at, heart rate, temperature


def _held(points: list[tuple[datetime, float]], test, minutes: int) -> bool:
    """`test` passed on every reading from the latest back over at least `minutes`."""
    run: list[datetime] = []
    for at, v in reversed(points):
        if not test(v):
            break
        run.append(at)
    return bool(run) and run[0] - run[-1] >= timedelta(minutes=minutes)


def _swings(points: list[tuple[datetime, float]], now: datetime) -> int:
    recent = [v for at, v in points if at >= now - timedelta(minutes=HEART_SWING_WINDOW_MIN)]
    return sum(1 for a, b in zip(recent, recent[1:]) if abs(b - a) >= HEART_SWING)


def assess(readings: Iterable[Reading], water_at: datetime | None, now: datetime) -> dict:
    """The state of one pilgrim now, from their recent readings (any order) and their last drink."""
    rows = sorted((r for r in readings if r[0] >= now - timedelta(minutes=WINDOW_MIN)), key=lambda r: r[0])
    hr = [(at, float(h)) for at, h, _ in rows if h is not None]
    tc = [(at, float(c)) for at, _, c in rows if c is not None]

    heart = {"state": "unknown", "bpm": None, "at": None}
    if hr and hr[-1][0] >= now - timedelta(minutes=HEART_STALE_MIN):
        heart["bpm"], heart["at"] = int(hr[-1][1]), hr[-1][0]
        if _held(hr, lambda v: v >= HEART_DANGER_HIGH, HEART_DANGER_FOR_MIN):
            heart["state"] = "danger_high"
        elif _held(hr, lambda v: v <= HEART_DANGER_LOW, HEART_DANGER_FOR_MIN):
            heart["state"] = "danger_low"
        elif _swings(hr, now) >= HEART_SWINGS:
            heart["state"] = "unstable"
        elif _held(hr, lambda v: v >= HEART_HIGH, HEART_HIGH_FOR_MIN):
            heart["state"] = "high"
        else:
            heart["state"] = "ok"

    temperature = {"state": "unknown", "c": None, "at": None}
    if tc and tc[-1][0] >= now - timedelta(minutes=TEMP_STALE_MIN):
        temperature["c"], temperature["at"] = tc[-1][1], tc[-1][0]
        if _held(tc, lambda v: v >= HIGH_FEVER_C, HIGH_FEVER_FOR_MIN):
            temperature["state"] = "high_fever"
        elif _held(tc, lambda v: v >= FEVER_C, FEVER_FOR_MIN):
            temperature["state"] = "fever"
        elif tc[-1][1] >= RAISED_C:
            temperature["state"] = "raised"
        else:
            temperature["state"] = "ok"

    since_water = (now - water_at) if water_at else None
    heart_strained = _held(hr, lambda v: v >= STRAIN_HEART, STRAIN_FOR_MIN)
    body_strained = _held(tc, lambda v: v >= STRAIN_C, STRAIN_FOR_MIN)
    strained = heart_strained or body_strained
    if strained and (since_water is None or since_water >= timedelta(minutes=WATER_RISK_MIN)):
        hydration = "risk"
    elif since_water is None or since_water >= timedelta(minutes=WATER_DUE_MIN):
        hydration = "due"
    else:
        hydration = "ok"

    fevered = temperature["state"] in ("fever", "high_fever")
    if temperature["state"] == "high_fever" or (fevered and heart["state"] in ("high", "unstable")):
        heat = "stroke_risk"
    elif heart_strained and body_strained:
        heat = "exhaustion"
    elif strained:
        heat = "stress"
    elif heart["state"] != "unknown" or temperature["state"] != "unknown":
        heat = "ok"
    else:
        heat = "unknown"

    reasons: list[str] = []
    if heart["state"] == "danger_high":
        reasons.append("heart_danger_high")
    if heart["state"] == "danger_low":
        reasons.append("heart_danger_low")
    if temperature["state"] == "high_fever":
        reasons.append("high_fever")
    if fevered and heart["state"] in ("high", "unstable"):
        reasons.append("fever_and_heart")
    if fevered:
        reasons.append("fever")
    if heart["state"] == "high":
        reasons.append("heart_high")
    if heart["state"] == "unstable":
        reasons.append("heart_unstable")
    if hydration == "risk":
        reasons.append("dehydration_risk")
    if heat == "exhaustion":
        reasons.append("heat_exhaustion")
    if temperature["state"] == "raised":
        reasons.append("temperature_raised")
    if heat == "stress":
        reasons.append("heat_stress")
    if hydration == "due":
        reasons.append("water_due")

    level = ("danger" if any(r in DANGER for r in reasons) else
             "warning" if any(r in WARNING for r in reasons) else
             "watch" if reasons else
             "ok" if heart["state"] != "unknown" or temperature["state"] != "unknown" else "unknown")
    return {"level": level, "reasons": reasons, "heart": heart, "temperature": temperature,
            "hydration": hydration, "heat": heat, "water_at": water_at}
