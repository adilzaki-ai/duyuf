"""A pilgrim's journey, and the moves allowed along it.

The front end holds the same table (frontend/src/domain/journey.ts) so it only
offers moves the platform will accept; tests on both sides pin the two together.
"""
from __future__ import annotations

STATUSES = ("registered", "visa_issued", "arrived", "in_makkah", "in_madinah", "departed")

MOVES: dict[str, tuple[str, ...]] = {
    "registered": ("visa_issued",),
    # back to registered when a visa is refused or entered by mistake
    "visa_issued": ("arrived", "registered"),
    # straight to departed: a pilgrim sent home early (illness, family)
    "arrived": ("in_makkah", "in_madinah", "departed"),
    "in_makkah": ("in_madinah", "departed"),
    "in_madinah": ("in_makkah", "departed"),
    "departed": (),
}


def allowed(current: str) -> tuple[str, ...]:
    return MOVES.get(current, ())


def refusal(current: str, to: str) -> str | None:
    """Why `current → to` is refused, or None when it is allowed."""
    if to not in STATUSES:
        return f"unknown status {to!r}"
    if to == current:
        return f"already {current}"
    nxt = allowed(current)
    if to not in nxt:
        return (f"cannot go from {current} to {to}; "
                f"allowed: {', '.join(nxt) if nxt else 'nothing (the journey is over)'}")
    return None
