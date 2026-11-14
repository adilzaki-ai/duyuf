"""A booking's journey, and who may move it where.

The front end holds the same table (frontend/src/domain/bookings.ts) so it only
offers moves the platform will accept; a test there reads this file.

A pilgrim asks on Rafeeq. Staff check with the place, then confirm it (paid at
the place), ask for payment online first, or decline. A pilgrim pays an
"awaiting payment" booking to confirm it, and may cancel until it is confirmed;
after that only staff cancel, because money may need to go back.
"""
from __future__ import annotations

STATUSES = ("requested", "awaiting_payment", "confirmed", "declined", "cancelled")
KINDS = ("hotel", "restaurant", "attraction")

# action -> the statuses it may be taken from, and where it leaves the booking
MOVES: dict[str, tuple[tuple[str, ...], str]] = {
    "confirm": (("requested",), "confirmed"),
    "ask_payment": (("requested",), "awaiting_payment"),
    "decline": (("requested", "awaiting_payment"), "declined"),
    "pay": (("awaiting_payment",), "confirmed"),
    "cancel": (("requested", "awaiting_payment", "confirmed"), "cancelled"),
}

STAFF_ACTIONS = ("confirm", "ask_payment", "decline", "cancel")
PILGRIM_CANCEL_FROM = ("requested", "awaiting_payment")

# Hotel rooms: the types, how many each sleeps, and bed sizes.
ROOM_TYPES = ("single", "double", "twin", "triple", "quad", "family", "suite")
SLEEPS = {"single": 1, "double": 2, "twin": 2, "triple": 3, "quad": 4, "family": 5, "suite": 4}
BEDS = ("single", "double", "queen", "king")
# What a hotel can offer, and a pilgrim can ask for, for a disability or old age.
ACCESS = ("wheelchair_room", "roll_in_shower", "grab_bars", "near_elevator", "low_floor", "wheelchair_loan",
          "carer_bed", "visual_aids", "hearing_aids")
EXTRAS = ("breakfast", "mosque_view", "extra_bed", "late_checkout", "airport_pickup")

# new requests one card may send in a day
BOOKINGS_PER_DAY = 10
# how far ahead a pilgrim may book
DAYS_AHEAD = 120


def refusal(current: str, action: str) -> str | None:
    """Why `action` cannot be taken on a booking that is `current`, or None."""
    if action not in MOVES:
        return f"unknown action {action!r}"
    froms, _ = MOVES[action]
    if current not in froms:
        return f"cannot {action.replace('_', ' ')} a booking that is {current.replace('_', ' ')}"
    return None
