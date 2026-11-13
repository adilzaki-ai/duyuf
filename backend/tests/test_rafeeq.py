from __future__ import annotations

import pathlib
import re

import pytest
from conftest import as_op
from issue_key import issue

from duyuf.core.db import owner_session, tenant_session
from duyuf.incidents.flow import KINDS, PRIORITIES
from duyuf.rafeeq.help import ACTOR, CALLS_PER_HOUR, FINE_NOTE, HELP, LANGUAGES

MIGRATION = pathlib.Path(__file__).resolve().parents[1] / "db/migrations/0009_rafeeq.sql"


def _pilgrim(client, slug, *, departs=None, language="ur", code="U-PK-0001", passport="AB1234567"):
    g = client.post("/v1/groups", headers=as_op(slug), json={
        "code": code, "name": "Lahore Umrah", "kind": "umrah", "season": "1448", "origin_country": "PK",
        "leader_name": "Bilal Ahmed", "leader_phone": "+92 300 1234567",
        **({"arrival_date": "2026-01-01", "departure_date": departs} if departs else {})}).json()
    p = client.post("/v1/pilgrims", headers=as_op(slug), json={
        "group_id": g["id"], "full_name": "Imran Khan", "gender": "male", "nationality": "PK",
        "passport_no": passport, "language": language}).json()
    return g, p


def _card(client, slug, pilgrim_id, **body):
    r = client.post(f"/v1/pilgrims/{pilgrim_id}/rafeeq", headers=as_op(slug), json=body)
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()


def _help(client, card, kind="sos", **kw):
    return client.post("/v1/rafeeq/help", headers=card, json={"kind": kind, **kw})


def test_the_calls_are_incidents_the_feed_knows():
    assert all(k in KINDS and p in PRIORITIES for k, (p, _) in HELP.items())
    # the six languages are the database's six
    check = re.search(r"language IN \(([^)]*)\)", MIGRATION.read_text()).group(1)
    assert tuple(re.findall(r"'(\w+)'", check)) == LANGUAGES


def test_a_card_opens_the_page_and_a_call_lands_in_the_feed(client, op_a):
    g, p = _pilgrim(client, op_a)
    card, issued = _card(client, op_a, p["id"])
    # the language the card opens in is the pilgrim's own, when Rafeeq speaks it
    assert issued["token"].startswith("rfq_") and issued["language"] == "ur"

    page = client.get("/v1/rafeeq/me", headers=card).json()
    assert page["full_name"] == "Imran Khan" and page["leader_phone"] == "+92 300 1234567"
    assert page["calls"] == [] and page["is_demo"] is False
    assert "passport_no" not in page and "date_of_birth" not in page

    r = _help(client, card, "lost", location="24.46720, 39.61120 (±25 m)")
    assert r.status_code == 200, r.text
    page = r.json()
    assert page["repeated"] is False and page["calls"][0]["kind"] == "lost" and page["calls"][0]["status"] == "open"

    feed = client.get("/v1/incidents", headers=as_op(op_a)).json()["items"]
    i = next(x for x in feed if x["id"] == page["call"])
    assert i["priority"] == "urgent" and i["from_rafeeq"] and i["reported_by"] == ACTOR
    assert i["group_id"] == g["id"] and i["location"].startswith("24.46720")
    assert i["description"].endswith("Speaks Urdu.")

    # staff see the card is in use, never the card itself
    held = client.get(f"/v1/pilgrims/{p['id']}/rafeeq", headers=as_op(op_a)).json()["card"]
    assert held["language"] == "ur" and held["last_used_at"] and "token" not in held


def test_pressing_again_adds_to_the_same_call(client, op_a):
    _, p = _pilgrim(client, op_a)
    card, _ = _card(client, op_a, p["id"])
    first = _help(client, card, "sos").json()
    again = _help(client, card, "sos").json()       # straight away, no new place: nothing to add
    moved = _help(client, card, "sos", location="24.4, 39.6 (±40 m)").json()
    assert again["repeated"] and moved["repeated"] and again["call"] == moved["call"] == first["call"]
    i = client.get(f"/v1/incidents/{first['call']}", headers=as_op(op_a)).json()
    assert i["location"] == "24.4, 39.6 (±40 m)"
    assert [h["note"] for h in i["history"]] == [None, "Pressed again. Now at 24.4, 39.6 (±40 m)."]
    # a different call is a different incident
    other = _help(client, card, "heat").json()
    assert other["call"] != first["call"] and len(other["calls"]) == 2


def test_the_pilgrim_says_fine_and_staff_still_close_it(client, op_a):
    _, p = _pilgrim(client, op_a)
    card, _ = _card(client, op_a, p["id"])
    call = _help(client, card, "lost").json()["call"]
    for _ in range(2):
        page = client.post(f"/v1/rafeeq/help/{call}/fine", headers=card).json()
    assert page["calls"][0]["pilgrim_ok_at"] and page["calls"][0]["status"] == "open"
    i = client.get(f"/v1/incidents/{call}", headers=as_op(op_a)).json()
    assert i["pilgrim_ok_at"] and [h["note"] for h in i["history"]].count(FINE_NOTE) == 1
    assert i["history"][-1]["actor"] == ACTOR

    client.post(f"/v1/incidents/{call}/resolve", headers=as_op(op_a), json={"resolution": "Back with the group."})
    page = client.get("/v1/rafeeq/me", headers=card).json()
    assert page["calls"][0]["status"] == "resolved"     # they see the answer
    assert client.post(f"/v1/rafeeq/help/{call}/fine", headers=card).status_code == 404


def test_a_card_opens_nothing_else(client, op_a, op_b):
    _, p = _pilgrim(client, op_a)
    card, _ = _card(client, op_a, p["id"])
    for path in ("/v1/me", "/v1/pilgrims", f"/v1/pilgrims/{p['id']}", "/v1/incidents"):
        assert client.get(path, headers=card).status_code == 401, path
    # nor another pilgrim's call, here or at another operator
    _, q = _pilgrim(client, op_b)
    other, _ = _card(client, op_b, q["id"])
    theirs = _help(client, other, "sos").json()["call"]
    assert client.post(f"/v1/rafeeq/help/{theirs}/fine", headers=card).status_code == 404
    # a staff key or no key is not a card
    assert client.get("/v1/rafeeq/me", headers=as_op(op_a)).status_code == 401
    assert client.get("/v1/rafeeq/me", headers={"Authorization": "Bearer rfq_nope"}).status_code == 401


def test_a_new_card_stops_the_old_and_a_stopped_card_stops(client, op_a):
    _, p = _pilgrim(client, op_a)
    old, _ = _card(client, op_a, p["id"])
    new, issued = _card(client, op_a, p["id"], language="en")
    assert issued["language"] == "en"
    assert client.get("/v1/rafeeq/me", headers=old).status_code == 401
    assert client.get("/v1/rafeeq/me", headers=new).json()["language"] == "en"
    assert client.delete(f"/v1/pilgrims/{p['id']}/rafeeq", headers=as_op(op_a)).status_code == 204
    r = client.get("/v1/rafeeq/me", headers=new)
    assert r.status_code == 401 and "new one" in r.json()["detail"]
    assert client.get(f"/v1/pilgrims/{p['id']}/rafeeq", headers=as_op(op_a)).json()["card"] is None


def test_a_card_ends_a_week_after_the_group_leaves(client, op_a):
    _, p = _pilgrim(client, op_a, departs="2026-02-01")
    card, _ = _card(client, op_a, p["id"])
    assert client.get("/v1/rafeeq/me", headers=card).status_code == 401
    _, gone = _pilgrim(client, op_a, code="U-PK-0002", passport="CD1234567")
    client.post(f"/v1/pilgrims/{gone['id']}/status", headers=as_op(op_a), json={"to": "visa_issued"})
    client.post(f"/v1/pilgrims/{gone['id']}/status", headers=as_op(op_a), json={"to": "arrived"})
    client.post(f"/v1/pilgrims/{gone['id']}/status", headers=as_op(op_a), json={"to": "departed"})
    assert client.post(f"/v1/pilgrims/{gone['id']}/rafeeq", headers=as_op(op_a), json={}).status_code == 409


def test_too_many_calls_from_one_card_are_slowed(client, op_a):
    _, p = _pilgrim(client, op_a)
    card, _ = _card(client, op_a, p["id"])
    for _ in range(CALLS_PER_HOUR):
        call = _help(client, card, "sos").json()["call"]
        client.post(f"/v1/incidents/{call}/resolve", headers=as_op(op_a), json={"resolution": "False alarm."})
    r = _help(client, card, "sos")
    assert r.status_code == 429 and "911" in r.json()["detail"]


def test_who_hands_out_cards(client, op_a):
    g, p = _pilgrim(client, op_a)
    viewer = {"Authorization": f"Bearer {issue(op_a, 'test', principal='v', role='viewer', display_name='V')}"}
    desk = {"Authorization": f"Bearer {issue(op_a, 'test', principal='d', role='staff', display_name='Desk')}"}
    assert client.post(f"/v1/pilgrims/{p['id']}/rafeeq", headers=viewer, json={}).status_code == 403
    assert client.get(f"/v1/pilgrims/{p['id']}/rafeeq", headers=viewer).status_code == 200
    assert client.post(f"/v1/pilgrims/{p['id']}/rafeeq", headers=desk, json={}).status_code == 201
    assert client.get(f"/v1/pilgrims/{p['id']}/rafeeq", headers=desk).json()["card"]["issued_by"] == "Desk"
    assert client.post(f"/v1/groups/{g['id']}/rafeeq", headers=as_op("x-" + op_a), json={}).status_code == 401


def test_cards_for_a_whole_group(client, op_a, op_b):
    g, p = _pilgrim(client, op_a)
    second = client.post("/v1/pilgrims", headers=as_op(op_a), json={
        "group_id": g["id"], "full_name": "Ayesha Khan", "gender": "female", "nationality": "PK",
        "passport_no": "AB7654321"}).json()
    kept, _ = _card(client, op_a, p["id"])
    sheet = client.post(f"/v1/groups/{g['id']}/rafeeq", headers=as_op(op_a), json={}).json()
    # only who had none; the card already handed out still works
    assert [c["full_name"] for c in sheet["cards"]] == ["Ayesha Khan"] and sheet["kept"] == 1
    assert sheet["cards"][0]["language"] == "en" and sheet["cards"][0]["pilgrim_id"] == second["id"]
    assert client.get("/v1/rafeeq/me", headers=kept).status_code == 200
    every = client.post(f"/v1/groups/{g['id']}/rafeeq", headers=as_op(op_a), json={"replace": True}).json()
    assert len(every["cards"]) == 2 and every["kept"] == 0
    assert client.get("/v1/rafeeq/me", headers=kept).status_code == 401
    assert client.post(f"/v1/groups/{g['id']}/rafeeq", headers=as_op(op_b), json={}).status_code == 404


def test_the_app_role_cannot_read_a_card(op_a):
    with owner_session() as conn:
        tid = conn.execute("SELECT id::text FROM tenant WHERE slug = %s", (op_a,)).fetchone()["id"]
    with pytest.raises(Exception, match="permission denied"):
        with tenant_session(tid) as conn:
            conn.execute("SELECT token_hash FROM rafeeq_card").fetchall()
