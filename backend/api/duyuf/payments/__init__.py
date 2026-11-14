"""Paying for a booking online.

No payment provider is signed yet: choosing one (Moyasar, HyperPay, Tap, …,
for mada, cards and Apple Pay) and the merchant account is the operator's
decision. Until then:

- a demonstration operator gets a TEST payment: the page takes the test card
  below, nothing is charged, and the booking says so;
- a real operator gets no online payment: staff confirm bookings to be paid at
  the place, and the page says online payment is not set up.

A real provider plugs in here: `mode()` returns its name, and `start()` and a
webhook confirm the charge before the booking is marked paid.
"""
from __future__ import annotations

import secrets

SANDBOX = "sandbox"
TEST_CARD = "4242424242424242"


def mode(is_demo: bool) -> str | None:
    """How this operator's pilgrims can pay online, or None when they cannot."""
    return SANDBOX if is_demo else None


def sandbox_charge(card_number: str) -> str:
    """A test payment: accepted for the test card only. Returns the payment reference."""
    if card_number.replace(" ", "") != TEST_CARD:
        raise ValueError("use the test card 4242 4242 4242 4242: this is a test payment")
    return "TEST-" + secrets.token_hex(4).upper()
