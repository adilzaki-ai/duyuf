"""Flights home, places, and bookings from Rafeeq: the request, the answer, the test payment."""
from __future__ import annotations

import pathlib
import re
import uuid
from datetime import datetime, timedelta

from conftest import as_op
from provision import provision
from test_rafeeq import _card, _pilgrim

from duyuf.bookings.flow import BOOKINGS_PER_DAY, MOVES, STATUSES
from duyuf.arrivals.brief import KSA

MIGRATION = pathlib.Path(__file__).resolve().parents[1] / "db/migrations/0016_return_and_bookings.sql"
TOMORROW = (datetime.now(KSA) + timedelta(days=1)).date().isoformat()


def _demo_operator() -> str:
    slug = f"demo-{uuid.uuid4().hex[:8]}"
    provision(slug, "Test demo", demo=True)
    return slug


def _venue(client, slug, **kw):
    body = {"kind": "restaurant", "city": "madinah", "name": "Al Noor Kitchen", "price_level": 2, "rating": 4.4,
            "rating_count": 812, "rating_source": "Operator survey", "price_from": 45, **kw}
    r = client.post("/v1/venues", headers=as_op(slug), json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_the_moves_are_the_databases():
    check = re.search(r"status IN \(([^)]*)\)", MIGRATION.read_text().split("CREATE TABLE booking (")[1]).group(1)
    assert tuple(re.findall(r"'(\w+)'", check)) == STATUSES
    assert all(to in STATUSES and set(froms) <= set(STATUSES) for froms, to in MOVES.values())


def test_flights_home_are_kept_in_order_and_reach_the_page(client, op_a):
    g, p = _pilgrim(client, op_a, code="U-ID-0701", passport="RL1234567")
    legs = [{"flight_number": "sv 5821", "from_airport": "MED", "to_airport": "JED", "departs_at": "2026-12-20T09:10:00+03:00",
             "arrives_at": "2026-12-20T10:20:00+03:00"},
            {"flight_number": "SV 816", "from_airport": "JED", "to_airport": "CGK", "departs_at": "2026-12-20T13:30:00+03:00"}]
    r = client.put(f"/v1/groups/{g['id']}/return-legs", headers=as_op(op_a), json={"legs": legs})
    assert r.status_code == 200, r.text
    assert [(x["seq"], x["flight_number"]) for x in r.json()["legs"]] == [(1, "SV 5821"), (2, "SV 816")]
    # a second leg must leave from where the first lands, and later
    bad = [legs[0], {**legs[1], "from_airport": "RUH"}]
    assert client.put(f"/v1/groups/{g['id']}/return-legs", headers=as_op(op_a), json={"legs": bad}).status_code == 422
    bad = [legs[1], legs[0]]
    assert client.put(f"/v1/groups/{g['id']}/return-legs", headers=as_op(op_a), json={"legs": bad}).status_code == 422
    card, _ = _card(client, op_a, p["id"])
    page = client.get("/v1/rafeeq/me", headers=card).json()
    assert [x["to_airport"] for x in page["return_legs"]] == ["JED", "CGK"]
    # cleared with an empty list
    assert client.put(f"/v1/groups/{g['id']}/return-legs", headers=as_op(op_a), json={"legs": []}).json()["legs"] == []


def test_a_rating_names_its_source_and_stars_are_official(client, op_a):
    r = client.post("/v1/venues", headers=as_op(op_a), json={"kind": "hotel", "city": "makkah", "name": "X", "rating": 4.1})
    assert r.status_code == 422
    r = client.post("/v1/venues", headers=as_op(op_a), json={"kind": "hotel", "city": "makkah", "name": "X", "stars": 7})
    assert r.status_code == 422
    r = client.post("/v1/venues", headers=as_op(op_a), json={"kind": "restaurant", "city": "makkah", "name": "X", "stars": 3})
    assert r.status_code == 422


def test_a_real_operator_books_to_pay_at_the_place(client, op_a, op_b):
    _, p = _pilgrim(client, op_a, code="U-PK-0702", passport="BK1234567")
    v = _venue(client, op_a)
    card, _ = _card(client, op_a, p["id"])
    listed = client.get("/v1/rafeeq/venues", headers=card, params={"kind": "restaurant"}).json()
    assert [x["name"] for x in listed["venues"]] == ["Al Noor Kitchen"] and listed["payments"]["online"] is None
    # another operator's pilgrims never see it
    _, q = _pilgrim(client, op_b, code="U-PK-0703", passport="BK7654321")
    other, _ = _card(client, op_b, q["id"])
    assert client.get("/v1/rafeeq/venues", headers=other).json()["venues"] == []

    # a restaurant needs a time
    r = client.post("/v1/rafeeq/bookings", headers=card, json={"venue_id": v["id"], "for_date": TOMORROW, "people": 3})
    assert r.status_code == 422
    r = client.post("/v1/rafeeq/bookings", headers=card,
                    json={"venue_id": v["id"], "for_date": TOMORROW, "at_time": "20:30", "people": 3, "note": "Near a window"})
    assert r.status_code == 201, r.text
    bid = r.json()["booking"]
    assert r.json()["bookings"][0]["status"] == "requested"

    staff = client.get("/v1/bookings", headers=as_op(op_a)).json()
    assert staff["waiting"] == 1 and staff["bookings"][0]["full_name"] == "Imran Khan"
    # no online payment for a real operator until a provider is signed
    r = client.post(f"/v1/bookings/{bid}/decide", headers=as_op(op_a), json={"action": "ask_payment", "amount": 180})
    assert r.status_code == 409 and "not set up" in r.json()["detail"]
    r = client.post(f"/v1/bookings/{bid}/decide", headers=as_op(op_a),
                    json={"action": "confirm", "amount": 180, "note": "Table 4, by the window"})
    assert r.status_code == 200 and r.json()["status"] == "confirmed" and r.json()["pay_at"] == "venue"
    assert [e["kind"] for e in r.json()["history"]] == ["requested", "confirmed"]

    mine = client.get("/v1/rafeeq/bookings", headers=card).json()["bookings"][0]
    assert mine["status"] == "confirmed" and mine["staff_note"] == "Table 4, by the window"
    # confirmed: only staff cancel now
    assert client.post(f"/v1/rafeeq/bookings/{bid}/cancel", headers=card).status_code == 409
    assert client.post(f"/v1/rafeeq/bookings/{bid}/pay", headers=card, json={"card_number": "4242424242424242"}).status_code == 503


def test_a_demonstration_pays_with_the_test_card(client):
    slug = _demo_operator()
    _, p = _pilgrim(client, slug, code="U-ID-0704", passport="PY1234567")
    v = _venue(client, slug, kind="hotel", name="Sample Hotel", stars=4, price_level=None, price_from=600)
    card, _ = _card(client, slug, p["id"])
    assert client.post("/v1/rafeeq/bookings", headers=card,
                       json={"venue_id": v["id"], "for_date": TOMORROW, "people": 2}).status_code == 422  # nights
    bid = client.post("/v1/rafeeq/bookings", headers=card,
                      json={"venue_id": v["id"], "for_date": TOMORROW, "nights": 2, "people": 2,
                            "room_type": "double"}).json()["booking"]
    # nothing to pay yet
    assert client.post(f"/v1/rafeeq/bookings/{bid}/pay", headers=card, json={"card_number": "4242424242424242"}).status_code == 409
    r = client.post(f"/v1/bookings/{bid}/decide", headers=as_op(slug), json={"action": "ask_payment", "amount": 1200})
    assert r.status_code == 200 and r.json()["status"] == "awaiting_payment"
    # any other card is refused: it is a test payment
    r = client.post(f"/v1/rafeeq/bookings/{bid}/pay", headers=card, json={"card_number": "5555 5555 5555 4444"})
    assert r.status_code == 402
    r = client.post(f"/v1/rafeeq/bookings/{bid}/pay", headers=card, json={"card_number": "4242 4242 4242 4242"})
    assert r.status_code == 200, r.text
    b = r.json()["bookings"][0]
    assert b["status"] == "confirmed" and b["payment_status"] == "paid" and b["payment_ref"].startswith("TEST-")
    # staff cancelling a paid booking leaves the money due back
    r = client.post(f"/v1/bookings/{bid}/decide", headers=as_op(slug), json={"action": "cancel", "note": "Hotel overbooked"})
    assert r.json()["status"] == "cancelled" and r.json()["payment_status"] == "refund_due"


def test_a_pilgrim_cancels_before_it_is_confirmed_and_cannot_book_the_past(client, op_a):
    _, p = _pilgrim(client, op_a, code="U-PK-0705", passport="CN1234567")
    v = _venue(client, op_a, kind="attraction", name="Kiswa Factory visit", site_id="kiswa", price_level=None)
    card, _ = _card(client, op_a, p["id"])
    yesterday = (datetime.now(KSA) - timedelta(days=1)).date().isoformat()
    assert client.post("/v1/rafeeq/bookings", headers=card,
                       json={"venue_id": v["id"], "for_date": yesterday, "people": 1}).status_code == 422
    bid = client.post("/v1/rafeeq/bookings", headers=card,
                      json={"venue_id": v["id"], "for_date": TOMORROW, "people": 1}).json()["booking"]
    r = client.post(f"/v1/rafeeq/bookings/{bid}/cancel", headers=card)
    assert r.status_code == 200 and r.json()["bookings"][0]["status"] == "cancelled"
    assert client.post(f"/v1/bookings/{bid}/decide", headers=as_op(op_a), json={"action": "confirm"}).status_code == 409
    # a viewer reads bookings but cannot answer them
    from issue_key import issue
    key = issue(op_a, "viewer one", principal="viewer1", role="viewer")
    assert client.get("/v1/bookings", headers={"Authorization": f"Bearer {key}"}).status_code == 200
    assert client.post(f"/v1/bookings/{bid}/decide", headers={"Authorization": f"Bearer {key}"},
                       json={"action": "confirm"}).status_code == 403


def test_a_card_has_a_daily_limit(client, op_a):
    _, p = _pilgrim(client, op_a, code="U-PK-0706", passport="LM1234567")
    v = _venue(client, op_a)
    card, _ = _card(client, op_a, p["id"])
    for _ in range(BOOKINGS_PER_DAY):
        assert client.post("/v1/rafeeq/bookings", headers=card, json={"venue_id": v["id"], "for_date": TOMORROW,
                                                                      "at_time": "13:00", "people": 1}).status_code == 201
    assert client.post("/v1/rafeeq/bookings", headers=card, json={"venue_id": v["id"], "for_date": TOMORROW,
                                                                  "at_time": "13:00", "people": 1}).status_code == 429


def test_a_hotel_booking_carries_the_room_and_the_help_needed(client, op_a):
    _, p = _pilgrim(client, op_a, code="U-PK-0707", passport="RM1234567")
    v = _venue(client, op_a, kind="hotel", name="Room Hotel", stars=4, price_level=None, price_from=500,
               room_types=["double", "triple", "suite"], accessibility=["wheelchair_room", "roll_in_shower"])
    assert v["room_types"] == ["double", "triple", "suite"] and v["accessibility"] == ["wheelchair_room", "roll_in_shower"]
    card, _ = _card(client, op_a, p["id"])
    base = {"venue_id": v["id"], "for_date": TOMORROW, "nights": 3}
    # a room type is needed, and must be one the hotel has
    assert client.post("/v1/rafeeq/bookings", headers=card, json={**base, "people": 2}).status_code == 422
    r = client.post("/v1/rafeeq/bookings", headers=card, json={**base, "people": 2, "room_type": "quad"})
    assert r.status_code == 422 and "does not have" in r.json()["detail"]
    # five people do not fit in two doubles
    r = client.post("/v1/rafeeq/bookings", headers=card, json={**base, "people": 5, "rooms": 2, "room_type": "double"})
    assert r.status_code == 422 and "sleep 4" in r.json()["detail"]
    # a need the hotel does not list can still be asked for: staff check
    r = client.post("/v1/rafeeq/bookings", headers=card, json={
        **base, "people": 5, "rooms": 2, "room_type": "triple", "bed": "king",
        "access_needs": ["roll_in_shower", "wheelchair_room", "carer_bed"], "extras": ["mosque_view", "breakfast"]})
    assert r.status_code == 201, r.text
    b = r.json()["bookings"][0]
    assert (b["rooms"], b["room_type"], b["bed"]) == (2, "triple", "king")
    assert b["access_needs"] == ["wheelchair_room", "roll_in_shower", "carer_bed"] and b["extras"] == ["breakfast", "mosque_view"]
    staff = client.get(f"/v1/bookings/{b['id']}", headers=as_op(op_a)).json()
    assert staff["access_needs"] == ["wheelchair_room", "roll_in_shower", "carer_bed"]
    # unknown options are refused
    r = client.post("/v1/rafeeq/bookings", headers=card, json={**base, "people": 2, "room_type": "double", "access_needs": ["jetpack"]})
    assert r.status_code == 422


def test_room_options_are_for_hotels(client, op_a):
    _, p = _pilgrim(client, op_a, code="U-PK-0708", passport="RM7654321")
    r = client.post("/v1/venues", headers=as_op(op_a), json={"kind": "restaurant", "city": "makkah", "name": "X",
                                                               "room_types": ["double"]})
    assert r.status_code == 422
    v = _venue(client, op_a)
    card, _ = _card(client, op_a, p["id"])
    b = client.post("/v1/rafeeq/bookings", headers=card, json={"venue_id": v["id"], "for_date": TOMORROW, "at_time": "19:00",
                                                               "people": 2, "room_type": "suite", "extras": ["breakfast"]}).json()
    # a restaurant booking keeps none of the room options
    mine = b["bookings"][0]
    assert mine["room_type"] is None and mine["extras"] == [] and mine["rooms"] is None


def test_a_place_keeps_links_to_its_own_photos(client, op_a):
    v = _venue(client, op_a, photos=["https://example.com/a.jpg", "https://example.com/b.jpg"])
    assert v["photos"] == ["https://example.com/a.jpg", "https://example.com/b.jpg"]
    r = client.patch(f"/v1/venues/{v['id']}", headers=as_op(op_a), json={"photos": ["http://example.com/a.jpg"]})
    assert r.status_code == 422  # https only
    r = client.patch(f"/v1/venues/{v['id']}", headers=as_op(op_a), json={"photos": [f"https://e.com/{i}.jpg" for i in range(9)]})
    assert r.status_code == 422  # eight at most
    assert client.patch(f"/v1/venues/{v['id']}", headers=as_op(op_a), json={"photos": []}).json()["photos"] == []
