"""The AI analyst: ask a question about this operator's totals, in Arabic or English.

Every question and answer is kept with the data the answer came from
(analyst_question), so any answer can be checked later.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from ..analyst import engine
from ..core.auth import Identity, require
from ..core.db import tenant_session

router = APIRouter(prefix="/v1/analyst", tags=["analyst"])


class Turn(BaseModel):
    question: str = Field(max_length=2000)
    answer: str = Field(max_length=8000)


class Ask(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    history: list[Turn] = Field(default=[], max_length=4)


_COLS = """id::text, asked_by, question, outcome, answer, sources, charts, model, input_tokens,
           output_tokens, seconds::float, asked_at"""


def _record(who: Identity, question: str, r: engine.Result | None, outcome: str | None = None) -> dict:
    with tenant_session(who.tenant_id) as conn:
        return conn.execute(
            f"""INSERT INTO analyst_question (asked_by, question, outcome, answer, sources, charts, model,
                       input_tokens, output_tokens, seconds)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING {_COLS}""",
            (who.display_name, question, outcome or r.outcome, r.answer if r else None,
             Jsonb(r.sources if r else []), Jsonb(r.charts if r else []), r.model if r else engine.MODEL,
             r.input_tokens if r else None, r.output_tokens if r else None, r.seconds if r else None)).fetchone()


@router.get("/status")
def status(who: Identity = Depends(require("analyst:ask"))):
    """Whether this server can reach the analyst at all, so the screen can say so before anyone types."""
    try:
        engine.make_client()
        return {"ready": True, "model": engine.MODEL}
    except engine.NotConfigured as exc:
        return {"ready": False, "model": engine.MODEL, "reason": str(exc)}


@router.post("/ask")
def ask(body: Ask, who: Identity = Depends(require("analyst:ask"))):
    import anthropic

    question = body.question.strip()
    operator = who.tenant_name
    try:
        r = engine.ask(question, who.tenant_id, operator, [t.model_dump() for t in body.history])
    except engine.NotConfigured as exc:
        raise HTTPException(503, f"the analyst is not set up on this server: {exc}")
    except anthropic.AuthenticationError:
        _record(who, question, None, "failed")
        raise HTTPException(503, "the analyst's API key was refused; check ANTHROPIC_API_KEY on the server")
    except anthropic.RateLimitError:
        _record(who, question, None, "failed")
        raise HTTPException(429, "the analyst is busy; try again in a minute")
    except anthropic.APIConnectionError:
        _record(who, question, None, "failed")
        raise HTTPException(503, "the analyst cannot be reached from this server")
    except anthropic.APIStatusError as exc:
        _record(who, question, None, "failed")
        raise HTTPException(502, f"the analyst failed ({exc.status_code}); try again")
    return _record(who, question, r)


@router.get("/recent")
def recent(limit: int = Query(default=20, ge=1, le=100), who: Identity = Depends(require("analyst:ask"))):
    """This operator's latest questions, everyone's, newest first: the record of what was asked and answered."""
    with tenant_session(who.tenant_id) as conn:
        return {"items": conn.execute(
            f"SELECT {_COLS} FROM analyst_question ORDER BY asked_at DESC LIMIT %s", (limit,)).fetchall()}
