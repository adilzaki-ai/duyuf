"""Covering the board's gaps from the roster: the rule, the plan, asking people, their answers, and follow-up."""
from __future__ import annotations

import json
import pathlib
from datetime import datetime, timedelta, timezone

from conftest import as_op
from issue_key import issue
from test_arrivals import _flight, _group, _pilgrims

from duyuf.core.db import owner_session, tenant_session
from duyuf.dispatch import planner, run

CASES = pathlib.Path(__file__).resolve().parents[2] / "sample/dispatch_cases.json"


def test_the_rule_on_the_shared_cases():
    for c in json.loads(CASES.read_text())["cases"]:
        busy = {k: [tuple(x) for x in v] for k, v in c["busy"].items()}
        got = [{k: i[k] for k in ("kind", "language", "ask", "missing")}
               for i in planner.plan(c["gaps"], c["workers"], busy, c["hours"])]
        assert got == c["expect"], c["name"]


def _board_gaps(client, slug):
    rows = client.get("/v1/arrivals", headers=as_op(slug)).json()["load"]
    return ({(s["kind"], s["language"]): s["short"] for r in rows for s in r["short"]},
            {(s["kind"], s["language"]): s["short"] for r in rows for s in r["waiting"]})


def _worker(client, slug, name, roles, languages=(), phone=None):
    r = client.post("/v1/workers", headers=as_op(slug), json={
        "name": name, "phone": phone or f"+966 55 {abs(hash(name)) % 10_000_000:07d}", "roles": list(roles),
        "languages": list(languages), "airports": ["JED"]})
    assert r.status_code == 201, r.text
    return r.json()


def _link(view, name):
    r = next(x for x in view["requests"] if x["name"] == name)
    return {"Authorization": f"Bearer {r['link'].split('#', 1)[1]}"}, r


def _tenant(slug):
    with owner_session() as conn:
        return conn.execute("SELECT id::text FROM tenant WHERE slug = %s", (slug,)).fetchone()["id"]


def test_a_gap_is_planned_approved_answered_and_refilled(client, op_a):
    g = _group(client, op_a)
    _pilgrims(client, op_a, g["id"], 4)          # two in wheelchairs, all Urdu speakers
    f = _flight(client, op_a, hours=10)
    client.post(f"/v1/flights/{f['id']}/pilgrims", headers=as_op(op_a), json={"group_id": g["id"]})
    short, waiting = _board_gaps(client, op_a)
    assert short[("wheelchair", None)] == 2 and short[("interpreter", "ur")] == 1 and waiting == {}

    _worker(client, op_a, "Amina Raza", ["interpreter"], ["ur", "en"])
    _worker(client, op_a, "Dalia Saleh", ["wheelchair"])
    _worker(client, op_a, "Omar Faruk", ["wheelchair"])
    _worker(client, op_a, "Hamid Ali", ["bus"])

    # Approve (the default): a plan waits; nobody is asked yet
    v = client.post("/v1/dispatch/run", headers=as_op(op_a)).json()
    assert v["settings"]["mode"] == "approve" and v["requests"] == []
    items = {(i["kind"], i["language"]): i for i in v["plan"]["items"]}
    assert [p["name"] for p in items[("wheelchair", None)]["people"]] == ["Dalia Saleh", "Omar Faruk"]
    assert items[("interpreter", "ur")]["people"][0]["name"] == "Amina Raza"
    assert all(i["missing"] == 0 for i in items.values())

    v = client.post(f"/v1/dispatch/plans/{v['plan']['id']}/approve", headers=as_op(op_a)).json()
    assert v["asked"] == 4 and v["plan"] is None and all(r["status"] == "asked" for r in v["requests"])
    req = next(r for r in v["requests"] if r["name"] == "Amina Raza")
    assert req["link"].split("#")[1].startswith("wk_") and "interpreter (Urdu)" in req["message"] and "مترجم" in req["message"]
    # the board: covered on paper, waiting for answers
    short, waiting = _board_gaps(client, op_a)
    assert short == {} and waiting[("wheelchair", None)] == 2 and waiting[("interpreter", "ur")] == 1

    # staff sent it on WhatsApp
    assert client.post(f"/v1/dispatch/requests/{req['id']}/sent", headers=as_op(op_a)).json()["requests"]

    # the people answer on their links
    amina, _ = _link(v, "Amina Raza")
    me = client.get("/v1/work/me", headers=amina).json()
    assert me["first_name"] == "Amina" and me["kind"] == "interpreter" and me["can_answer"] and "phone" not in me
    assert client.post("/v1/work/answer", headers=amina, json={"accept": True}).json()["status"] == "accepted"
    dalia, _ = _link(v, "Dalia Saleh")
    client.post("/v1/work/answer", headers=dalia, json={"accept": True})
    omar, _ = _link(v, "Omar Faruk")
    assert client.post("/v1/work/answer", headers=omar, json={"accept": False}).json()["status"] == "declined"
    # answered once: a second answer is refused
    assert client.post("/v1/work/answer", headers=omar, json={"accept": True}).status_code == 409
    short, waiting = _board_gaps(client, op_a)
    assert short == {("wheelchair", None): 1} and ("interpreter", "ur") not in waiting

    # nobody else can push wheelchairs: the plan says so; then a new person joins and is planned for that shift
    v = client.post("/v1/dispatch/run", headers=as_op(op_a)).json()
    lost = next(i for i in v["plan"]["items"] if i["kind"] == "wheelchair")
    assert lost["missing"] == 1 and lost["people"] == [] and lost["shift_id"]
    _worker(client, op_a, "Yusuf Kareem", ["wheelchair"])
    v = client.post("/v1/dispatch/run", headers=as_op(op_a)).json()
    lost = next(i for i in v["plan"]["items"] if i["kind"] == "wheelchair")
    assert [p["name"] for p in lost["people"]] == ["Yusuf Kareem"] and lost["missing"] == 0
    v = client.post(f"/v1/dispatch/plans/{v['plan']['id']}/approve", headers=as_op(op_a)).json()
    assert v["asked"] == 1
    # the same shift, not a new one: one wheelchair shift with three people asked over time
    assert len({r["shift_id"] for r in v["requests"] if r["kind"] == "wheelchair"}) == 1


def test_automatic_asks_at_once_and_unanswered_requests_expire(client, op_b):
    g = _group(client, op_b, code="U-PK-0002")
    _pilgrims(client, op_b, g["id"], 2, start=50)
    f = _flight(client, op_b, number="sv 705", hours=8)
    client.post(f"/v1/flights/{f['id']}/pilgrims", headers=as_op(op_b), json={"group_id": g["id"]})
    _worker(client, op_b, "Sami Noor", ["wheelchair", "interpreter", "bus"], ["ur"])
    v = client.put("/v1/dispatch/settings", headers=as_op(op_b),
                   json={"mode": "auto", "horizon_hours": 24, "answer_minutes": 15}).json()
    assert v["settings"]["mode"] == "auto"
    v = client.post("/v1/dispatch/run", headers=as_op(op_b)).json()
    # one person, three needs in the same block: they can hold only one of them
    assert len(v["requests"]) == 1 and v["plan"] is None
    # nobody answers in time
    with tenant_session(_tenant(op_b)) as conn:
        conn.execute("UPDATE assignment SET answer_by = now() - interval '1 minute'")
        out = run.tick(conn, "Test", "http://x/w")
    assert out["expired"] == 1
    v = client.get("/v1/dispatch", headers=as_op(op_b)).json()
    assert v["requests"][0]["status"] == "expired"
    sami, _ = _link(v, "Sami Noor")
    assert client.post("/v1/work/answer", headers=sami, json={"accept": True}).status_code == 409


def test_arriving_only_near_the_shift_and_links_end_with_it(client, op_a):
    g = _group(client, op_a, code="U-PK-0003")
    _pilgrims(client, op_a, g["id"], 2, start=70)
    f = _flight(client, op_a, number="pk 760", hours=20)
    client.post(f"/v1/flights/{f['id']}/pilgrims", headers=as_op(op_a), json={"group_id": g["id"]})
    _worker(client, op_a, "Lina Haddad", ["wheelchair"])
    v = client.post("/v1/dispatch/run", headers=as_op(op_a)).json()
    v = client.post(f"/v1/dispatch/plans/{v['plan']['id']}/approve", headers=as_op(op_a)).json()
    lina, req = _link(v, "Lina Haddad")
    client.post("/v1/work/answer", headers=lina, json={"accept": True})
    assert client.post("/v1/work/arrived", headers=lina).status_code == 409     # too early
    # test set-up: move the shift close (the app's own role cannot change a shift's times)
    with owner_session() as conn:
        conn.execute("UPDATE resource_shift SET starts_at = now() + interval '1 hour', ends_at = now() + interval '7 hours'"
                     " WHERE id = %s", (req["shift_id"],))
    me = client.post("/v1/work/arrived", headers=lina).json()
    assert me["status"] == "arrived"
    # the shift is over: the link stops working
    with owner_session() as conn:
        conn.execute("UPDATE resource_shift SET starts_at = now() - interval '8 hours', ends_at = now() - interval '1 hour'"
                     " WHERE id = %s", (req["shift_id"],))
    with tenant_session(_tenant(op_a)) as conn:
        run.tick(conn, "Test", "http://x/w")
    assert client.get("/v1/work/me", headers=lina).status_code == 401


def test_who_may_do_what(client, op_a):
    viewer = issue(op_a, "viewer one", principal="viewer9", role="viewer")
    staff = issue(op_a, "staff one", principal="staff9", role="staff")
    v, s = {"Authorization": f"Bearer {viewer}"}, {"Authorization": f"Bearer {staff}"}
    assert client.get("/v1/dispatch", headers=v).status_code == 403            # phone numbers
    assert client.get("/v1/dispatch", headers=s).status_code == 200
    assert client.post("/v1/dispatch/run", headers=s).status_code == 403
    assert client.put("/v1/dispatch/settings", headers=s, json={"mode": "auto"}).status_code == 403
    assert client.post("/v1/workers", headers=s, json={"name": "X", "phone": "+966551234567", "roles": ["bus"],
                                                       "airports": ["JED"]}).status_code == 403
    assert client.get("/v1/work/me").status_code == 401
    assert client.get("/v1/work/me", headers={"Authorization": "Bearer wk_nothing"}).status_code == 401
    # off: the round does nothing on its own
    client.put("/v1/dispatch/settings", headers=as_op(op_a), json={"mode": "off"})
    with tenant_session(_tenant(op_a)) as conn:
        assert run.tick(conn, "Test", "http://x/w")["mode"] == "off"
