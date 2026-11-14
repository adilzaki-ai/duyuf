"""Flights home, places to eat, stay and visit, and bookings.

Staff enter each group's flights home leg by leg, keep the list of places
the operator offers, and answer pilgrims' booking requests. Pilgrims see the
places and ask for a booking from Rafeeq (the /v1/rafeeq/* routes here take
their card, like the rest of Rafeeq), pay online where the operator can take
payment, and follow the answer.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator

from .. import payments
from ..arrivals.brief import KSA
from ..bookings.flow import (ACCESS, BEDS, BOOKINGS_PER_DAY, DAYS_AHEAD, EXTRAS, KINDS, MOVES, PILGRIM_CANCEL_FROM,
                             ROOM_TYPES, SLEEPS, STAFF_ACTIONS, refusal)
from ..core.auth import CardHolder, Identity, card_holder, require
from ..core.db import tenant_session

router = APIRouter(tags=["bookings"])

ACTOR = "Pilgrim, on Rafeeq"
CITIES = ("makkah", "madinah")


# ---- flights home ----

class LegIn(BaseModel):
    flight_number: str = Field(pattern=r"^[A-Z0-9]{2}[A-Z]? [0-9]{1,4}[A-Z]?$")
    from_airport: str = Field(pattern=r"^[A-Z]{3}$")
    to_airport: str = Field(pattern=r"^[A-Z]{3}$")
    departs_at: datetime
    arrives_at: datetime | None = None

    @field_validator("flight_number", "from_airport", "to_airport", mode="before")
    @classmethod
    def _upper(cls, v):
        return " ".join(str(v or "").upper().split())

    @model_validator(mode="after")
    def _times(self):
        if self.departs_at.tzinfo is None:
            self.departs_at = self.departs_at.replace(tzinfo=KSA)
        if self.arrives_at is not None and self.arrives_at.tzinfo is None:
            raise ValueError("give the arrival time with its time zone (it lands in another country)")
        if self.arrives_at is not None and self.arrives_at <= self.departs_at:
            raise ValueError("a flight lands after it leaves")
        if self.from_airport == self.to_airport:
            raise ValueError("a flight goes from one airport to another")
        return self


class LegsIn(BaseModel):
    legs: list[LegIn] = Field(max_length=6)

    @model_validator(mode="after")
    def _chain(self):
        for a, b in zip(self.legs, self.legs[1:]):
            if b.departs_at <= a.departs_at:
                raise ValueError("list the legs in the order they fly")
            if b.from_airport != a.to_airport:
                raise ValueError(f"leg {self.legs.index(b) + 1} should leave from {a.to_airport}, where the one before lands")
        return self


def legs_of(conn, group_id: str) -> list[dict]:
    return conn.execute(
        """SELECT seq, flight_number, from_airport, to_airport, departs_at, arrives_at FROM return_leg
            WHERE group_id = %s ORDER BY seq""", (group_id,)).fetchall()


@router.get("/v1/groups/{group_id}/return-legs")
def return_legs(group_id: str, who: Identity = Depends(require("group:read"))):
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("SELECT 1 FROM pilgrim_group WHERE id = %s", (group_id,)).fetchone():
            raise HTTPException(404, "no such group")
        return {"legs": legs_of(conn, group_id)}


@router.put("/v1/groups/{group_id}/return-legs")
def set_return_legs(group_id: str, body: LegsIn, who: Identity = Depends(require("group:write"))):
    """The group's flights home, all legs at once, in the order they fly. An empty list clears them."""
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("SELECT 1 FROM pilgrim_group WHERE id = %s FOR UPDATE", (group_id,)).fetchone():
            raise HTTPException(404, "no such group")
        conn.execute("DELETE FROM return_leg WHERE group_id = %s", (group_id,))
        for i, leg in enumerate(body.legs, start=1):
            conn.execute(
                """INSERT INTO return_leg (group_id, seq, flight_number, from_airport, to_airport, departs_at, arrives_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (group_id, i, leg.flight_number, leg.from_airport, leg.to_airport, leg.departs_at, leg.arrives_at))
        return {"legs": legs_of(conn, group_id)}


# ---- places ----

_VENUE_COLS = """v.id::text, v.kind, v.city, v.name, v.name_ar, v.stars, v.price_level, v.cuisine,
                 v.rating::float AS rating, v.rating_count, v.rating_source, v.site_id, v.phone, v.whatsapp,
                 v.email, v.website, v.address, v.lat, v.lon, v.price_from::float AS price_from, v.bookable, v.active,
                 v.room_types, v.accessibility, v.photos"""


Photo = Annotated[str, StringConstraints(pattern=r"^https://\S+$", max_length=500)]


class VenueIn(BaseModel):
    kind: Literal[KINDS]  # type: ignore[valid-type]
    city: Literal[CITIES]  # type: ignore[valid-type]
    name: str = Field(min_length=1, max_length=120)
    name_ar: str | None = Field(default=None, max_length=120)
    stars: int | None = Field(default=None, ge=1, le=5)
    price_level: int | None = Field(default=None, ge=1, le=4)
    cuisine: str | None = Field(default=None, max_length=60)
    rating: float | None = Field(default=None, ge=0, le=5)
    rating_count: int | None = Field(default=None, ge=0)
    rating_source: str | None = Field(default=None, max_length=40)
    site_id: str | None = Field(default=None, pattern=r"^[a-z_]{2,30}$")
    phone: str | None = Field(default=None, max_length=30)
    whatsapp: str | None = Field(default=None, pattern=r"^\+?[0-9 ]{6,20}$")
    email: str | None = Field(default=None, max_length=120)
    website: str | None = Field(default=None, pattern=r"^https://")
    address: str | None = Field(default=None, max_length=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    price_from: float | None = Field(default=None, ge=0)
    bookable: bool = True
    active: bool = True
    room_types: list[Literal[ROOM_TYPES]] = []  # type: ignore[valid-type]
    accessibility: list[Literal[ACCESS]] = []  # type: ignore[valid-type]
    # links to the place's own photos; https only
    photos: list[Photo] = Field(default=[], max_length=8)

    @model_validator(mode="after")
    def _rules(self):
        if self.rating is not None and not self.rating_source:
            raise ValueError("say where the rating comes from (rating_source)")
        if self.stars is not None and self.kind != "hotel":
            raise ValueError("stars are for hotels")
        if self.room_types and self.kind != "hotel":
            raise ValueError("room types are for hotels")
        return self


class VenuePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    name_ar: str | None = None
    stars: int | None = Field(default=None, ge=1, le=5)
    price_level: int | None = Field(default=None, ge=1, le=4)
    cuisine: str | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    rating_count: int | None = Field(default=None, ge=0)
    rating_source: str | None = None
    phone: str | None = None
    whatsapp: str | None = Field(default=None, pattern=r"^\+?[0-9 ]{6,20}$")
    email: str | None = None
    website: str | None = Field(default=None, pattern=r"^https://")
    address: str | None = None
    price_from: float | None = Field(default=None, ge=0)
    bookable: bool | None = None
    active: bool | None = None
    room_types: list[Literal[ROOM_TYPES]] | None = None  # type: ignore[valid-type]
    accessibility: list[Literal[ACCESS]] | None = None  # type: ignore[valid-type]
    photos: list[Photo] | None = Field(default=None, max_length=8)


def _venues(conn, kind: str | None, city: str | None, active_only: bool) -> list[dict]:
    where, args = [], []
    if kind:
        where.append("v.kind = %s")
        args.append(kind)
    if city:
        where.append("v.city = %s")
        args.append(city)
    if active_only:
        where.append("v.active")
    sql = f"SELECT {_VENUE_COLS} FROM venue v {'WHERE ' + ' AND '.join(where) if where else ''} " \
          "ORDER BY v.kind, v.city, v.rating DESC NULLS LAST, v.name"
    return conn.execute(sql, args).fetchall()


@router.get("/v1/venues")
def list_venues(kind: Literal[KINDS] | None = None, city: Literal[CITIES] | None = None,  # type: ignore[valid-type]
                who: Identity = Depends(require("booking:read"))):
    with tenant_session(who.tenant_id) as conn:
        return {"venues": _venues(conn, kind, city, active_only=False)}


@router.post("/v1/venues", status_code=201)
def add_venue(body: VenueIn, who: Identity = Depends(require("venue:write"))):
    with tenant_session(who.tenant_id) as conn:
        d = body.model_dump()
        cols = ", ".join(d)
        vid = conn.execute(f"INSERT INTO venue ({cols}) VALUES ({', '.join(f'%({k})s' for k in d)}) RETURNING id::text",
                           d).fetchone()["id"]
        return conn.execute(f"SELECT {_VENUE_COLS} FROM venue v WHERE v.id = %s", (vid,)).fetchone()


@router.patch("/v1/venues/{venue_id}")
def update_venue(venue_id: str, body: VenuePatch, who: Identity = Depends(require("venue:write"))):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "nothing to change")
    sets = ", ".join(f"{k} = %({k})s" for k in changes)
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute(f"UPDATE venue SET {sets}, updated_at = now() WHERE id = %(id)s RETURNING id",
                            {**changes, "id": venue_id}).fetchone():
            raise HTTPException(404, "no such place")
        return conn.execute(f"SELECT {_VENUE_COLS} FROM venue v WHERE v.id = %s", (venue_id,)).fetchone()


# ---- bookings: staff ----

_BOOKING_COLS = """b.id::text, b.ref, b.for_date, b.at_time, b.nights, b.people, b.note, b.status,
                   b.rooms, b.room_type, b.bed, b.access_needs, b.extras,
                   b.amount::float AS amount, b.currency, b.pay_at, b.payment_status, b.payment_provider,
                   b.payment_ref, b.paid_at, b.staff_note, b.requested_at, b.updated_at,
                   jsonb_build_object('id', v.id, 'kind', v.kind, 'city', v.city, 'name', v.name,
                                      'name_ar', v.name_ar, 'phone', v.phone, 'site_id', v.site_id) AS venue"""
_BOOKING_FROM = "booking b JOIN venue v ON v.id = b.venue_id"


def _staff_rows(conn, where: str = "", args: tuple = ()) -> list[dict]:
    return conn.execute(
        f"""SELECT {_BOOKING_COLS}, p.id::text AS pilgrim_id, p.full_name, p.full_name_ar,
                   g.code AS group_code, g.id::text AS group_id
              FROM {_BOOKING_FROM} JOIN pilgrim p ON p.id = b.pilgrim_id JOIN pilgrim_group g ON g.id = p.group_id
              {where}
             ORDER BY (b.status IN ('requested', 'awaiting_payment')) DESC, b.requested_at DESC LIMIT 300""",
        args).fetchall()


def _event(conn, booking_id: str, kind: str, actor: str, note: str | None = None) -> None:
    conn.execute("INSERT INTO booking_event (booking_id, kind, note, actor) VALUES (%s, %s, %s, %s)",
                 (booking_id, kind, note, actor))


@router.get("/v1/bookings")
def list_bookings(open_only: bool = Query(default=False, alias="open"), who: Identity = Depends(require("booking:read"))):
    """Requests waiting for an answer and those waiting for payment first, then the rest, newest first."""
    with tenant_session(who.tenant_id) as conn:
        rows = _staff_rows(conn, "WHERE b.status IN ('requested', 'awaiting_payment')" if open_only else "")
        waiting = conn.execute("SELECT count(*)::int AS n FROM booking WHERE status = 'requested'").fetchone()["n"]
        return {"bookings": rows, "waiting": waiting}


@router.get("/v1/bookings/{booking_id}")
def get_booking(booking_id: str, who: Identity = Depends(require("booking:read"))):
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("SELECT 1 FROM booking WHERE id = %s", (booking_id,)).fetchone():
            raise HTTPException(404, "no such booking")
        return _one_staff(conn, booking_id)


class DecideIn(BaseModel):
    action: Literal[STAFF_ACTIONS]  # type: ignore[valid-type]
    # ask_payment: what to pay online, in SAR. confirm: what they will pay at the place, if known.
    amount: float | None = Field(default=None, ge=0, le=500_000)
    # what the pilgrim reads: "Table by the window", "Sold out that night"
    note: str | None = Field(default=None, max_length=500)


@router.post("/v1/bookings/{booking_id}/decide")
def decide(booking_id: str, body: DecideIn, who: Identity = Depends(require("booking:write"))):
    with tenant_session(who.tenant_id) as conn:
        b = conn.execute("SELECT status, payment_status FROM booking WHERE id = %s FOR UPDATE", (booking_id,)).fetchone()
        if not b:
            raise HTTPException(404, "no such booking")
        why = refusal(b["status"], body.action)
        if why:
            raise HTTPException(409, why)
        to = MOVES[body.action][1]
        if body.action == "ask_payment":
            if not body.amount:
                raise HTTPException(422, "say how much to pay online")
            if not payments.mode(who.is_demo):
                raise HTTPException(409, "online payment is not set up for this operator; confirm it to be paid at the place")
            conn.execute("""UPDATE booking SET status = %s, amount = %s, pay_at = 'online', staff_note = %s,
                                   updated_at = now() WHERE id = %s""", (to, body.amount, body.note, booking_id))
        elif body.action == "confirm":
            conn.execute("""UPDATE booking SET status = %s, amount = %s, pay_at = 'venue', staff_note = %s,
                                   updated_at = now() WHERE id = %s""", (to, body.amount, body.note, booking_id))
        else:
            refund = b["payment_status"] == "paid"
            conn.execute("""UPDATE booking SET status = %s, staff_note = coalesce(%s, staff_note),
                                   payment_status = CASE WHEN payment_status = 'paid' THEN 'refund_due' ELSE payment_status END,
                                   updated_at = now() WHERE id = %s""", (to, body.note, booking_id))
            if refund:
                _event(conn, booking_id, "note", who.display_name, "Paid online: the money is due back to the pilgrim.")
        _event(conn, booking_id, to, who.display_name, body.note)
        return _one_staff(conn, booking_id)


def _one_staff(conn, booking_id: str) -> dict:
    row = _staff_rows(conn, "WHERE b.id = %s", (booking_id,))[0]
    events = conn.execute("SELECT kind, note, actor, at FROM booking_event WHERE booking_id = %s ORDER BY at, id",
                          (booking_id,)).fetchall()
    return {**row, "history": events}


# ---- the pilgrim, on Rafeeq ----

@router.get("/v1/rafeeq/venues")
def rafeeq_venues(kind: Literal[KINDS] | None = None, city: Literal[CITIES] | None = None,  # type: ignore[valid-type]
                  card: CardHolder = Depends(card_holder)):
    """The places this operator offers, and whether its pilgrims can pay online."""
    with tenant_session(card.tenant_id) as conn:
        return {"venues": _venues(conn, kind, city, active_only=True),
                "payments": {"online": payments.mode(card.is_demo)}}


def _mine(conn, card: CardHolder) -> list[dict]:
    return conn.execute(
        f"""SELECT {_BOOKING_COLS} FROM {_BOOKING_FROM}
             WHERE b.pilgrim_id = %s AND (b.status IN ('requested', 'awaiting_payment', 'confirmed')
                                          OR b.updated_at > now() - interval '3 days')
             ORDER BY b.for_date, b.at_time NULLS FIRST, b.requested_at LIMIT 30""", (card.pilgrim_id,)).fetchall()


@router.get("/v1/rafeeq/bookings")
def my_bookings(card: CardHolder = Depends(card_holder)):
    with tenant_session(card.tenant_id) as conn:
        return {"bookings": _mine(conn, card), "payments": {"online": payments.mode(card.is_demo)}}


class BookIn(BaseModel):
    venue_id: str
    for_date: date
    at_time: time | None = None
    nights: int | None = Field(default=None, ge=1, le=60)
    people: int = Field(ge=1, le=50)
    note: str | None = Field(default=None, max_length=500)
    # hotels only
    rooms: int | None = Field(default=None, ge=1, le=20)
    room_type: Literal[ROOM_TYPES] | None = None  # type: ignore[valid-type]
    bed: Literal[BEDS] | None = None  # type: ignore[valid-type]
    access_needs: list[Literal[ACCESS]] = Field(default=[], max_length=len(ACCESS))  # type: ignore[valid-type]
    extras: list[Literal[EXTRAS]] = Field(default=[], max_length=len(EXTRAS))  # type: ignore[valid-type]


@router.post("/v1/rafeeq/bookings", status_code=201)
def book(body: BookIn, card: CardHolder = Depends(card_holder)):
    """A request: staff check with the place and answer on the page."""
    today = datetime.now(KSA).date()
    if body.for_date < today:
        raise HTTPException(422, "choose today or a later day")
    if body.for_date > today + timedelta(days=DAYS_AHEAD):
        raise HTTPException(422, f"choose a day within {DAYS_AHEAD} days")
    with tenant_session(card.tenant_id) as conn:
        v = conn.execute("SELECT kind, bookable, active, room_types FROM venue WHERE id = %s",
                         (body.venue_id,)).fetchone()
        if not v or not v["active"]:
            raise HTTPException(404, "no such place")
        if not v["bookable"]:
            raise HTTPException(409, "this place takes no bookings through Rafeeq; call them")
        hotel = v["kind"] == "hotel"
        if hotel and not body.nights:
            raise HTTPException(422, "say how many nights")
        if hotel and not body.room_type:
            raise HTTPException(422, "choose a room type")
        if hotel and v["room_types"] and body.room_type not in v["room_types"]:
            raise HTTPException(422, "this hotel does not have that room type")
        rooms = (body.rooms or 1) if hotel else None
        if hotel and rooms * SLEEPS[body.room_type] < body.people:
            raise HTTPException(422, f"{rooms} {body.room_type} room(s) sleep {rooms * SLEEPS[body.room_type]}; "
                                     f"add rooms or choose a bigger room for {body.people} people")
        if v["kind"] == "restaurant" and not body.at_time:
            raise HTTPException(422, "say what time")
        sent = conn.execute(
            "SELECT count(*)::int AS n FROM booking WHERE card_id = %s AND requested_at > now() - interval '1 day'",
            (card.card_id,)).fetchone()["n"]
        if sent >= BOOKINGS_PER_DAY:
            raise HTTPException(429, "too many booking requests today; ask your group leader")
        bid = conn.execute(
            """INSERT INTO booking (pilgrim_id, venue_id, card_id, for_date, at_time, nights, people, note,
                                    rooms, room_type, bed, access_needs, extras)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id::text""",
            (card.pilgrim_id, body.venue_id, card.card_id, body.for_date, body.at_time,
             body.nights if hotel else None, body.people, (body.note or "").strip() or None,
             rooms, body.room_type if hotel else None, body.bed if hotel else None,
             sorted(set(body.access_needs), key=ACCESS.index) if hotel else [],
             sorted(set(body.extras), key=EXTRAS.index) if hotel else [])).fetchone()["id"]
        _event(conn, bid, "requested", ACTOR)
        return {"booking": bid, "bookings": _mine(conn, card), "payments": {"online": payments.mode(card.is_demo)}}


def _own(conn, card: CardHolder, booking_id: str) -> dict:
    b = conn.execute("SELECT status, amount, pay_at FROM booking WHERE id = %s AND pilgrim_id = %s FOR UPDATE",
                     (booking_id, card.pilgrim_id)).fetchone()
    if not b:
        raise HTTPException(404, "no such booking")
    return b


@router.post("/v1/rafeeq/bookings/{booking_id}/cancel")
def cancel_mine(booking_id: str, card: CardHolder = Depends(card_holder)):
    """Until it is confirmed. A confirmed booking is cancelled by staff, who handle any refund."""
    with tenant_session(card.tenant_id) as conn:
        b = _own(conn, card, booking_id)
        if b["status"] not in PILGRIM_CANCEL_FROM:
            raise HTTPException(409, "this booking is confirmed; ask your group leader to cancel it")
        conn.execute("UPDATE booking SET status = 'cancelled', updated_at = now() WHERE id = %s", (booking_id,))
        _event(conn, booking_id, "cancelled", ACTOR)
        return {"bookings": _mine(conn, card), "payments": {"online": payments.mode(card.is_demo)}}


class PayIn(BaseModel):
    # the test payment only: the test card's number. A real provider takes the card on its own page.
    card_number: str = Field(min_length=12, max_length=23)


@router.post("/v1/rafeeq/bookings/{booking_id}/pay")
def pay(booking_id: str, body: PayIn, card: CardHolder = Depends(card_holder)):
    online = payments.mode(card.is_demo)
    if not online:
        raise HTTPException(503, "online payment is not set up yet; pay at the place or ask your group leader")
    with tenant_session(card.tenant_id) as conn:
        b = _own(conn, card, booking_id)
        why = refusal(b["status"], "pay")
        if why:
            raise HTTPException(409, why)
        try:
            ref = payments.sandbox_charge(body.card_number)
        except ValueError as exc:
            raise HTTPException(402, str(exc))
        conn.execute("""UPDATE booking SET status = 'confirmed', payment_status = 'paid', payment_provider = %s,
                               payment_ref = %s, paid_at = now(), updated_at = now() WHERE id = %s""",
                     (online, ref, booking_id))
        _event(conn, booking_id, "paid", ACTOR, f"Test payment {ref}: no money moved." if online == payments.SANDBOX else ref)
        return {"bookings": _mine(conn, card), "payments": {"online": online}}
