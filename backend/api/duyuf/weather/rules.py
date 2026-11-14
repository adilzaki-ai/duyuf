"""How hot and how sunny, in words a pilgrim can act on.

Mirrored in frontend/src/rafeeq/weatherRules.ts (the sample computes the same
bands); a test there reads this file, so change both.

Heat bands follow the US National Weather Service heat-index categories
(80, 90, 103 and 125 °F), applied to the forecast's "feels like" temperature.
UV bands are the WHO UV-index scale. GOOD_* is when walking outdoors is
comfortable for an older pilgrim: PROPOSED, for the operator's doctor to agree.
"""
from __future__ import annotations

# feels-like °C at or above which each band starts, highest first
HEAT_BANDS = (("extreme_danger", 52), ("danger", 40), ("extreme_caution", 32), ("caution", 27))
# UV index at or above which each band starts, highest first
UV_BANDS = (("extreme", 11), ("very_high", 8), ("high", 6), ("moderate", 3))

# a good hour to be outside: feels like less than this, and UV below this
GOOD_FEELS_BELOW = 32
GOOD_UV_BELOW = 6
# good hours are looked for between these hours of the day (Saudi time)
DAY_FROM_HOUR = 5
DAY_TO_HOUR = 23

# the forecast is fetched this often, and called old after this long
REFRESH_MIN = 30
STALE_MIN = 180


def heat_band(feels_c: float | None) -> str:
    if feels_c is None:
        return "unknown"
    for name, at in HEAT_BANDS:
        if feels_c >= at:
            return name
    return "comfortable"


def uv_band(uv: float | None) -> str:
    if uv is None:
        return "unknown"
    for name, at in UV_BANDS:
        if uv >= at:
            return name
    return "low"


def good_hour(feels_c: float | None, uv: float | None) -> bool:
    return feels_c is not None and feels_c < GOOD_FEELS_BELOW and (uv or 0) < GOOD_UV_BELOW


def good_windows(hours: list[dict]) -> list[dict]:
    """Runs of good hours within the day, as [{"from": "05:00", "to": "09:00"}]. `hours` are
    {"at": "2026-11-14T05:00", "feels": …, "uv": …} for one day, in order."""
    out: list[dict] = []
    for h in hours:
        hour = int(h["at"][11:13])
        if not (DAY_FROM_HOUR <= hour < DAY_TO_HOUR):
            continue
        if good_hour(h.get("feels"), h.get("uv")):
            if out and out[-1]["_next"] == hour:
                out[-1]["to"], out[-1]["_next"] = f"{hour + 1:02d}:00", hour + 1
            else:
                out.append({"from": f"{hour:02d}:00", "to": f"{hour + 1:02d}:00", "_next": hour + 1})
    for w in out:
        del w["_next"]
    return out
