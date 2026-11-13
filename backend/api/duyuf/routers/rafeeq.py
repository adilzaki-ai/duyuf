"""Rafeeq: the pilgrim's own phone page, and the cards that open it.

A card is a link with a secret in it, printed as a QR code and handed to one
pilgrim. It opens their page: their group leader's number, and three calls
for help (SOS, lost, unwell in the heat) that land in the incident feed at
once as urgent. The card reads nothing else and changes nothing else. Only
its hash is kept, so a lost card is replaced, never shown again, and a new
card stops the old one.

Safety help only: Rafeeq gives no religious rulings.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from ..core.auth import CardHolder, Identity, card_holder, hash_key, new_card_token, require
from ..core.db import tenant_session
from ..rafeeq.help import (ACTOR, CALLS_PER_HOUR, FINE_NOTE, HELP, LANGUAGES, PRESSED_AGAIN,
                           description)

router = APIRouter(tags=["rafeeq"])


# ---- staff: handing out cards ----

def _card(conn, pilgrim_id: str) -> dict | None:
    return conn.execute(
        """SELECT language, issued_by, issued_at, last_used_at FROM rafeeq_card
            WHERE pilgrim_id = %s AND revoked_at IS NULL""", (pilgrim_id,)).fetchone()


def _holder(conn, pilgrim_id: str) -> dict:
    row = conn.execute(
        """SELECT p.id::text AS pilgrim_id, p.full_name, p.full_name_ar, p.language, p.status,
                  g.code AS group_code, g.name AS group_name
             FROM pilgrim p JOIN pilgrim_group g ON g.id = p.group_id WHERE p.id = %s""",
        (pilgrim_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such pilgrim")
    return row


def _issue(conn, p: dict, language: str | None, who: Identity) -> dict:
    """A new card for this pilgrim; any card they had stops working."""
    language = language or (p["language"] if p["language"] in LANGUAGES else "en")
    conn.execute("UPDATE rafeeq_card SET revoked_at = now() WHERE pilgrim_id = %s AND revoked_at IS NULL",
                 (p["pilgrim_id"],))
    token = new_card_token()
    conn.execute("INSERT INTO rafeeq_card (pilgrim_id, token_hash, language, issued_by) VALUES (%s, %s, %s, %s)",
                 (p["pilgrim_id"], hash_key(token), language, who.display_name))
    return {"token": token, "language": language, "pilgrim_id": p["pilgrim_id"], "full_name": p["full_name"],
            "full_name_ar": p["full_name_ar"], "group_code": p["group_code"], "group_name": p["group_name"]}


class CardIn(BaseModel):
    language: Literal[LANGUAGES] | None = None  # type: ignore[valid-type]


class GroupCardsIn(BaseModel):
    # also replace the cards already handed out (they stop working)
    replace: bool = False


@router.get("/v1/pilgrims/{pilgrim_id}/rafeeq")
def card_of(pilgrim_id: str, who: Identity = Depends(require("pilgrim:read"))):
    """Whether this pilgrim has a card in use. Never the card itself: only its hash is kept."""
    with tenant_session(who.tenant_id) as conn:
        _holder(conn, pilgrim_id)
        return {"card": _card(conn, pilgrim_id)}


@router.post("/v1/pilgrims/{pilgrim_id}/rafeeq", status_code=201)
def issue_card(pilgrim_id: str, body: CardIn, who: Identity = Depends(require("rafeeq:issue"))):
    """A new card. The link comes back this once, to print or send now."""
    with tenant_session(who.tenant_id) as conn:
        p = _holder(conn, pilgrim_id)
        if p["status"] == "departed":
            raise HTTPException(409, "this pilgrim has left the Kingdom; a card would not help them")
        return _issue(conn, p, body.language, who)


@router.delete("/v1/pilgrims/{pilgrim_id}/rafeeq", status_code=204)
def stop_card(pilgrim_id: str, who: Identity = Depends(require("rafeeq:issue"))):
    with tenant_session(who.tenant_id) as conn:
        _holder(conn, pilgrim_id)
        conn.execute("UPDATE rafeeq_card SET revoked_at = now() WHERE pilgrim_id = %s AND revoked_at IS NULL",
                     (pilgrim_id,))
    return Response(status_code=204)


@router.post("/v1/groups/{group_id}/rafeeq")
def issue_group_cards(group_id: str, body: GroupCardsIn, who: Identity = Depends(require("rafeeq:issue"))):
    """Cards for everyone in the group who is still in the journey, to print as one sheet.
    Those who already have a card keep it unless `replace` is set."""
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("SELECT 1 FROM pilgrim_group WHERE id = %s", (group_id,)).fetchone():
            raise HTTPException(404, "no such group")
        rows = conn.execute(
            """SELECT p.id::text AS pilgrim_id, p.full_name, p.full_name_ar, p.language, p.status,
                      g.code AS group_code, g.name AS group_name,
                      EXISTS (SELECT 1 FROM rafeeq_card c WHERE c.pilgrim_id = p.id AND c.revoked_at IS NULL) AS has
                 FROM pilgrim p JOIN pilgrim_group g ON g.id = p.group_id
                WHERE p.group_id = %s AND p.status <> 'departed'
                ORDER BY p.full_name, p.id""", (group_id,)).fetchall()
        cards = [_issue(conn, r, None, who) for r in rows if body.replace or not r["has"]]
        return {"cards": cards, "kept": sum(1 for r in rows if r["has"]) if not body.replace else 0}


# ---- the pilgrim's own page ----

_CALL_COLS = "id::text, ref, kind, status, opened_at, assigned_at, resolved_at, pilgrim_ok_at"


def _page(conn, card: CardHolder) -> dict:
    """What the page shows: who they are, who to call, and their calls for help still going
    (and those closed in the last 12 hours, so they see the answer)."""
    row = conn.execute(
        """SELECT p.full_name, p.full_name_ar, g.code AS group_code, g.name AS group_name,
                  g.leader_name, g.leader_phone, t.name AS operator, t.name_ar AS operator_ar
             FROM pilgrim p JOIN pilgrim_group g ON g.id = p.group_id JOIN tenant t ON t.id = p.tenant_id
            WHERE p.id = %s""", (card.pilgrim_id,)).fetchone()
    calls = conn.execute(
        f"""SELECT {_CALL_COLS} FROM incident
             WHERE pilgrim_id = %s AND rafeeq_card_id IS NOT NULL
               AND (status <> 'resolved' OR resolved_at > now() - interval '12 hours')
             ORDER BY (status = 'resolved'), opened_at DESC LIMIT 5""", (card.pilgrim_id,)).fetchall()
    return {**row, "language": card.language, "is_demo": card.is_demo, "calls": calls}


class HelpIn(BaseModel):
    kind: Literal[tuple(HELP)]  # type: ignore[valid-type]
    # where the phone was, when the pilgrim allowed it: "21.42250, 39.82620 (±30 m)"
    location: str | None = Field(default=None, max_length=200)
    # the language the page was in when they pressed
    language: Literal[LANGUAGES] | None = None  # type: ignore[valid-type]


@router.get("/v1/rafeeq/me")
def my_page(card: CardHolder = Depends(card_holder)):
    with tenant_session(card.tenant_id) as conn:
        return _page(conn, card)


@router.post("/v1/rafeeq/help")
def call_for_help(body: HelpIn, card: CardHolder = Depends(card_holder)):
    """A call for help: an urgent incident in the feed. Pressing the same call again while it is
    open adds to it rather than opening another. `call` is the one this press went to."""
    location = (body.location or "").strip() or None
    with tenant_session(card.tenant_id) as conn:
        # one press at a time per card, so two quick presses cannot open two incidents
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (card.card_id,))
        same = conn.execute(
            """SELECT id::text, (SELECT max(at) FROM incident_event e WHERE e.incident_id = i.id) > now() - interval '1 minute' AS just
                 FROM incident i WHERE pilgrim_id = %s AND kind = %s AND rafeeq_card_id IS NOT NULL
                  AND status <> 'resolved' ORDER BY opened_at DESC LIMIT 1""",
            (card.pilgrim_id, body.kind)).fetchone()
        if same:
            if location:
                conn.execute("UPDATE incident SET location = %s, updated_at = now() WHERE id = %s", (location, same["id"]))
            if location or not same["just"]:
                note = PRESSED_AGAIN + (f" Now at {location}." if location else "")
                conn.execute("INSERT INTO incident_event (incident_id, kind, note, actor) VALUES (%s, 'note', %s, %s)",
                             (same["id"], note, ACTOR))
                conn.execute("UPDATE incident SET updated_at = now() WHERE id = %s", (same["id"],))
            return {**_page(conn, card), "call": same["id"], "repeated": True}

        recent = conn.execute(
            "SELECT count(*)::int AS n FROM incident WHERE rafeeq_card_id = %s AND opened_at > now() - interval '1 hour'",
            (card.card_id,)).fetchone()["n"]
        if recent >= CALLS_PER_HOUR:
            raise HTTPException(429, "too many calls for help from this card; call your group leader or 911")
        priority, _ = HELP[body.kind]
        iid = conn.execute(
            """INSERT INTO incident (kind, priority, pilgrim_id, group_id, location, description, reported_by,
                                     rafeeq_card_id)
               SELECT %s, %s, p.id, p.group_id, %s, %s, %s, %s FROM pilgrim p WHERE p.id = %s
               RETURNING id::text""",
            (body.kind, priority, location, description(body.kind, body.language or card.language), ACTOR,
             card.card_id, card.pilgrim_id)).fetchone()["id"]
        conn.execute("INSERT INTO incident_event (incident_id, kind, actor) VALUES (%s, 'opened', %s)", (iid, ACTOR))
        return {**_page(conn, card), "call": iid, "repeated": False}


@router.post("/v1/rafeeq/help/{incident_id}/fine")
def say_fine(incident_id: str, card: CardHolder = Depends(card_holder)):
    """The pilgrim says they are fine. Staff are told; they still close it themselves."""
    with tenant_session(card.tenant_id) as conn:
        row = conn.execute(
            """UPDATE incident SET pilgrim_ok_at = coalesce(pilgrim_ok_at, now()), updated_at = now()
                WHERE id = %s AND pilgrim_id = %s AND rafeeq_card_id IS NOT NULL AND status <> 'resolved'
                RETURNING (pilgrim_ok_at = now()) AS first""",
            (incident_id, card.pilgrim_id)).fetchone()
        if not row:
            raise HTTPException(404, "no such call for help, or it is already closed")
        if row["first"]:
            conn.execute("INSERT INTO incident_event (incident_id, kind, note, actor) VALUES (%s, 'note', %s, %s)",
                         (incident_id, FINE_NOTE, ACTOR))
        return _page(conn, card)
