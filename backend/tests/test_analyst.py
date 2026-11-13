"""The analyst, with Claude replaced by a script: these tests never call the API."""
from __future__ import annotations

import json
from types import SimpleNamespace as NS

import pytest
from conftest import as_op
from seed_demo import SAMPLE, seed

from duyuf.analyst import engine
from duyuf.analyst.tools import TOOLS, ArrivalsArgs, CountArgs, IncidentArgs, NoArgs, count_pilgrims
from duyuf.core.db import owner_session


def _use(name, args, id_="t1"):
    return NS(type="tool_use", id=id_, name=name, input=args)


def _say(text, stop="end_turn"):
    return NS(stop_reason=stop, content=[NS(type="text", text=text)],
              usage=NS(input_tokens=100, output_tokens=20), model=engine.MODEL)


def _calls(*blocks):
    return NS(stop_reason="tool_use", content=list(blocks), usage=NS(input_tokens=100, output_tokens=20),
              model=engine.MODEL)


class Scripted:
    """Answers each request with the next scripted response, and keeps what it was sent."""

    def __init__(self, *responses):
        self.responses, self.sent = list(responses), []
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.sent.append({**kw, "messages": list(kw["messages"])})   # as it was at the time
        return self.responses.pop(0)


@pytest.fixture
def demo():
    seed(reset=True)
    with owner_session() as conn:
        return conn.execute("SELECT id::text FROM tenant WHERE slug = 'duyuf-demo'").fetchone()["id"]


def _script(monkeypatch, *responses) -> Scripted:
    s = Scripted(*responses)
    monkeypatch.setattr(engine, "make_client", lambda: s)
    return s


def test_a_question_is_answered_from_totals_with_its_evidence_kept(client, demo, monkeypatch):
    s = _script(monkeypatch,
                _calls(_use("count_pilgrims", {"group_by": ["nationality"], "filters": {"in_kingdom": True}})),
                _calls(_use("show_chart", {"title": "In the Kingdom", "labels": ["PK", "ID"], "values": [35, 39]}, "t2")),
                _say("74 pilgrims are in the Kingdom.\n- Pakistan 35"))
    r = client.post("/v1/analyst/ask", headers=as_op("duyuf-demo"), json={"question": "Who is here now?"})
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["outcome"] == "answered" and a["answer"].startswith("74 pilgrims")
    assert a["charts"] == [{"title": "In the Kingdom", "labels": ["PK", "ID"], "values": [35.0, 39.0], "unit": None}]
    [src] = a["sources"]
    assert src["tool"] == "count_pilgrims" and src["input"] == {"group_by": ["nationality"], "filters": {"in_kingdom": True}}
    expected = client.get("/v1/overview", headers=as_op("duyuf-demo")).json()["by_status"]
    assert src["result"]["pilgrims"] == expected["arrived"] + expected["in_makkah"] + expected["in_madinah"]
    assert a["input_tokens"] == 300 and a["asked_by"] == "developer"

    first = s.sent[0]
    assert first["model"] == "claude-opus-5-5" and first["fallbacks"] == "default"
    assert first["betas"] == ["server-side-fallback-2026-07-01"]
    assert {t["name"] for t in first["tools"]} == {t.name for t in TOOLS}
    assert "Question: Who is here now?" in first["messages"][-1]["content"]
    # every tool result went back in one user message, after the assistant's call
    assert s.sent[1]["messages"][-1]["content"][0]["tool_use_id"] == "t1"

    recent = client.get("/v1/analyst/recent", headers=as_op("duyuf-demo")).json()["items"]
    assert recent[0]["id"] == a["id"] and recent[0]["sources"][0]["tool"] == "count_pilgrims"


def test_no_tool_lets_a_person_out(demo):
    """Run every tool broadly over the demo, and look for anything that names someone."""
    data = json.loads(SAMPLE.read_text())
    secrets = set()
    for p in data["pilgrims"]:
        secrets |= {p["full_name"], p["passport_no"]}
        if p["full_name_ar"]:
            secrets.add(p["full_name_ar"])
    for g in data["groups"]:
        secrets |= {g["leader_name"], g["leader_phone"]}
    secrets |= {i["description"] for i in data["incidents"]}
    outputs = [count_pilgrims(demo, CountArgs(group_by=[d], filters={})) for d in
               ("status", "nationality", "group", "need", "language", "age_band", "flight", "arrival_airport")]
    outputs += [t.run(demo, ArrivalsArgs(hours=168)) for t in TOOLS if t.name == "arrivals_board"]
    outputs += [t.run(demo, IncidentArgs(status="all")) for t in TOOLS if t.name == "incidents"]
    outputs += [t.run(demo, NoArgs()) for t in TOOLS if t.name in ("list_groups", "resources_on_shift")]
    text = json.dumps(outputs, default=str, ensure_ascii=False)
    leaked = sorted(x for x in secrets if x and x in text)
    assert leaked == []


def test_counts_follow_flights_ages_and_needs(demo):
    ga = count_pilgrims(demo, CountArgs(filters={"flight": ["ga 980"]}))
    assert ga["pilgrims"] == 44
    madinah = count_pilgrims(demo, CountArgs(group_by=["flight"], filters={"arrival_airport": ["med"]}))
    assert {r["flight"] for r in madinah["rows"]} == {"GA 980", "SV 3304", "TK 92"}
    by_need = count_pilgrims(demo, CountArgs(group_by=["need"], filters={"group": ["U-ID-0430"]}))
    assert by_need["pilgrims"] == 44 and "note" in by_need
    assert sum(r["pilgrims"] for r in by_need["rows"]) >= 44   # several needs count under each
    older = count_pilgrims(demo, CountArgs(filters={"min_age": 75}))["pilgrims"]
    split = count_pilgrims(demo, CountArgs(group_by=["age_band"]))["rows"]
    assert older == next(r["pilgrims"] for r in split if r["age_band"] == "75 and over")


def test_a_bad_tool_request_is_answered_with_an_error_and_the_loop_goes_on(client, demo, monkeypatch):
    s = _script(monkeypatch,
                _calls(_use("count_pilgrims", {"group_by": ["passport_no"]})),
                _say("I could not split by passport; the analyst works with totals."))
    a = client.post("/v1/analyst/ask", headers=as_op("duyuf-demo"), json={"question": "passports?"}).json()
    assert a["outcome"] == "answered" and a["sources"] == []
    reply = s.sent[1]["messages"][-1]["content"][0]
    assert reply["is_error"] is True and "did not fit the tool" in reply["content"]


def test_a_refusal_is_said_plainly_and_kept(client, demo, monkeypatch):
    _script(monkeypatch, NS(stop_reason="refusal", content=[], usage=NS(input_tokens=5, output_tokens=0),
                            model=engine.MODEL))
    a = client.post("/v1/analyst/ask", headers=as_op("duyuf-demo"), json={"question": "something"}).json()
    assert a["outcome"] == "declined" and a["answer"].startswith("The analyst could not answer")


def test_without_a_key_the_server_says_so(client, op_a, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    st = client.get("/v1/analyst/status", headers=as_op(op_a)).json()
    assert st["ready"] is False and "ANTHROPIC_API_KEY" in st["reason"]
    r = client.post("/v1/analyst/ask", headers=as_op(op_a), json={"question": "how many?"})
    assert r.status_code == 503 and "not set up" in r.json()["detail"]


def test_each_operator_sees_only_its_own_questions(client, op_a, op_b, monkeypatch):
    _script(monkeypatch, _say("None yet."))
    client.post("/v1/analyst/ask", headers=as_op(op_a), json={"question": "how many pilgrims?"})
    assert len(client.get("/v1/analyst/recent", headers=as_op(op_a)).json()["items"]) == 1
    assert client.get("/v1/analyst/recent", headers=as_op(op_b)).json()["items"] == []
