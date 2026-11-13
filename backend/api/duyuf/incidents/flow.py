"""An incident's journey, and the moves allowed along it.

The front end holds the same table (frontend/src/domain/incidents.ts) so it only
offers moves the platform will accept; a test there reads this file.
"""
from __future__ import annotations

STATUSES = ("open", "assigned", "resolved")
KINDS = ("sos", "lost", "medical", "heat", "transport", "other")
PRIORITIES = ("urgent", "high", "normal")

# action -> the statuses it may be taken from, and where it leaves the incident
MOVES: dict[str, tuple[tuple[str, ...], str]] = {
    # to a team, or to another team
    "assign": (("open", "assigned"), "assigned"),
    "resolve": (("open", "assigned"), "resolved"),
    # it was not over after all
    "reopen": (("resolved",), "open"),
}


def refusal(current: str, action: str) -> str | None:
    """Why `action` cannot be taken on an incident that is `current`, or None."""
    if action not in MOVES:
        return f"unknown action {action!r}"
    froms, _ = MOVES[action]
    if current not in froms:
        return f"cannot {action} an incident that is {current}"
    return None
