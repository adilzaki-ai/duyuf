from __future__ import annotations

from conftest import as_op
from issue_key import issue

from duyuf.pilgrims.status import MOVES, STATUSES, refusal


def _group(client, slug, code="U-PK-0001"):
    r = client.post("/v1/groups", headers=as_op(slug), json={
        "code": code, "name": "Lahore Umrah", "kind": "umrah", "season": "1448",
        "origin_country": "PK", "arrival_date": "2026-11-20", "departure_date": "2026-12-01"})
    assert r.status_code == 201, r.text
    return r.json()


def _pilgrim(client, slug, group_id, passport="AB1234567"):
    r = client.post("/v1/pilgrims", headers=as_op(slug), json={
        "group_id": group_id, "full_name": "Imran Khan", "gender": "male",
        "nationality": "PK", "passport_no": passport, "date_of_birth": "1960-03-02", "needs": ["wheelchair"]})
    assert r.status_code == 201, r.text
    return r.json()


def test_journey_table_is_closed():
    for s, nxt in MOVES.items():
        assert s in STATUSES
        assert all(n in STATUSES for n in nxt)
    assert set(MOVES) == set(STATUSES)
    assert refusal("departed", "in_makkah").endswith("nothing (the journey is over)")


def test_group_and_pilgrim_round_trip(client, op_a):
    g = _group(client, op_a)
    p = _pilgrim(client, op_a, g["id"])
    assert p["status"] == "registered" and p["allowed"] == ["visa_issued"]
    assert [h["to_status"] for h in p["history"]] == ["registered"]
    g2 = client.get(f"/v1/groups/{g['id']}", headers=as_op(op_a)).json()
    assert g2["pilgrims"] == 1 and g2["by_status"] == {"registered": 1}


def test_the_journey_refuses_a_skipped_step(client, op_a):
    p = _pilgrim(client, op_a, _group(client, op_a)["id"])
    r = client.post(f"/v1/pilgrims/{p['id']}/status", headers=as_op(op_a), json={"to": "in_makkah"})
    assert r.status_code == 409 and "allowed: visa_issued" in r.json()["detail"]
    for to in ("visa_issued", "arrived", "in_makkah"):
        r = client.post(f"/v1/pilgrims/{p['id']}/status", headers=as_op(op_a), json={"to": to})
        assert r.status_code == 200, r.text
    assert [h["to_status"] for h in r.json()["history"]] == ["registered", "visa_issued", "arrived", "in_makkah"]


def test_one_operator_never_sees_another(client, op_a, op_b):
    g = _group(client, op_a)
    p = _pilgrim(client, op_a, g["id"])
    assert client.get("/v1/pilgrims", headers=as_op(op_b)).json()["total"] == 0
    assert client.get(f"/v1/pilgrims/{p['id']}", headers=as_op(op_b)).status_code == 404
    assert client.get("/v1/groups", headers=as_op(op_b)).json()["items"] == []
    # nor put a pilgrim into another operator's group
    r = client.post("/v1/pilgrims", headers=as_op(op_b), json={
        "group_id": g["id"], "full_name": "X", "gender": "male", "nationality": "PK", "passport_no": "ZZ9999999"})
    assert r.status_code == 422


def test_same_passport_twice_is_refused(client, op_a):
    g = _group(client, op_a)
    _pilgrim(client, op_a, g["id"])
    r = client.post("/v1/pilgrims", headers=as_op(op_a), json={
        "group_id": g["id"], "full_name": "Other", "gender": "male", "nationality": "PK", "passport_no": "ab1234567"})
    assert r.status_code == 409


def test_staff_see_a_masked_passport_and_cannot_edit(client, op_a):
    g = _group(client, op_a)
    p = _pilgrim(client, op_a, g["id"])
    key = issue(op_a, "test", principal="desk1", role="staff", display_name="Desk 1")
    h = {"Authorization": f"Bearer {key}"}
    seen = client.get(f"/v1/pilgrims/{p['id']}", headers=h).json()
    assert seen["passport_no"] == "•••• 4567" and seen["date_of_birth"] is None
    # staff search by name works; by passport finds nothing
    assert client.get("/v1/pilgrims", headers=h, params={"q": "1234567"}).json()["total"] == 0
    assert client.patch(f"/v1/pilgrims/{p['id']}", headers=h, json={"phone": "1"}).status_code == 403
    # but they move pilgrims along the journey, and are named in the history
    r = client.post(f"/v1/pilgrims/{p['id']}/status", headers=h, json={"to": "visa_issued"})
    assert r.status_code == 200 and r.json()["history"][-1]["actor"] == "Desk 1"


def test_a_bad_key_and_no_key_are_refused(client):
    assert client.get("/v1/me").status_code == 401
    assert client.get("/v1/me", headers={"Authorization": "Bearer dyf_nope"}).status_code == 401


def test_overview_counts(client, op_a):
    g = _group(client, op_a)
    _pilgrim(client, op_a, g["id"])
    o = client.get("/v1/overview", headers=as_op(op_a)).json()
    assert o["pilgrims"] == 1 and o["by_status"]["registered"] == 1 and o["needs"] == {"wheelchair": 1}
