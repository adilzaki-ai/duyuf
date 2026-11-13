from __future__ import annotations

import json

import pytest

from conftest import as_op
from provision import provision
from seed_demo import SAMPLE, seed

from duyuf.core.db import owner_session
from duyuf.pilgrims.status import MOVES


def test_the_sample_only_takes_allowed_steps():
    data = json.loads(SAMPLE.read_text())
    for p in data["pilgrims"]:
        steps = p["history"]
        assert steps[0]["to"] == "registered" and steps[-1]["to"] == p["status"]
        for a, b in zip(steps, steps[1:]):
            assert b["from"] == a["to"] and b["to"] in MOVES[a["to"]], p["full_name"]
            assert (b["day"], b["hour"]) >= (a["day"], a["hour"])
        # before today, so no step can be later than the moment the demo is shown
        assert steps[-1]["day"] < 0, "nothing in a pilgrim's history is today or later"


def test_demo_loads_twice_and_shows_on_the_api(client):
    seed(reset=True)
    counts = seed(reset=True)
    o = client.get("/v1/overview", headers=as_op("duyuf-demo")).json()
    assert o["pilgrims"] == counts["pilgrims"] and o["groups"] == counts["groups"]
    assert o["arriving"], "a group lands this week"


def test_a_real_operator_is_never_wiped(op_a):
    with owner_session() as conn:
        conn.execute("UPDATE tenant SET slug = 'duyuf-demo-real' WHERE slug = %s", (op_a,))
    with pytest.raises(SystemExit):
        provision("duyuf-demo-real", "x", demo=True)
    with pytest.raises(Exception, match="is_demo is fixed"):
        with owner_session() as conn:
            conn.execute("UPDATE tenant SET is_demo = true WHERE slug = 'duyuf-demo-real'")


def test_the_sample_flights_fit_their_groups():
    data = json.loads(SAMPLE.read_text())
    flights = {f["number"]: f for f in data["flights"]}
    groups = {g["code"]: g for g in data["groups"]}
    for p in data["pilgrims"]:
        if p["flight"] is None:
            continue
        f = flights[p["flight"]]
        # lands the day its group arrives, carrying only pilgrims not yet in the Kingdom
        assert f["day"] == groups[p["group_code"]]["arrive_in_days"], p["full_name"]
        assert p["status"] in ("registered", "visa_issued"), p["full_name"]
    assert all(p["language"] for p in data["pilgrims"])
