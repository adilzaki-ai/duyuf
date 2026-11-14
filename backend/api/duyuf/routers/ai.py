"""The staff's AI helpers: the briefing, the incident co-pilot, the arrival advisor.

Instructions in ai/prompts.py; what each may see in ai/situations.py. Every
answer is advice: nothing here writes anything but the call log (ai_call),
which keeps who asked, the model and the tokens, never the content.
"""
from __future__ import annotations

import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..ai import core, prompts, situations
from ..core.auth import Identity, require
from ..core.db import tenant_session

router = APIRouter(prefix="/v1/ai", tags=["ai"])

BRIEF_FRESH_S = 600  # a briefing is reused for 10 minutes unless refreshed
_briefs: dict[tuple[str, str], tuple[float, dict]] = {}


class Lang(BaseModel):
    language: Literal["en", "ar"] = "en"


class BriefIn(Lang):
    refresh: bool = False


class AdviceIn(Lang):
    hours: int = Field(default=24, ge=6, le=72)


def _call(who: Identity, helper: str, system: str, schema: dict, language: str, situation: dict,
          request: str) -> dict:
    import anthropic
    try:
        a = core.ask(system, schema, language, situation, request)
    except core.NotConfigured as exc:
        raise HTTPException(503, f"the AI helpers are not set up on this server: {exc}")
    except anthropic.AuthenticationError:
        raise HTTPException(503, "the AI helpers' API key was refused; check ANTHROPIC_API_KEY on the server")
    except (anthropic.APIConnectionError, anthropic.APITimeoutError):
        raise HTTPException(503, "the AI helpers cannot be reached just now")
    except anthropic.APIStatusError as exc:
        raise HTTPException(502, f"the AI helper failed ({exc.status_code}); try again")
    with tenant_session(who.tenant_id) as conn:
        conn.execute(
            """INSERT INTO ai_call (helper, asked_by, outcome, model, input_tokens, output_tokens, seconds)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (helper, who.display_name, a.outcome, a.model, a.input_tokens, a.output_tokens, a.seconds))
        conn.execute("DELETE FROM ai_call WHERE at < now() - interval '90 days'")
    if a.outcome == "declined":
        raise HTTPException(422, "the AI helper declined to answer this one")
    if a.outcome != "answered" or not a.data:
        raise HTTPException(502, "the AI helper gave no usable answer; try again")
    return {**a.data, "model": a.model}


@router.get("/status")
def status(who: Identity = Depends(require("analyst:ask"))):
    try:
        core.make_client()
        return {"ready": True, "model": core.model()}
    except core.NotConfigured as exc:
        return {"ready": False, "model": core.model(), "reason": str(exc)}


@router.post("/brief")
def brief(body: BriefIn, who: Identity = Depends(require("analyst:ask"))):
    """The shift briefing, from today's totals."""
    key = (who.tenant_id, body.language)
    hit = _briefs.get(key)
    if hit and not body.refresh and time.time() - hit[0] < BRIEF_FRESH_S:
        return {**hit[1], "cached": True}
    with tenant_session(who.tenant_id) as conn:
        situation = situations.brief(conn, who.tenant_name)
    out = _call(who, "brief", prompts.BRIEF, prompts.BRIEF_SCHEMA, body.language, situation,
                "Write the shift briefing from these totals.")
    out["points"] = [p for p in out.get("points", []) if p.get("screen") in prompts.SCREENS][:5]
    out["at"] = time.time()
    _briefs[key] = (time.time(), out)
    return {**out, "cached": False}


@router.post("/incidents/{incident_id}/copilot")
def copilot(incident_id: str, body: Lang, who: Identity = Depends(require("incident:write"))):
    """Help with one incident: priority, team, next step, messages in the pilgrim's language."""
    with tenant_session(who.tenant_id) as conn:
        situation = situations.copilot(conn, incident_id, who)
    return _call(who, "copilot", prompts.COPILOT, prompts.COPILOT_SCHEMA, body.language, situation,
                 "Help the desk with this incident.")


@router.post("/arrivals/advice")
def advice(body: AdviceIn, who: Identity = Depends(require("flight:read"))):
    """Each gap on the board explained, with a fix the planner can preview."""
    with tenant_session(who.tenant_id) as conn:
        situation = situations.advisor(conn, body.hours)
    if not situation["gaps"]:
        return {"summary": None, "items": [], "gaps": [], "model": None}
    out = _call(who, "advisor", prompts.ADVISOR, prompts.ADVISOR_SCHEMA, body.language, situation,
                "Explain each gap and how to close it.")
    gaps = {g["gap"]: g for g in situation["gaps"]}
    items = []
    for it in out.get("items", []):
        g = gaps.get(it.get("gap"))
        if not g:
            continue
        x = it.get("extra")
        # only a fix that fits the board can be previewed: an airport on it, enough to close the gap
        if x and not (x.get("airport") in {b["airport"] for b in situation["blocks"]} and
                      x.get("kind") in ("wheelchair", "bus", "interpreter") and
                      (x.get("kind") == "interpreter") == bool(x.get("language")) and
                      isinstance(x.get("quantity"), int) and x["quantity"] >= 1):
            x = None
        items.append({**it, "extra": x, "of": g})
    return {"summary": out.get("summary"), "items": items, "gaps": situation["gaps"], "model": out["model"]}
