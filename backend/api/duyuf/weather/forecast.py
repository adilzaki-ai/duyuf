"""The forecast for Makkah and Madinah, fetched from Open-Meteo and kept in memory.

One fetch serves every pilgrim: the job in main.py's lifespan refreshes it
every REFRESH_MIN minutes, and a page asking before the first fetch waits
for it once. Nothing about any pilgrim is sent: only the two cities'
coordinates. Open-Meteo is free for non-commercial use; a paying season
needs its commercial plan (or another provider behind the same shape).

DUYUF_WEATHER_URL points somewhere else (a proxy, a mirror); "off" turns the
fetch off, for tests and for a server with no way out.
"""
from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timedelta, timezone

import httpx

from . import rules

log = logging.getLogger("duyuf.weather")

CITIES = {"makkah": (21.4225, 39.8262), "madinah": (24.4672, 39.6111)}
SOURCE = "Open-Meteo"
_URL = "https://api.open-meteo.com/v1/forecast"
_HOURLY = "temperature_2m,apparent_temperature,relative_humidity_2m,uv_index,precipitation_probability,weather_code,wind_speed_10m"
_DAILY = ("weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,uv_index_max,"
          "precipitation_probability_max,sunrise,sunset")
_CURRENT = "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,uv_index"
KSA = timezone(timedelta(hours=3))

_lock = threading.Lock()
_cache: dict = {"at": None, "raw": None}


class Unavailable(Exception):
    pass


def _fetch_one(lat: float, lon: float) -> dict:
    url = os.environ.get("DUYUF_WEATHER_URL", _URL)
    r = httpx.get(url, timeout=8, params={
        "latitude": lat, "longitude": lon, "hourly": _HOURLY, "daily": _DAILY, "current": _CURRENT,
        "timezone": "Asia/Riyadh", "forecast_days": 4, "wind_speed_unit": "kmh"})
    r.raise_for_status()
    return r.json()


def fetch() -> dict:
    """Both cities now, or Unavailable."""
    if os.environ.get("DUYUF_WEATHER_URL") == "off":
        raise Unavailable("weather is turned off on this server")
    try:
        return {city: _fetch_one(*at) for city, at in CITIES.items()}
    except (httpx.HTTPError, ValueError) as exc:
        raise Unavailable(f"the forecast could not be fetched ({type(exc).__name__})") from exc


def refresh() -> bool:
    """Fetch again; keep the last good forecast when this one fails."""
    try:
        raw = fetch()
    except Unavailable as exc:
        log.warning("%s", exc)
        return False
    with _lock:
        _cache.update(at=datetime.now(timezone.utc), raw=raw)
    return True


def _num(v):
    return None if v is None else round(float(v), 1)


def _city(raw: dict, now: datetime) -> dict:
    """One city's report from Open-Meteo's answer: now, the next 24 hours, the days, and the bands."""
    h, d, c = raw["hourly"], raw["daily"], raw.get("current") or {}
    here = now.astimezone(KSA).strftime("%Y-%m-%dT%H:00")
    hours = [{"at": at, "temp": _num(h["temperature_2m"][i]), "feels": _num(h["apparent_temperature"][i]),
              "humidity": h["relative_humidity_2m"][i], "uv": _num(h["uv_index"][i]),
              "rain_chance": h["precipitation_probability"][i], "code": h["weather_code"][i],
              "wind": _num(h["wind_speed_10m"][i])} for i, at in enumerate(h["time"])]
    for x in hours:
        x["heat"] = rules.heat_band(x["feels"])
    days = []
    for i, day in enumerate(d["time"]):
        of_day = [x for x in hours if x["at"].startswith(day)]
        days.append({"date": day, "code": d["weather_code"][i], "max": _num(d["temperature_2m_max"][i]),
                     "min": _num(d["temperature_2m_min"][i]), "feels_max": _num(d["apparent_temperature_max"][i]),
                     "uv_max": _num(d["uv_index_max"][i]), "rain_chance": d["precipitation_probability_max"][i],
                     "sunrise": d["sunrise"][i][11:16], "sunset": d["sunset"][i][11:16],
                     "heat": rules.heat_band(_num(d["apparent_temperature_max"][i])),
                     "uv": rules.uv_band(_num(d["uv_index_max"][i])),
                     "good": rules.good_windows(of_day)})
    current = {"temp": _num(c.get("temperature_2m")), "feels": _num(c.get("apparent_temperature")),
               "humidity": c.get("relative_humidity_2m"), "code": c.get("weather_code"),
               "wind": _num(c.get("wind_speed_10m")), "uv": _num(c.get("uv_index"))}
    current["heat"] = rules.heat_band(current["feels"])
    current["uv_band"] = rules.uv_band(current["uv"])
    return {"now": current, "hours": [x for x in hours if x["at"] >= here][:24], "days": days}


def report(now: datetime | None = None) -> dict:
    """The report every page gets. Fetches once if nothing has been fetched yet."""
    with _lock:
        at, raw = _cache["at"], _cache["raw"]
    if raw is None:
        if not refresh():
            raise Unavailable("no forecast yet")
        with _lock:
            at, raw = _cache["at"], _cache["raw"]
    now = now or datetime.now(timezone.utc)
    age = (now - at).total_seconds() / 60
    return {"updated_at": at.isoformat(), "source": SOURCE, "stale": age > rules.STALE_MIN,
            "cities": {city: _city(r, now) for city, r in raw.items()}}


def put(raw: dict, at: datetime | None = None) -> None:
    """For tests: a forecast as if just fetched."""
    with _lock:
        _cache.update(at=at or datetime.now(timezone.utc), raw=raw)
