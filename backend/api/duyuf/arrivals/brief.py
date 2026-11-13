"""What a flight's pilgrims will need on the ground, worked out before it lands.

The rules are plain on purpose, so a desk lead can check them by hand. The web
app's sample mode uses the same numbers (frontend/src/domain/brief.ts), and a
test there reads this file, so the two cannot drift.
"""
from __future__ import annotations

import math
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Iterable
from zoneinfo import ZoneInfo

KSA = ZoneInfo("Asia/Riyadh")

BUS_SEATS = 49           # one standard pilgrim coach
INTERPRETER_EVERY = 40   # one interpreter for each 40 pilgrims of a language
OLDER_AGE = 75           # "over 75" on the brief
STAFF_LANGUAGES = ("ar", "en")  # the desk speaks these; no interpreter needed
SLOT_HOURS = 3           # the arrival wave, in blocks of this many hours


def age_on(born: date, day: date) -> int:
    return day.year - born.year - ((day.month, day.day) < (born.month, born.day))


def brief(pilgrims: Iterable[dict], on: date) -> dict:
    """Totals for the pilgrims on one flight landing on `on` (the Saudi date).

    Each pilgrim needs `status`, `needs`, `date_of_birth` and `language`, read
    from the database, never from a masked row: the counts are aggregates, so
    every role may see them.
    """
    people = list(pilgrims)
    needs = Counter(n for p in people for n in p["needs"])
    known_age = [p for p in people if p["date_of_birth"]]
    langs = Counter(p["language"] for p in people)
    languages = [
        {"language": lang, "pilgrims": n,
         "interpreters": math.ceil(n / INTERPRETER_EVERY) if lang and lang not in STAFF_LANGUAGES else 0}
        for lang, n in sorted(langs.items(), key=lambda kv: (-kv[1], kv[0] or "~"))
    ]
    return {
        "pilgrims": len(people),
        "over_75": sum(1 for p in known_age if age_on(p["date_of_birth"], on) >= OLDER_AGE),
        "unknown_age": len(people) - len(known_age),
        "wheelchair": needs["wheelchair"],
        "medical": needs["medical"],
        "dietary": needs["dietary"],
        "minor_alone": needs["unaccompanied_minor"],
        "no_visa": sum(1 for p in people if p["status"] == "registered"),
        "buses": math.ceil(len(people) / BUS_SEATS),
        "interpreters": sum(x["interpreters"] for x in languages),
        "languages": languages,
    }


def state(expected_at: datetime, scheduled_at: datetime, landed_at: datetime | None, now: datetime) -> str:
    """on_time, delayed, due (the landing time has passed, nobody confirmed it) or landed."""
    if landed_at:
        return "landed"
    if expected_at <= now:
        return "due"
    return "delayed" if expected_at > scheduled_at else "on_time"


def slot_start(now: datetime) -> datetime:
    """The start of the wave block `now` falls in, on the Saudi clock."""
    local = now.astimezone(KSA)
    return local.replace(hour=local.hour - local.hour % SLOT_HOURS, minute=0, second=0, microsecond=0)


def waves(flights: list[dict], now: datetime, hours: int) -> list[dict]:
    """Pilgrims landing in each block from now to `hours` ahead, by airport.

    Flights already confirmed down are left out; so are any still unconfirmed
    from before the first block (they are on the board as "due").
    """
    first = slot_start(now)
    end = now + timedelta(hours=hours)
    count = math.ceil((end - first) / timedelta(hours=SLOT_HOURS))
    slots = [{"start": first + timedelta(hours=SLOT_HOURS * i), "by_airport": {}} for i in range(count)]
    for f in flights:
        if f["landed_at"] or not first <= f["expected_at"] < end:
            continue
        i = int((f["expected_at"] - first) / timedelta(hours=SLOT_HOURS))
        by = slots[i]["by_airport"]
        by[f["arrival_airport"]] = by.get(f["arrival_airport"], 0) + f["brief"]["pilgrims"]
    return slots
