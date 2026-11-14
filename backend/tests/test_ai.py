"""The staff AI helpers, with Claude replaced by a script: no test calls the real API."""
from __future__ import annotations

import json
from types import SimpleNamespace as NS

import pytest
from conftest import as_op
from issue_key import issue
from seed_demo import seed

from duyuf.ai import core
from duyuf.core.db import owner_session
from duyuf.routers import ai as ai_router


def _reply(data: dict, stop="end_turn"):
    content = [] if stop == "refusal" else [NS(type="text", text=json.dumps(data))]
    return NS(stop_reason=stop, content=content, usage=NS(input_tokens=900, output_tokens=200), model=core.model())


class Scripted:
    def __init__(self, *responses):
        self.responses, self.sent = list(responses), []
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.sent.append(kw)
        return self.responses.pop(0)


def _script(monkeypatch, *responses) -> Scripted:
    s = Scripted(*responses)
    monkeypatch.setattr(core, "make_client", lambda: s)
    return s


DEMO = as_op("duyuf-demo")
BRIEF = {"headline": "Madinah is short of wheelchairs for the morning wave.",
         "points": [{"text": "Madinah short 1 wheelchair 06:00-09:00.", "tone": "act", "screen": "arrivals"},
                    {"text": "One SOS is waiting for a team.", "tone": "act", "screen": "incidents"},
                    {"text": "Nowhere", "tone": "ok", "screen": "nowhere"}],
         "first_action": {"text": "Give the SOS to a team.", "screen": "incidents"}}


@pytest.fixture
def demo():
    ai_router._briefs.clear()
    seed(reset=True)


def test_the_briefing_reads_totals_only_and_is_reused_for_ten_minutes(client, demo, monkeypatch):
    s = _script(monkeypatch, _reply(BRIEF), _reply(BRIEF))
    r = client.post("/v1/ai/brief", headers=DEMO, json={"language": "en"})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["headline"].startswith("Madinah") and b["cached"] is False
    assert [p["screen"] for p in b["points"]] == ["arrivals", "incidents"]     # a screen that does not exist is dropped
    said = s.sent[0]["messages"][0]["content"]
    situation = json.loads(said[said.index("{"):])
    assert situation["arrivals_next_48h"]["gaps"] and situation["incidents"]["open"] >= 1
    with owner_session() as conn:
        names = [r["full_name"] for r in conn.execute("SELECT full_name FROM pilgrim LIMIT 50")]
        passports = [r["passport_no"] for r in conn.execute("SELECT passport_no FROM pilgrim LIMIT 50")]
    assert not any(n in said for n in names) and not any(p in said for p in passports)
    assert s.sent[0]["output_config"]["format"]["type"] == "json_schema"

    again = client.post("/v1/ai/brief", headers=DEMO, json={"language": "en"}).json()
    assert again["cached"] is True and len(s.sent) == 1
    client.post("/v1/ai/brief", headers=DEMO, json={"language": "en", "refresh": True})
    assert len(s.sent) == 2
    with owner_session() as conn:
        logged = conn.execute("SELECT helper, outcome, input_tokens FROM ai_call ORDER BY id DESC LIMIT 1").fetchone()
    assert logged == {"helper": "brief", "outcome": "answered", "input_tokens": 900}


def test_the_copilot_sees_one_incident_and_first_names_only(client, demo, monkeypatch):
    sos = next(i for i in client.get("/v1/incidents", headers=DEMO).json()["items"] if i["kind"] == "sos")
    msg = {"language": "ur", "text": "…", "english": "Please stay where you are."}
    s = _script(monkeypatch, _reply({"summary": "SOS at gate 79, not answering.", "priority_ok": True,
                                     "suggested_priority": "urgent", "team": "Makkah field team",
                                     "next_step": "Send the field team to gate 79.",
                                     "message_to_leader": msg, "message_to_pilgrim": msg}))
    r = client.post(f"/v1/ai/incidents/{sos['id']}/copilot", headers=DEMO, json={"language": "en"})
    assert r.status_code == 200, r.text
    assert r.json()["team"] == "Makkah field team" and r.json()["message_to_pilgrim"]["english"]
    said = s.sent[0]["messages"][0]["content"]
    first, *rest = sos["pilgrim_name"].split(" ")
    assert f'"first_name": "{first}"' in said and " ".join(rest) not in said
    assert '"language": "ur"' in said and "passport" not in said.lower() and "+966" not in said
    # a viewer follows incidents but cannot ask the co-pilot
    viewer = {"Authorization": f"Bearer {issue('duyuf-demo', 'test', principal='v', role='viewer', display_name='V')}"}
    assert client.post(f"/v1/ai/incidents/{sos['id']}/copilot", headers=viewer, json={}).status_code == 403


def test_the_advisor_explains_each_gap_and_only_previewable_fixes_survive(client, demo, monkeypatch):
    s = _script(monkeypatch, _reply({"summary": "Two gaps at Madinah.", "items": [
        {"gap": 1, "explain": "MS 683 brings more wheelchair users than are on shift.", "fix": "Add one wheelchair.",
         "extra": {"airport": "MED", "kind": "wheelchair", "language": None, "quantity": 1}},
        {"gap": 2, "explain": "Indonesian speakers outnumber interpreters.", "fix": "Add an interpreter.",
         "extra": {"airport": "XXX", "kind": "interpreter", "language": "id", "quantity": 1}},
        {"gap": 99, "explain": "made up", "fix": "none", "extra": None}]}))
    r = client.post("/v1/ai/arrivals/advice", headers=DEMO, json={"language": "en", "hours": 48})
    assert r.status_code == 200, r.text
    a = r.json()
    assert len(a["gaps"]) >= 2 and [i["gap"] for i in a["items"]] == [1, 2]     # a gap that does not exist is dropped
    assert a["items"][0]["extra"]["airport"] == "MED" and a["items"][1]["extra"] is None   # not on the board
    said = s.sent[0]["messages"][0]["content"]
    assert '"spare"' in said and '"gaps"' in said


def test_without_a_key_the_helpers_say_so(client, demo, monkeypatch):
    def unset():
        raise core.NotConfigured("ANTHROPIC_API_KEY is not set on the server")
    monkeypatch.setattr(core, "make_client", unset)
    assert client.get("/v1/ai/status", headers=DEMO).json()["ready"] is False
    r = client.post("/v1/ai/brief", headers=DEMO, json={})
    assert r.status_code == 503 and "not set up" in r.json()["detail"]


def test_a_refusal_is_said_plainly(client, demo, monkeypatch):
    _script(monkeypatch, _reply({}, stop="refusal"))
    r = client.post("/v1/ai/brief", headers=DEMO, json={"refresh": True})
    assert r.status_code == 422 and "declined" in r.json()["detail"]
