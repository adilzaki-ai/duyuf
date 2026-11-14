"""Rafeeq's weather report: the bands, the good hours, and the endpoint, on a forecast
shaped like Open-Meteo's (no network in tests)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from conftest import as_op
from test_rafeeq import _card, _pilgrim

from duyuf.weather import forecast, rules


def _raw(day="2026-11-14", feels_by_hour=None, uv_by_hour=None):
    """Four days of hourly data; feels like 26 at night rising to 36 at 13:00 unless told otherwise."""
    times, feels, uv = [], [], []
    for d in range(4):
        date = (datetime.fromisoformat(day) + timedelta(days=d)).date().isoformat()
        for h in range(24):
            times.append(f"{date}T{h:02d}:00")
            f = (feels_by_hour or {}).get(h, 26 + max(0, 10 - abs(13 - h) * 1.5))
            feels.append(f)
            uv.append((uv_by_hour or {}).get(h, max(0, 9 - abs(12 - h) * 1.6)))
    n = len(times)
    days = [(datetime.fromisoformat(day) + timedelta(days=d)).date().isoformat() for d in range(4)]
    return {
        "hourly": {"time": times, "temperature_2m": [f - 2 for f in feels], "apparent_temperature": feels,
                   "relative_humidity_2m": [30] * n, "uv_index": uv, "precipitation_probability": [0] * n,
                   "weather_code": [0] * n, "wind_speed_10m": [12] * n},
        "daily": {"time": days, "weather_code": [0] * 4, "temperature_2m_max": [34] * 4, "temperature_2m_min": [24] * 4,
                  "apparent_temperature_max": [36] * 4, "uv_index_max": [9] * 4,
                  "precipitation_probability_max": [0] * 4, "sunrise": [f"{x}T06:20" for x in days],
                  "sunset": [f"{x}T17:40" for x in days]},
        "current": {"temperature_2m": 30, "apparent_temperature": 33, "relative_humidity_2m": 30, "weather_code": 0,
                    "wind_speed_10m": 10, "uv_index": 7},
    }


def test_bands_follow_the_published_scales():
    assert rules.heat_band(None) == "unknown"
    assert [rules.heat_band(x) for x in (20, 27, 31.9, 32, 40, 52)] == [
        "comfortable", "caution", "caution", "extreme_caution", "danger", "extreme_danger"]
    assert [rules.uv_band(x) for x in (0, 3, 6, 8, 11)] == ["low", "moderate", "high", "very_high", "extreme"]


def test_good_hours_are_the_cool_runs_of_the_day():
    hours = [{"at": f"2026-11-14T{h:02d}:00", "feels": 36 if 9 <= h < 17 else 28, "uv": 0} for h in range(24)]
    # before 05:00 and from 23:00 do not count; 09:00–17:00 is too hot
    assert rules.good_windows(hours) == [{"from": "05:00", "to": "09:00"}, {"from": "17:00", "to": "23:00"}]
    # a strong sun spoils a cool hour
    hours = [{"at": f"2026-11-14T{h:02d}:00", "feels": 25, "uv": 7 if h == 12 else 2} for h in range(5, 23)]
    assert rules.good_windows(hours) == [{"from": "05:00", "to": "12:00"}, {"from": "13:00", "to": "23:00"}]


def test_the_report_starts_at_this_hour_and_says_when_it_is_old():
    raw = {c: _raw() for c in forecast.CITIES}
    fetched = datetime(2026, 11, 14, 6, 30, tzinfo=timezone.utc)  # 09:30 in Riyadh
    forecast.put(raw, at=fetched)
    r = forecast.report(now=fetched)
    mk = r["cities"]["makkah"]
    assert r["stale"] is False and r["source"] == "Open-Meteo"
    assert mk["hours"][0]["at"] == "2026-11-14T09:00" and len(mk["hours"]) == 24
    assert mk["now"]["heat"] == "extreme_caution" and mk["now"]["uv_band"] == "high"
    today = mk["days"][0]
    assert today["sunrise"] == "06:20" and today["heat"] == "extreme_caution" and today["uv"] == "very_high"
    assert today["good"][0]["from"] == "05:00" and today["good"][-1]["to"] == "23:00"
    assert forecast.report(now=fetched + timedelta(hours=4))["stale"] is True


def test_a_card_reads_the_weather_and_nothing_else_is_needed(client, op_a, monkeypatch):
    _, p = _pilgrim(client, op_a, code="U-PK-0901", passport="WX1234567")
    card, _ = _card(client, op_a, p["id"])
    forecast.put({c: _raw() for c in forecast.CITIES})
    r = client.get("/v1/rafeeq/weather", headers=card)
    assert r.status_code == 200 and set(r.json()["cities"]) == {"makkah", "madinah"}
    # no card, no weather
    assert client.get("/v1/rafeeq/weather").status_code == 401


def test_no_forecast_says_so(client, op_a, monkeypatch):
    _, p = _pilgrim(client, op_a, code="U-PK-0902", passport="WX7654321")
    card, _ = _card(client, op_a, p["id"])
    monkeypatch.setenv("DUYUF_WEATHER_URL", "off")
    monkeypatch.setitem(forecast._cache, "raw", None)
    monkeypatch.setitem(forecast._cache, "at", None)
    r = client.get("/v1/rafeeq/weather", headers=card)
    assert r.status_code == 503 and "not available" in r.json()["detail"]


def test_the_visa_date_reaches_the_page_and_the_import(client, op_a):
    g, p = _pilgrim(client, op_a, code="U-PK-0903", passport="VS1234567", departs="2026-12-20")
    r = client.patch(f"/v1/pilgrims/{p['id']}", headers=as_op(op_a), json={"visa_expires_on": "2027-01-10"})
    assert r.status_code == 200 and r.json()["visa_expires_on"] == "2027-01-10"
    card, _ = _card(client, op_a, p["id"])
    page = client.get("/v1/rafeeq/me", headers=card).json()
    assert page["visa_expires_on"] == "2027-01-10" and page["leaving_on"] == "2026-12-20"
    assert page["status"] == "registered"

    rows = [{"full_name": "Sara Ali", "gender": "F", "nationality": "PK", "passport_no": "VS7654321",
             "visa_expires_on": "10/01/2027"},
            {"full_name": "Omar Ali", "gender": "M", "nationality": "PK", "passport_no": "VS7654322",
             "visa_expires_on": "next week"}]
    r = client.post(f"/v1/groups/{g['id']}/pilgrims/import", headers=as_op(op_a), json={"rows": rows, "dry_run": True})
    assert r.json()["errors"] == [{"row": 2, "field": "visa_expires_on", "message": "a date like 2026-12-20 or 20/12/2026"}]
    rows[1]["visa_expires_on"] = ""
    r = client.post(f"/v1/groups/{g['id']}/pilgrims/import", headers=as_op(op_a), json={"rows": rows})
    assert r.json()["saved"] is True, r.json()
    got = {x["full_name"]: x["visa_expires_on"] for x in
           client.get("/v1/pilgrims", headers=as_op(op_a), params={"group_id": g["id"]}).json()["items"]}
    assert got["Sara Ali"] == "2027-01-10" and got["Omar Ali"] is None
