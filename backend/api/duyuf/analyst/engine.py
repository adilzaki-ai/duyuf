"""The AI analyst: a question in Arabic or English, answered from this operator's totals.

Claude (Opus 5.5) is given the tools in tools.py and nothing else. It decides
which totals to look at; this loop runs each tool inside the operator's own
database session, hands back the result, and keeps every call and result as
the answer's evidence. Advisory only: no tool writes anything.

Credentials come from the backend's environment (ANTHROPIC_API_KEY, loaded
from backend/.env.local by run-backend.sh); the browser never sees them.
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from pydantic import ValidationError

from ..arrivals.brief import KSA
from .tools import BY_NAME, TOOLS

MODEL = "claude-opus-5-5"
MAX_ROUNDS = 8
# Refusals are retried server-side on the model Anthropic recommends for the category.
BETAS = ["server-side-fallback-2026-07-01"]

SYSTEM = """You are the operations analyst inside Duyuf, the Hajj and Umrah operations platform of a Saudi \
service company. Staff ask you about this company's own pilgrims, groups, arrival flights, resources on shift \
and incidents. You answer from the tools, which return this company's live totals.

How to answer:
- Use the tools to get the numbers. Answer only from what they return. If they cannot answer the question, \
say plainly what is missing. Do not estimate unless asked, and label any estimate as one.
- You see totals, never people. No tool has names, passports, birth dates or phone numbers. If someone asks \
about a particular person, say that the analyst works with totals only and that the Pilgrims screen has the \
person's record.
- Reply in the language of the question: Arabic if it was asked in Arabic, otherwise English. Use short, \
plain sentences. Start with the answer itself, usually a number. Then give at most four short bullet points \
that matter. If the data points to something to do, end with one line starting "Suggested action:" \
(in Arabic: "الإجراء المقترح:"). It is advice; a person decides.
- Times are Saudi time (Asia/Riyadh). Read "today", "tomorrow" and "tonight" against the current time given \
with the question.
- When a comparison across three or more categories or time blocks would be clearer as a picture, call \
show_chart with numbers taken from the tool results.
- Do not mention the tools by name, and do not show raw data structures. Write for an operations lead."""


@dataclass
class Result:
    outcome: str  # answered | declined | cut_short
    answer: str
    sources: list[dict] = field(default_factory=list)
    charts: list[dict] = field(default_factory=list)
    model: str = MODEL
    input_tokens: int = 0
    output_tokens: int = 0
    seconds: float = 0.0


class NotConfigured(RuntimeError):
    """No credentials for the Claude API on this server."""


def make_client():
    """The Anthropic client. Replaced in tests."""
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        raise NotConfigured("ANTHROPIC_API_KEY is not set on the server")
    import anthropic
    # A question takes a few rounds; give up on any one call after two minutes.
    return anthropic.Anthropic(timeout=120.0, max_retries=2)


def _text(content: list) -> str:
    return "\n\n".join(b.text for b in content if getattr(b, "type", None) == "text" and b.text.strip()).strip()


def ask(question: str, tenant_id: str, operator: str, history: list[dict] | None = None, client=None) -> Result:
    client = client or make_client()
    started = time.monotonic()
    now = datetime.now(KSA)
    messages: list[dict[str, Any]] = []
    # Earlier questions in this conversation, as plain text, so follow-ups make sense.
    for turn in (history or [])[-4:]:
        messages.append({"role": "user", "content": turn["question"]})
        messages.append({"role": "assistant", "content": turn["answer"]})
    # The clock and the operator go with the question, not in the system prompt, so that stays cached.
    messages.append({"role": "user", "content": (
        f"Current time: {now.strftime('%A %Y-%m-%d %H:%M')} Saudi time. Operator: {operator}.\n\n"
        f"Question: {question}")})

    result = Result(outcome="answered", answer="")
    for _ in range(MAX_ROUNDS):
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM,
            tools=[t.schema() for t in TOOLS],
            messages=messages,
            output_config={"effort": "medium"},
            cache_control={"type": "ephemeral"},
            betas=BETAS,
            fallbacks="default",
        )
        usage = getattr(response, "usage", None)
        result.input_tokens += getattr(usage, "input_tokens", 0) or 0
        result.output_tokens += getattr(usage, "output_tokens", 0) or 0
        result.model = getattr(response, "model", MODEL) or MODEL

        if response.stop_reason == "refusal":
            result.outcome = "declined"
            result.answer = ("The analyst could not answer this question. Try asking it another way, "
                             "about totals rather than particular people.")
            break
        if response.stop_reason == "max_tokens":
            result.outcome = "cut_short"
            result.answer = (_text(response.content) + "\n\n(The answer was cut short.)").strip()
            break

        calls = [b for b in response.content if getattr(b, "type", None) == "tool_use"]
        if response.stop_reason != "tool_use" or not calls:
            result.answer = _text(response.content) or "No answer came back."
            break

        messages.append({"role": "assistant", "content": response.content})
        replies = []
        for call in calls:
            tool = BY_NAME.get(call.name)
            try:
                if tool is None:
                    raise ValueError(f"no tool called {call.name}")
                args = tool.args.model_validate(call.input)
                if tool.run is None:  # show_chart: kept for the screen, nothing to look up
                    result.charts.append(args.model_dump())
                    output: Any = {"shown": True}
                else:
                    output = tool.run(tenant_id, args)
                    result.sources.append({"tool": call.name, "input": args.model_dump(mode="json", exclude_defaults=True),
                                           "result": json.loads(json.dumps(output, default=str))})
                replies.append({"type": "tool_result", "tool_use_id": call.id,
                                "content": json.dumps(output, default=str, ensure_ascii=False)})
            except (ValidationError, ValueError) as exc:
                replies.append({"type": "tool_result", "tool_use_id": call.id, "is_error": True,
                                "content": f"That request did not fit the tool: {exc}"})
        # All results for one turn go back in one message.
        messages.append({"role": "user", "content": replies})
    else:
        result.outcome = "cut_short"
        result.answer = "The analyst needed more steps than allowed for one question. Try a narrower question."

    result.seconds = round(time.monotonic() - started, 1)
    return result
