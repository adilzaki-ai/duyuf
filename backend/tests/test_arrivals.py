from __future__ import annotations

from datetime import date, datetime, timedelta

from conftest import as_op
from issue_key import issue
from seed_demo import seed

from duyuf.arrivals.brief import KSA, age_on, brief, slot_start, waves


def _p(status="visa_issued", needs=(), born=None, language="ur"):
    return {"status": status, "needs": list(needs), "date_of_birth": born, "language": language}


def test_the_brief_counts_by_hand():
    on = date(2026, 11, 20)
    people = ([_p(born=date(1951, 11, 20))]               # 75 that day
              + [_p(born=date(1951, 11, 21))]             # 74 until tomorrow
              + [_p(needs=["wheelchair", "medical"], born=None)]
              + [_p(status="registered", language="ar")]
              + [_p(language=None)]
              + [_p() for _ in range(45)])
    b = brief(people, on)
    assert b["pilgrims"] == 50 and b["buses"] == 2           # 49 seats a coach
    assert b["over_75"] == 1 and b["unknown_age"] == 48
    assert b["wheelchair"] == 1 and b["medical"] == 1 and b["no_visa"] == 1
    # 48 Urdu speakers: two interpreters; Arabic needs none; unknown counted, never interpreted
    assert b["languages"] == [{"language": "ur", "pilgrims": 48, "interpreters": 2},
                              {"language": "ar", "pilgrims": 1, "interpreters": 0},
                              {"language": None, "pilgrims": 1, "interpreters": 0}]
    assert b["interpreters"] == 2
    assert age_on(date(2000, 2, 29), date(2026, 2, 28)) == 25


def test_the_wave_starts_on_the_saudi_three_hour_mark():
    now = datetime(2026, 11, 13, 1, 50, tzinfo=KSA)          # 22:50 UTC the day before
    assert slot_start(now) == datetime(2026, 11, 13, 0, 0, tzinfo=KSA)
    f = lambda h, n, landed=None: {"expected_at": now + timedelta(hours=h), "landed_at": landed,
                                   "arrival_airport": "JED", "brief": {"pilgrims": n}}
    w = waves([f(0.5, 10), f(2, 5), f(-2, 99), f(1, 7, landed=now)], now, 12)
    assert len(w) == 5 and w[0]["by_airport"] == {"JED": 10} and w[1]["by_airport"] == {"JED": 5}


def _group(client, slug, code="U-PK-0001", arrival=None):
    r = client.post("/v1/groups", headers=as_op(slug), json={
        "code": code, "name": "Lahore Umrah", "kind": "umrah", "season": "1448", "origin_country": "PK",
        "arrival_date": arrival or (date.today() + timedelta(days=1)).isoformat()})
    assert r.status_code == 201, r.text
    return r.json()


def _pilgrims(client, slug, gid, n, start=0):
    out = []
    for i in range(start, start + n):
        r = client.post("/v1/pilgrims", headers=as_op(slug), json={
            "group_id": gid, "full_name": f"Pilgrim {i}", "gender": "male", "nationality": "PK",
            "passport_no": f"AB{1000000 + i}", "date_of_birth": "1945-01-01", "language": "ur",
            "needs": ["wheelchair"] if i % 2 else []})
        assert r.status_code == 201, r.text
        out.append(r.json())
    return out


def _flight(client, slug, number="pk 743", hours=10):
    at = (datetime.now(KSA) + timedelta(hours=hours)).replace(microsecond=0, tzinfo=None)
    r = client.post("/v1/flights", headers=as_op(slug), json={
        "number": number, "origin_airport": "khi", "arrival_airport": "JED", "scheduled_at": at.isoformat()})
    assert r.status_code == 201, r.text
    return r.json()


def test_a_flight_is_planned_filled_and_shown_on_the_board(client, op_a):
    g = _group(client, op_a)
    people = _pilgrims(client, op_a, g["id"], 4)
    f = _flight(client, op_a)
    assert f["number"] == "PK 743" and f["origin_airport"] == "KHI" and f["state"] == "on_time"
    # a time with no zone is read on the Saudi clock
    assert f["scheduled_at"].endswith("+03:00")

    board = client.get("/v1/arrivals", headers=as_op(op_a)).json()
    assert [u["code"] for u in board["unplanned"]] == ["U-PK-0001"] and board["unplanned"][0]["without_flight"] == 4

    r = client.post(f"/v1/flights/{f['id']}/pilgrims", headers=as_op(op_a), json={"group_id": g["id"]})
    assert r.status_code == 200 and r.json()["added"] == 4
    b = r.json()["brief"]
    assert b["pilgrims"] == 4 and b["over_75"] == 4 and b["wheelchair"] == 2 and b["no_visa"] == 4
    assert r.json()["groups"] == [{"id": g["id"], "code": "U-PK-0001", "name": "Lahore Umrah", "pilgrims": 4}]
    # again: nobody left without a flight, nothing added, nothing logged
    assert client.post(f"/v1/flights/{f['id']}/pilgrims", headers=as_op(op_a),
                       json={"group_id": g["id"]}).json()["added"] == 0

    board = client.get("/v1/arrivals", headers=as_op(op_a)).json()
    assert board["unplanned"] == [] and [x["number"] for x in board["flights"]] == ["PK 743"]
    assert sum(sum(w["by_airport"].values()) for w in board["waves"]) == 4

    p = client.get(f"/v1/pilgrims/{people[0]['id']}", headers=as_op(op_a)).json()
    assert p["flight_number"] == "PK 743" and p["language"] == "ur"
    on = client.get("/v1/pilgrims", headers=as_op(op_a), params={"flight_id": f["id"]}).json()
    assert on["total"] == 4
    # off the flight again
    p = client.patch(f"/v1/pilgrims/{people[0]['id']}", headers=as_op(op_a), json={"arrival_flight_id": None}).json()
    assert p["arrival_flight_id"] is None
    assert client.patch(f"/v1/pilgrims/{people[0]['id']}", headers=as_op(op_a),
                        json={"arrival_flight_id": f["id"]}).status_code == 422


def test_a_delay_and_a_missed_confirmation_show(client, op_a):
    f = _flight(client, op_a)
    later = datetime.fromisoformat(f["scheduled_at"]) + timedelta(minutes=95)
    r = client.patch(f"/v1/flights/{f['id']}", headers=as_op(op_a), json={"estimated_at": later.isoformat()})
    assert r.json()["state"] == "delayed" and r.json()["delay_minutes"] == 95
    assert [h["kind"] for h in r.json()["history"]] == ["created", "expected"]
    past = _flight(client, op_a, "SV 705", hours=-3)
    board = client.get("/v1/arrivals", headers=as_op(op_a)).json()
    assert {x["number"]: x["state"] for x in board["flights"]} == {"SV 705": "due", "PK 743": "delayed"}


def test_landing_moves_those_with_a_visa_and_holds_the_rest(client, op_a):
    g = _group(client, op_a)
    people = _pilgrims(client, op_a, g["id"], 3)
    for p in people[:2]:
        client.post(f"/v1/pilgrims/{p['id']}/status", headers=as_op(op_a), json={"to": "visa_issued"})
    f = _flight(client, op_a, hours=-1)
    client.post(f"/v1/flights/{f['id']}/pilgrims", headers=as_op(op_a), json={"group_id": g["id"]})

    desk = {"Authorization": f"Bearer {issue(op_a, 'test', principal='desk', role='staff', display_name='Desk')}"}
    assert client.post("/v1/flights", headers=desk, json={}).status_code == 403
    assert client.post(f"/v1/flights/{f['id']}/pilgrims", headers=desk, json={"group_id": g["id"]}).status_code == 403
    r = client.post(f"/v1/flights/{f['id']}/landed", headers=desk, json={})
    assert r.status_code == 200, r.text
    assert r.json()["arrived"] == 2 and r.json()["no_visa"] == 1 and r.json()["state"] == "landed"
    seen = client.get(f"/v1/pilgrims/{people[0]['id']}", headers=as_op(op_a)).json()
    assert seen["status"] == "arrived"
    assert seen["history"][-1] == {**seen["history"][-1], "from_status": "visa_issued", "to_status": "arrived",
                                   "note": "Flight PK 743 landed", "actor": "Desk"}
    assert client.get(f"/v1/pilgrims/{people[2]['id']}", headers=as_op(op_a)).json()["status"] == "registered"

    assert client.post(f"/v1/flights/{f['id']}/landed", headers=desk, json={}).status_code == 409
    assert client.patch(f"/v1/flights/{f['id']}", headers=as_op(op_a),
                        json={"estimated_at": None}).status_code == 409
    assert client.post(f"/v1/flights/{f['id']}/pilgrims", headers=as_op(op_a),
                       json={"pilgrim_ids": [people[2]["id"]]}).status_code == 409
    # an arrived pilgrim cannot be put on another arrival flight
    other = _flight(client, op_a, "SV 705")
    r = client.post(f"/v1/flights/{other['id']}/pilgrims", headers=as_op(op_a), json={"pilgrim_ids": [people[0]["id"]]})
    assert r.status_code == 409 and "Pilgrim 0" in r.json()["detail"]


def test_a_flight_number_must_look_like_one(client, op_a):
    r = client.post("/v1/flights", headers=as_op(op_a), json={
        "number": "flight one", "origin_airport": "KHI", "arrival_airport": "JED",
        "scheduled_at": "2026-12-01T10:00:00"})
    assert r.status_code == 422 and "SV 3102" in r.text


def test_one_operator_never_sees_or_fills_another_operators_flight(client, op_a, op_b):
    g = _group(client, op_a)
    people = _pilgrims(client, op_a, g["id"], 1)
    f = _flight(client, op_a)
    assert client.get(f"/v1/flights/{f['id']}", headers=as_op(op_b)).status_code == 404
    assert client.get("/v1/arrivals", headers=as_op(op_b)).json()["flights"] == []
    assert client.post(f"/v1/flights/{f['id']}/pilgrims", headers=as_op(op_b),
                       json={"group_id": g["id"]}).status_code == 404
    mine = _flight(client, op_b)
    assert client.post(f"/v1/flights/{mine['id']}/pilgrims", headers=as_op(op_b),
                       json={"pilgrim_ids": [people[0]["id"]]}).status_code == 404
    assert client.post(f"/v1/flights/{mine['id']}/pilgrims", headers=as_op(op_b),
                       json={"group_id": g["id"]}).status_code == 404


def test_the_demo_board_has_flights_in_the_next_two_days(client):
    seed(reset=True)
    board = client.get("/v1/arrivals", headers=as_op("duyuf-demo")).json()
    assert len(board["flights"]) >= 4
    assert {f["arrival_airport"] for f in board["flights"]} >= {"JED"}
    week = client.get("/v1/arrivals", headers=as_op("duyuf-demo"), params={"hours": 168}).json()
    assert {f["number"] for f in week["flights"]} >= {"SV 705", "MS 683", "GA 980", "6E 63", "SV 3304", "TK 92"}
    ga = next(f for f in week["flights"] if f["number"] == "GA 980")
    assert ga["delay_minutes"] == 95 and ga["brief"]["pilgrims"] == 44
    # Kano lands within the week with no flight booked
    assert "U-NG-0090" in {u["code"] for u in week["unplanned"]}
