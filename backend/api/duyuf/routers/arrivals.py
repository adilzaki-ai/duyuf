"""Arrivals: the flights an operator's pilgrims land on, and what each will need.

The board answers four questions before wheels down: who is landing and when,
what support they need, whether anyone is missing a visa or a flight, and
what to do next. It is advisory: nothing here moves a pilgrim except
"landed", which a person on the ground presses.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from psycopg.types.json import Jsonb

from ..arrivals.brief import KSA, SLOT_HOURS, brief, slot_start, state, waves
from ..arrivals.plan import load
from ..core.auth import Identity, require
from ..core.db import tenant_session
from ..pilgrims.status import refusal

router = APIRouter(prefix="/v1", tags=["arrivals"])

# Pilgrims not yet in the Kingdom: the only ones a flight can still carry.
PRE_ARRIVAL = ("registered", "visa_issued")
# A flight nobody confirmed stays on the board this long after its time.
DUE_GRACE = timedelta(hours=48)
# A confirmed one, this long.
LANDED_GRACE = timedelta(hours=6)

_FLIGHT_COLS = """f.id::text, f.number, f.origin_airport, f.arrival_airport, f.scheduled_at,
                  f.estimated_at, f.landed_at, f.note, f.terminal, f.gate,
                  coalesce(f.estimated_at, f.scheduled_at) AS expected_at"""


def _now(conn) -> datetime:
    return conn.execute("SELECT now() AS n").fetchone()["n"]


def _flights(conn, where: str, params: tuple | list, now: datetime) -> list[dict]:
    """Flights with their groups and brief, soonest first."""
    rows = conn.execute(f"SELECT {_FLIGHT_COLS} FROM flight f {where} "
                        "ORDER BY coalesce(f.estimated_at, f.scheduled_at), f.number", params).fetchall()
    if not rows:
        return []
    people = conn.execute(
        """SELECT p.arrival_flight_id::text AS flight_id, g.id::text AS group_id, g.code, g.name,
                  p.status, p.needs, p.date_of_birth, p.language
             FROM pilgrim p JOIN pilgrim_group g ON g.id = p.group_id
            WHERE p.arrival_flight_id = ANY(%s::uuid[])""", ([r["id"] for r in rows],)).fetchall()
    on = defaultdict(list)
    for p in people:
        on[p["flight_id"]].append(p)
    out = []
    for r in rows:
        mine = on[r["id"]]
        groups: dict[str, dict] = {}
        for p in mine:
            g = groups.setdefault(p["group_id"], {"id": p["group_id"], "code": p["code"],
                                                  "name": p["name"], "pilgrims": 0})
            g["pilgrims"] += 1
        delay = int((r["expected_at"] - r["scheduled_at"]).total_seconds() // 60)
        out.append({
            **r,
            "delay_minutes": delay,
            "state": state(r["expected_at"], r["scheduled_at"], r["landed_at"], now),
            "groups": sorted(groups.values(), key=lambda g: g["code"]),
            "brief": brief(mine, r["expected_at"].astimezone(KSA).date()),
        })
    return out


def _detail(conn, flight_id: str) -> dict:
    found = _flights(conn, "WHERE f.id = %s", (flight_id,), _now(conn))
    if not found:
        raise HTTPException(404, "no such flight")
    out = found[0]
    out["history"] = conn.execute(
        "SELECT kind, detail, actor, at FROM flight_event WHERE flight_id = %s ORDER BY at, id",
        (flight_id,)).fetchall()
    return out


def _event(conn, flight_id: str, kind: str, detail: dict, who: Identity) -> None:
    conn.execute("INSERT INTO flight_event (flight_id, kind, detail, actor) VALUES (%s, %s, %s, %s)",
                 (flight_id, kind, Jsonb(detail), who.display_name))


def _locked(conn, flight_id: str) -> dict:
    row = conn.execute("SELECT id::text, number, landed_at FROM flight WHERE id = %s FOR UPDATE",
                       (flight_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such flight")
    return row


def _on_board(f: dict, now: datetime, until: datetime) -> bool:
    """Lands before `until`, and is still to come, unconfirmed (for two days) or just down."""
    e = f["expected_at"]
    if e >= until:
        return False
    return (e >= now or (not f["landed_at"] and e >= now - DUE_GRACE)
            or (f["landed_at"] is not None and f["landed_at"] >= now - LANDED_GRACE))


def _board(conn, hours: int, delays: dict[str, int] | None = None, extra: list[dict] | None = None) -> dict:
    """The arrivals board. With `delays` (flight id → minutes later) and `extra`
    resources (for the whole window), the same board as it would be: nothing
    is written."""
    delays = delays or {}
    now = _now(conn)
    until = now + timedelta(hours=hours)
    latest = timedelta(minutes=max(delays.values(), default=0))
    flights = _flights(conn, "WHERE coalesce(f.estimated_at, f.scheduled_at) BETWEEN %s AND %s",
                       (now - DUE_GRACE - latest, until), now)
    for f in flights:
        if f["id"] in delays and not f["landed_at"]:
            f["expected_at"] = f["estimated_at"] = f["expected_at"] + timedelta(minutes=delays[f["id"]])
            f["delay_minutes"] = int((f["expected_at"] - f["scheduled_at"]).total_seconds() // 60)
            f["state"] = state(f["expected_at"], f["scheduled_at"], f["landed_at"], now)
    flights = sorted((f for f in flights if _on_board(f, now, until)), key=lambda f: (f["expected_at"], f["number"]))

    shifts = conn.execute(
        "SELECT airport, kind, language, quantity, starts_at, ends_at FROM resource_shift "
        "WHERE ends_at > %s AND starts_at < %s", (now - timedelta(hours=SLOT_HOURS), until)).fetchall()
    forever = (now - timedelta(days=3650), now + timedelta(days=3650))
    shifts += [{**x, "starts_at": forever[0], "ends_at": forever[1]} for x in (extra or [])]
    rows = load(flights, shifts, now, hours)
    gap_at = {(r["airport"], r["start"]) for r in rows if r["short"]}
    first = slot_start(now)
    block = timedelta(hours=SLOT_HOURS)
    for f in flights:
        f["short"] = (not f["landed_at"] and f["expected_at"] >= first
                      and (f["arrival_airport"], first + block * int((f["expected_at"] - first) / block)) in gap_at)

    # Groups landing in the window with pilgrims who are on no flight yet.
    unplanned = conn.execute("""
        SELECT g.id::text, g.code, g.name, g.arrival_date, count(*)::int AS without_flight
          FROM pilgrim_group g JOIN pilgrim p ON p.group_id = g.id
         WHERE g.arrival_date BETWEEN %s AND %s
           AND p.arrival_flight_id IS NULL AND p.status = ANY(%s)
         GROUP BY g.id ORDER BY g.arrival_date, g.code""",
        (now.astimezone(KSA).date(), until.astimezone(KSA).date(), list(PRE_ARRIVAL))).fetchall()
    return {
        "now": now,
        "hours": hours,
        "slot_hours": SLOT_HOURS,
        "flights": flights,
        "waves": waves(flights, now, hours),
        "load": rows,
        "unplanned": unplanned,
        "what_if": bool(delays or extra),
    }


@router.get("/arrivals")
def arrivals(hours: int = Query(default=48, ge=6, le=168), who: Identity = Depends(require("flight:read"))):
    with tenant_session(who.tenant_id) as conn:
        return _board(conn, hours)


class Delay(BaseModel):
    flight_id: str
    minutes: int = Field(ge=0, le=24 * 60)


class Extra(BaseModel):
    airport: str = Field(pattern=r"^[A-Z]{3}$")
    kind: Literal["wheelchair", "bus", "interpreter"]
    language: str | None = Field(default=None, pattern=r"^[a-z]{2}$")
    quantity: int = Field(ge=1, le=1000)

    @model_validator(mode="after")
    def _language(self):
        if (self.kind == "interpreter") != (self.language is not None):
            raise ValueError("an interpreter needs a language; nothing else has one")
        return self


class WhatIf(BaseModel):
    hours: int = Field(default=48, ge=6, le=168)
    delays: list[Delay] = Field(default=[], max_length=50)
    extra: list[Extra] = Field(default=[], max_length=50)


@router.post("/arrivals/what-if")
def what_if(body: WhatIf, who: Identity = Depends(require("flight:read"))):
    """The board as it would be if these flights were later and these resources
    were added. Read-only: any role may ask, and nothing is saved."""
    with tenant_session(who.tenant_id) as conn:
        return _board(conn, body.hours, {d.flight_id: d.minutes for d in body.delays},
                      [x.model_dump() for x in body.extra])


@router.get("/flights/{flight_id}")
def get_flight(flight_id: str, who: Identity = Depends(require("flight:read"))):
    with tenant_session(who.tenant_id) as conn:
        return _detail(conn, flight_id)


_NUMBER = re.compile(r"^([A-Z0-9]{2}[A-Z]?)\s*([0-9]{1,4}[A-Z]?)$")


def _as_ksa(v: datetime | None) -> datetime | None:
    """A time with no zone is a Saudi time: that is the clock the desk reads."""
    return v.replace(tzinfo=KSA) if v is not None and v.tzinfo is None else v


_GATE = re.compile(r"^[A-Z0-9][A-Z0-9-]{0,7}$")


def _terminal(v: str | None) -> str | None:
    """Blank is "not given yet"; a name is kept as the airport writes it."""
    v = " ".join(v.split()) if v else ""
    if len(v) > 40:
        raise ValueError("a terminal name is at most 40 letters")
    return v or None


def _gate(v: str | None) -> str | None:
    v = v.strip().upper().replace(" ", "") if v else ""
    if v and not _GATE.match(v):
        raise ValueError("a gate is letters and digits, like H12")
    return v or None


class FlightIn(BaseModel):
    number: str
    origin_airport: str = Field(pattern=r"^[A-Za-z]{3}$")
    arrival_airport: str = Field(pattern=r"^[A-Za-z]{3}$")
    scheduled_at: datetime
    terminal: str | None = None
    gate: str | None = None
    note: str | None = None

    @field_validator("terminal")
    @classmethod
    def _where(cls, v: str | None) -> str | None:
        return _terminal(v)

    @field_validator("gate")
    @classmethod
    def _at_gate(cls, v: str | None) -> str | None:
        return _gate(v)

    @field_validator("number")
    @classmethod
    def _number(cls, v: str) -> str:
        m = _NUMBER.match(v.strip().upper())
        if not m:
            raise ValueError("a flight number looks like SV 3102: airline code, then number")
        return f"{m[1]} {m[2]}"

    @field_validator("origin_airport", "arrival_airport")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    @field_validator("scheduled_at")
    @classmethod
    def _zone(cls, v: datetime) -> datetime:
        return _as_ksa(v)


class FlightPatch(BaseModel):
    estimated_at: datetime | None = None
    terminal: str | None = None
    gate: str | None = None
    note: str | None = None

    @field_validator("terminal")
    @classmethod
    def _where(cls, v: str | None) -> str | None:
        return _terminal(v)

    @field_validator("gate")
    @classmethod
    def _at_gate(cls, v: str | None) -> str | None:
        return _gate(v)

    @field_validator("estimated_at")
    @classmethod
    def _zone(cls, v: datetime | None) -> datetime | None:
        return _as_ksa(v)


class Assign(BaseModel):
    group_id: str | None = None
    pilgrim_ids: list[str] | None = Field(default=None, min_length=1, max_length=500)

    @model_validator(mode="after")
    def _one(self):
        if (self.group_id is None) == (self.pilgrim_ids is None):
            raise ValueError("send a group_id or a list of pilgrim_ids, not both")
        return self


class Landed(BaseModel):
    note: str | None = None


@router.post("/flights", status_code=201)
def create_flight(body: FlightIn, who: Identity = Depends(require("flight:write"))):
    with tenant_session(who.tenant_id) as conn:
        fid = conn.execute(
            """INSERT INTO flight (number, origin_airport, arrival_airport, scheduled_at, terminal, gate, note)
               VALUES (%(number)s, %(origin_airport)s, %(arrival_airport)s, %(scheduled_at)s,
                       %(terminal)s, %(gate)s, %(note)s)
               RETURNING id::text""", body.model_dump()).fetchone()["id"]
        _event(conn, fid, "created", {"scheduled_at": body.scheduled_at.isoformat()}, who)
        return _detail(conn, fid)


@router.patch("/flights/{flight_id}")
def update_flight(flight_id: str, body: FlightPatch, who: Identity = Depends(require("flight:write"))):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "nothing to change")
    with tenant_session(who.tenant_id) as conn:
        f = _locked(conn, flight_id)
        if "estimated_at" in changes and f["landed_at"]:
            raise HTTPException(409, f"{f['number']} has landed; its time is no longer an estimate")
        sets = ", ".join(f"{k} = %({k})s" for k in changes)
        conn.execute(f"UPDATE flight SET {sets}, updated_at = now() WHERE id = %(id)s", {**changes, "id": flight_id})
        if "estimated_at" in changes:
            at = changes["estimated_at"]
            _event(conn, flight_id, "expected", {"expected_at": at.isoformat() if at else None}, who)
        if "terminal" in changes or "gate" in changes:
            now = conn.execute("SELECT terminal, gate FROM flight WHERE id = %s", (flight_id,)).fetchone()
            _event(conn, flight_id, "gate", dict(now), who)
        return _detail(conn, flight_id)


@router.post("/flights/{flight_id}/pilgrims")
def assign(flight_id: str, body: Assign, who: Identity = Depends(require("flight:write"))):
    """Put pilgrims on this flight: a group's pilgrims not yet on any flight, or
    named pilgrims (moved from another flight if they were on one). Only
    pilgrims not yet in the Kingdom can be put on an arrival flight."""
    with tenant_session(who.tenant_id) as conn:
        f = _locked(conn, flight_id)
        if f["landed_at"]:
            raise HTTPException(409, f"{f['number']} has landed; put these pilgrims on another flight")
        if body.group_id:
            group = conn.execute("SELECT code FROM pilgrim_group WHERE id = %s", (body.group_id,)).fetchone()
            if not group:
                raise HTTPException(404, "no such group")
            rows = conn.execute(
                """UPDATE pilgrim SET arrival_flight_id = %s, updated_at = now()
                    WHERE group_id = %s AND arrival_flight_id IS NULL AND status = ANY(%s)
                    RETURNING id""", (flight_id, body.group_id, list(PRE_ARRIVAL))).fetchall()
            detail = {"added": len(rows), "group": group["code"]}
        else:
            found = conn.execute("SELECT id::text, full_name, status FROM pilgrim WHERE id = ANY(%s::uuid[])",
                                 (body.pilgrim_ids,)).fetchall()
            missing = set(body.pilgrim_ids) - {r["id"] for r in found}
            if missing:
                raise HTTPException(404, f"no such pilgrim: {', '.join(sorted(missing))}")
            landed = [r["full_name"] for r in found if r["status"] not in PRE_ARRIVAL]
            if landed:
                raise HTTPException(409, f"already in the Kingdom or gone home: {', '.join(landed)}")
            rows = conn.execute("UPDATE pilgrim SET arrival_flight_id = %s, updated_at = now() "
                                "WHERE id = ANY(%s::uuid[]) RETURNING id",
                                (flight_id, body.pilgrim_ids)).fetchall()
            detail = {"added": len(rows)}
        if rows:
            _event(conn, flight_id, "added", detail, who)
        return {**_detail(conn, flight_id), "added": len(rows)}


@router.post("/flights/{flight_id}/landed")
def landed(flight_id: str, body: Landed, who: Identity = Depends(require("pilgrim:status"))):
    """The flight is down. Everyone on it with a visa moves to "arrived", one
    journey step each, in each pilgrim's own history. Anyone without a visa
    stays where they are, and the answer says how many."""
    with tenant_session(who.tenant_id) as conn:
        f = _locked(conn, flight_id)
        if f["landed_at"]:
            raise HTTPException(409, f"{f['number']} was already marked landed")
        conn.execute("UPDATE flight SET landed_at = now(), updated_at = now() WHERE id = %s", (flight_id,))
        on_board = conn.execute("SELECT id, status FROM pilgrim WHERE arrival_flight_id = %s FOR UPDATE",
                                (flight_id,)).fetchall()
        moving = [p for p in on_board if refusal(p["status"], "arrived") is None]
        note = body.note or f"Flight {f['number']} landed"
        if moving:
            ids = [p["id"] for p in moving]
            conn.execute("UPDATE pilgrim SET status = 'arrived', updated_at = now() WHERE id = ANY(%s)", (ids,))
            conn.execute(
                """INSERT INTO pilgrim_event (pilgrim_id, from_status, to_status, note, actor)
                   SELECT id, was, 'arrived', %s, %s FROM unnest(%s::uuid[], %s::text[]) AS m(id, was)""",
                (note, who.display_name, ids, [p["status"] for p in moving]))
        held = sum(1 for p in on_board if p["status"] == "registered")
        _event(conn, flight_id, "landed", {"arrived": len(moving), "no_visa": held}, who)
        return {**_detail(conn, flight_id), "arrived": len(moving), "no_visa": held}

