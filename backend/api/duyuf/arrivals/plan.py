"""Need against what is on shift, block by block: where the gaps are.

The rule, plain enough to check by hand:

- Each flight holds the wheelchairs, buses and interpreters its brief asks for
  through the whole block it lands in (SLOT_HOURS long, on the Saudi clock).
  Flights landing in the same block at the same airport add up.
- A shift counts for a block when it covers the whole block.
- An interpreter covers their own language only.

Flights already confirmed down need nothing. The web app's sample mode uses the
same rule (frontend/src/domain/plan.ts); both sides test it on the same cases.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from .brief import SLOT_HOURS, slot_start

KINDS = ("wheelchair", "bus", "interpreter")


def need_of(brief: dict) -> dict:
    return {
        "wheelchair": brief["wheelchair"],
        "bus": brief["buses"],
        "interpreter": {l["language"]: l["interpreters"] for l in brief["languages"] if l["interpreters"]},
    }


def _empty() -> dict:
    return {"wheelchair": 0, "bus": 0, "interpreter": {}}


def _add(into: dict, more: dict) -> None:
    into["wheelchair"] += more["wheelchair"]
    into["bus"] += more["bus"]
    for lang, n in more["interpreter"].items():
        into["interpreter"][lang] = into["interpreter"].get(lang, 0) + n


def on_shift(shifts: list[dict], airport: str, start: datetime, end: datetime) -> dict:
    """What is at `airport` for the whole of [start, end)."""
    have = _empty()
    for s in shifts:
        if s["airport"] != airport or s["starts_at"] > start or s["ends_at"] < end:
            continue
        if s["kind"] == "interpreter":
            have["interpreter"][s["language"]] = have["interpreter"].get(s["language"], 0) + s["quantity"]
        else:
            have[s["kind"]] += s["quantity"]
    return have


def short_of(need: dict, have: dict) -> list[dict]:
    out = []
    for kind in ("wheelchair", "bus"):
        if need[kind] > have[kind]:
            out.append({"kind": kind, "language": None, "short": need[kind] - have[kind]})
    for lang, n in sorted(need["interpreter"].items()):
        if n > have["interpreter"].get(lang, 0):
            out.append({"kind": "interpreter", "language": lang, "short": n - have["interpreter"].get(lang, 0)})
    return out


def load(flights: list[dict], shifts: list[dict], now: datetime, hours: int) -> list[dict]:
    """One row for each airport and block with a flight landing in it, soonest first."""
    first = slot_start(now)
    end = now + timedelta(hours=hours)
    block = timedelta(hours=SLOT_HOURS)
    rows: dict[tuple, dict] = {}
    for f in flights:
        if f["landed_at"] or not first <= f["expected_at"] < end:
            continue
        start = first + block * int((f["expected_at"] - first) / block)
        row = rows.setdefault((start, f["arrival_airport"]), {
            "airport": f["arrival_airport"], "start": start, "flights": [], "need": _empty()})
        row["flights"].append(f["number"])
        _add(row["need"], need_of(f["brief"]))
    out = []
    for (start, airport), row in sorted(rows.items()):
        row["have"] = on_shift(shifts, airport, start, start + block)
        row["short"] = short_of(row["need"], row["have"])
        out.append(row)
    return out
