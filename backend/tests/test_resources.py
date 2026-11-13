from __future__ import annotations

from datetime import datetime, timedelta

from conftest import as_op
from issue_key import issue
from seed_demo import seed

from duyuf.arrivals.brief import KSA
from duyuf.arrivals.plan import load


def _brief(wc=0, buses=1, langs=()):
    return {"wheelchair": wc, "buses": buses, "pilgrims": 10,
            "languages": [{"language": l, "pilgrims": 40 * n, "interpreters": n} for l, n in langs]}


def test_need_against_shift_block_by_block():
    """The same case as plan.test.ts on the web side."""
    now = datetime(2026, 11, 13, 10, 0, tzinfo=KSA)                  # block 09:00–12:00
    f = lambda n, h, ap, b, landed=None: {"number": n, "expected_at": now + timedelta(hours=h),
                                          "landed_at": landed, "arrival_airport": ap, "brief": b}
    flights = [
        f("A 1", 0.5, "JED", _brief(wc=3, langs=[("ur", 1)])),       # 10:30, block 09–12
        f("A 2", 1.5, "JED", _brief(wc=2, langs=[("ur", 1), ("id", 2)])),  # 11:30, same block
        f("A 3", 4, "JED", _brief(wc=1)),                              # 14:00, block 12–15
        f("A 4", 0.2, "MED", _brief(wc=9), landed=now),                # down: needs nothing
    ]
    shift = lambda kind, q, lang=None, start=-1, end=5: {
        "airport": "JED", "kind": kind, "language": lang, "quantity": q,
        "starts_at": now + timedelta(hours=start), "ends_at": now + timedelta(hours=end)}
    shifts = [shift("wheelchair", 4), shift("bus", 2), shift("interpreter", 2, "ur"),
              shift("wheelchair", 5, start=0)]                         # starts 10:00: misses the 09:00 block
    rows = load(flights, shifts, now, 12)
    assert [(r["start"].hour, r["airport"], r["flights"]) for r in rows] == [(9, "JED", ["A 1", "A 2"]),
                                                                             (12, "JED", ["A 3"])]
    first, second = rows
    assert first["need"] == {"wheelchair": 5, "bus": 2, "interpreter": {"ur": 2, "id": 2}}
    assert first["have"] == {"wheelchair": 4, "bus": 2, "interpreter": {"ur": 2}}
    assert first["short"] == [{"kind": "wheelchair", "language": None, "short": 1},
                              {"kind": "interpreter", "language": "id", "short": 2}]
    # 12:00–15:00 is covered by both wheelchair shifts (the first runs to 15:00)
    assert second["have"]["wheelchair"] == 9 and second["short"] == []


def _shift(client, slug, **kw):
    now = datetime.now(KSA).replace(microsecond=0, tzinfo=None)
    body = {"airport": "jed", "kind": "wheelchair", "quantity": 4,
            "starts_at": (now - timedelta(hours=6)).isoformat(), "ends_at": (now + timedelta(days=3)).isoformat(),
            **kw}
    return client.post("/v1/resources", headers=as_op(slug), json=body)


def test_shifts_are_planned_listed_and_removed(client, op_a, op_b):
    r = _shift(client, op_a)
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["airport"] == "JED" and s["starts_at"].endswith("+03:00") and s["created_by"] == "developer"
    assert _shift(client, op_a, kind="interpreter").status_code == 422           # no language
    assert _shift(client, op_a, language="ur").status_code == 422                # wheelchairs speak none
    assert _shift(client, op_a, ends_at="2020-01-01T00:00:00").status_code == 422
    assert _shift(client, op_a, kind="interpreter", language="ur").status_code == 201
    assert len(client.get("/v1/resources", headers=as_op(op_a)).json()["items"]) == 2

    # another operator sees none of it and cannot remove it
    assert client.get("/v1/resources", headers=as_op(op_b)).json()["items"] == []
    assert client.delete(f"/v1/resources/{s['id']}", headers=as_op(op_b)).status_code == 404
    # desk staff read the plan, but do not change it
    desk = {"Authorization": f"Bearer {issue(op_a, 'test', principal='desk', role='staff', display_name='Desk')}"}
    assert len(client.get("/v1/resources", headers=desk).json()["items"]) == 2
    assert client.delete(f"/v1/resources/{s['id']}", headers=desk).status_code == 403
    assert client.delete(f"/v1/resources/{s['id']}", headers=as_op(op_a)).status_code == 204
    assert client.delete(f"/v1/resources/{s['id']}", headers=as_op(op_a)).status_code == 404


def test_the_demo_board_shows_madinah_short_and_what_if_closes_it(client):
    seed(reset=True)
    h = as_op("duyuf-demo")
    week = client.get("/v1/arrivals", headers=h, params={"hours": 168}).json()
    by = {f["number"]: f for f in week["flights"]}
    ga = by["GA 980"]
    row = next(r for r in week["load"] if "GA 980" in r["flights"])
    assert row["airport"] == "MED" and row["need"]["interpreter"] == {"id": 2}
    assert {(s["kind"], s["language"]): s["short"] for s in row["short"]} == {("wheelchair", None): 1,
                                                                              ("interpreter", "id"): 1}
    assert ga["short"] is True and by["MS 683"]["short"] is False
    assert not week["what_if"]

    # One more Indonesian interpreter and one wheelchair at Madinah: that block is covered.
    fixed = client.post("/v1/arrivals/what-if", headers=h, json={"hours": 168, "extra": [
        {"airport": "MED", "kind": "interpreter", "language": "id", "quantity": 1},
        {"airport": "MED", "kind": "wheelchair", "quantity": 1}]}).json()
    assert fixed["what_if"] is True
    assert next(r for r in fixed["load"] if "GA 980" in r["flights"])["short"] == []

    # GA 980 three hours later: the board moves it, and nothing is saved.
    later = client.post("/v1/arrivals/what-if", headers=h,
                        json={"hours": 168, "delays": [{"flight_id": ga["id"], "minutes": 180}]}).json()
    moved = next(f for f in later["flights"] if f["number"] == "GA 980")
    assert moved["delay_minutes"] == ga["delay_minutes"] + 180 and moved["state"] == "delayed"
    assert datetime.fromisoformat(moved["expected_at"]) - datetime.fromisoformat(ga["expected_at"]) == timedelta(hours=3)
    # and nothing was saved
    again = client.get(f"/v1/flights/{ga['id']}", headers=h).json()
    assert again["expected_at"] == ga["expected_at"]

    assert client.post("/v1/arrivals/what-if", headers=h, json={"extra": [
        {"airport": "MED", "kind": "interpreter", "quantity": 1}]}).status_code == 422
