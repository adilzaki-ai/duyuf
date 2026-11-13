from __future__ import annotations

from conftest import as_op
from issue_key import issue
from seed_demo import seed

from duyuf.incidents.flow import MOVES, STATUSES, refusal


def _pilgrim(client, slug):
    g = client.post("/v1/groups", headers=as_op(slug), json={
        "code": "U-PK-0001", "name": "Lahore Umrah", "kind": "umrah", "season": "1448", "origin_country": "PK"}).json()
    p = client.post("/v1/pilgrims", headers=as_op(slug), json={
        "group_id": g["id"], "full_name": "Imran Khan", "gender": "male", "nationality": "PK",
        "passport_no": "AB1234567"}).json()
    return g, p


def _raise(client, slug, **kw):
    return client.post("/v1/incidents", headers=as_op(slug), json={
        "kind": "lost", "priority": "urgent", "description": "Not back at the bus.", **kw})


def test_the_flow_is_closed():
    for froms, to in MOVES.values():
        assert to in STATUSES and all(f in STATUSES for f in froms)
    assert refusal("resolved", "assign") == "cannot assign an incident that is resolved"
    assert refusal("open", "reopen") == "cannot reopen an incident that is open"


def test_raised_assigned_resolved_reopened_and_every_step_kept(client, op_a):
    g, p = _pilgrim(client, op_a)
    # a pilgrim's incident is filed under their own group, whatever group was sent
    r = _raise(client, op_a, pilgrim_id=p["id"], location="Quba Mosque")
    assert r.status_code == 201, r.text
    i = r.json()
    assert i["status"] == "open" and i["group_id"] == g["id"] and i["pilgrim_name"] == "Imran Khan"
    assert i["allowed"] == ["assign", "resolve"] and isinstance(i["ref"], int)
    url = f"/v1/incidents/{i['id']}"

    i = client.post(f"{url}/assign", headers=as_op(op_a), json={"team": " Madinah field team ", "note": "on foot"}).json()
    assert i["status"] == "assigned" and i["team"] == "Madinah field team" and i["assigned_at"]
    first_assigned = i["assigned_at"]
    i = client.post(f"{url}/assign", headers=as_op(op_a), json={"team": "Mosque security"}).json()
    assert i["team"] == "Mosque security" and i["assigned_at"] == first_assigned   # time to help counts from the first
    i = client.post(f"{url}/notes", headers=as_op(op_a), json={"note": "Seen near the clinic"}).json()
    i = client.post(f"{url}/resolve", headers=as_op(op_a), json={"resolution": "Found, back at the hotel."}).json()
    assert i["status"] == "resolved" and i["allowed"] == ["reopen"] and i["resolved_at"]

    assert client.post(f"{url}/assign", headers=as_op(op_a), json={"team": "x"}).status_code == 409
    assert client.post(f"{url}/resolve", headers=as_op(op_a), json={"resolution": "again"}).status_code == 409
    assert client.post(f"{url}/reopen", headers=as_op(op_a), json={"note": "  "}).status_code == 422
    i = client.post(f"{url}/reopen", headers=as_op(op_a), json={"note": "Left the hotel again"}).json()
    assert i["status"] == "open" and i["resolution"] is None and i["resolved_at"] is None
    assert [(h["kind"], h["team"]) for h in i["history"]] == [
        ("opened", None), ("assigned", "Madinah field team"), ("assigned", "Mosque security"),
        ("note", None), ("resolved", None), ("reopened", None)]
    assert all(h["actor"] == "developer" for h in i["history"])


def test_the_queue_puts_the_pressing_first_and_counts(client, op_a):
    g, p = _pilgrim(client, op_a)
    normal = _raise(client, op_a, priority="normal", group_id=g["id"]).json()
    urgent = _raise(client, op_a, pilgrim_id=p["id"]).json()
    done = _raise(client, op_a, priority="high", kind="heat").json()
    client.post(f"/v1/incidents/{done['id']}/assign", headers=as_op(op_a), json={"team": "Hotel desk"})
    client.post(f"/v1/incidents/{done['id']}/resolve", headers=as_op(op_a), json={"resolution": "Water and shade."})

    active = client.get("/v1/incidents", headers=as_op(op_a)).json()
    assert [x["id"] for x in active["items"]] == [urgent["id"], normal["id"]]
    assert active["stats"]["open"] == 2 and active["stats"]["urgent"] == 1 and active["stats"]["resolved_today"] == 1
    assert active["stats"]["minutes_to_assign"] == 0 and active["teams"] == ["Hotel desk"]
    every = client.get("/v1/incidents", headers=as_op(op_a), params={"status": "all"}).json()["items"]
    assert [x["id"] for x in every] == [urgent["id"], normal["id"], done["id"]]
    mine = client.get("/v1/incidents", headers=as_op(op_a), params={"pilgrim_id": p["id"], "status": "all"}).json()
    assert [x["id"] for x in mine["items"]] == [urgent["id"]]


def test_viewers_follow_staff_work_and_operators_stay_apart(client, op_a, op_b):
    _, p = _pilgrim(client, op_a)
    i = _raise(client, op_a, pilgrim_id=p["id"]).json()
    viewer = {"Authorization": f"Bearer {issue(op_a, 'test', principal='v', role='viewer', display_name='V')}"}
    desk = {"Authorization": f"Bearer {issue(op_a, 'test', principal='d', role='staff', display_name='Desk')}"}
    assert client.get(f"/v1/incidents/{i['id']}", headers=viewer).status_code == 200
    assert client.post(f"/v1/incidents/{i['id']}/assign", headers=viewer, json={"team": "x"}).status_code == 403
    assert client.post(f"/v1/incidents/{i['id']}/assign", headers=desk, json={"team": "x"}).json()["history"][-1]["actor"] == "Desk"

    assert client.get(f"/v1/incidents/{i['id']}", headers=as_op(op_b)).status_code == 404
    assert client.get("/v1/incidents", headers=as_op(op_b)).json()["items"] == []
    # nor raise one on another operator's pilgrim
    assert _raise(client, op_b, pilgrim_id=p["id"]).status_code == 422


def test_the_demo_has_a_live_queue(client):
    seed(reset=True)
    q = client.get("/v1/incidents", headers=as_op("duyuf-demo")).json()
    # urgent first; then, among the high, whoever has waited longest (heat, 41 min, before lost, 28)
    assert [x["kind"] for x in q["items"]] == ["sos", "heat", "lost"]
    assert q["items"][0]["status"] == "open" and q["items"][2]["team"] == "Madinah field team"
    assert q["stats"]["minutes_to_assign"] is not None and q["stats"]["minutes_to_resolve"] is not None
    every = client.get("/v1/incidents", headers=as_op("duyuf-demo"), params={"status": "all"}).json()["items"]
    assert len(every) == 6 and all(x["group_code"] for x in every)
