"""One call to Claude with a fixed answer shape, for the staff helpers in prompts.py.

The model is DUYUF_AI_MODEL, Claude Opus 5.5 unless set (claude-haiku-5-5 is
the cheap option; the operator's choice). Credentials come from the
backend's environment (ANTHROPIC_API_KEY in backend/.env.local); the browser
never sees them. Low effort: these are short answers to a lead who is waiting.
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from typing import Any

# Refusals are retried server-side on the model Anthropic recommends for the category (not offered on Haiku).
BETAS = ["server-side-fallback-2026-07-01"]
LANGUAGE_NAMES = {"en": "English", "ar": "Arabic"}


def model() -> str:
    return os.environ.get("DUYUF_AI_MODEL") or "claude-opus-5-5"


class NotConfigured(RuntimeError):
    """No credentials for the Claude API on this server."""


def make_client():
    """The Anthropic client. Replaced in tests."""
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        raise NotConfigured("ANTHROPIC_API_KEY is not set on the server")
    import anthropic
    return anthropic.Anthropic(timeout=60.0, max_retries=1)


@dataclass
class Answer:
    outcome: str  # answered | declined | failed
    data: dict[str, Any] | None = None
    model: str = field(default_factory=model)
    input_tokens: int = 0
    output_tokens: int = 0
    seconds: float = 0.0


def ask(system: str, schema: dict, language: str, situation: dict, request: str, client=None) -> Answer:
    """`request` is the one line of what is wanted; the situation goes with it as JSON."""
    client = client or make_client()
    name = model()
    started = time.monotonic()
    text = (f"Write in {LANGUAGE_NAMES.get(language, 'English')}.\n"
            f"{request}\n\n{json.dumps(situation, ensure_ascii=False, default=str)}")
    extra = {} if name.startswith("claude-haiku") else {"betas": BETAS, "fallbacks": "default"}
    response = client.beta.messages.create(
        model=name,
        max_tokens=8000,
        system=system,
        messages=[{"role": "user", "content": text}],
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
        cache_control={"type": "ephemeral"},
        **extra,
    )
    usage = getattr(response, "usage", None)
    out = Answer(outcome="answered", model=getattr(response, "model", name) or name,
                 input_tokens=getattr(usage, "input_tokens", 0) or 0,
                 output_tokens=getattr(usage, "output_tokens", 0) or 0)
    if response.stop_reason == "refusal":
        out.outcome = "declined"
    elif response.stop_reason == "max_tokens":
        out.outcome = "failed"
    else:
        body = next((b.text for b in response.content if getattr(b, "type", None) == "text"), "")
        try:
            out.data = json.loads(body)
        except ValueError:
            out.outcome = "failed"
    out.seconds = round(time.monotonic() - started, 1)
    return out
