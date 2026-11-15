"""The roster, and covering the arrivals board's gaps with it.

Staff keep the roster (people who can cover shifts), choose how the
dispatcher works (Off / Approve / Automatic), approve its plans, and send
each request with one tap on WhatsApp until an SMS/WhatsApp provider is
signed. The person asked opens their personal link (/w#wk_…) to accept or
decline, and on the day says they are there; /v1/work/* takes that link,
like Rafeeq takes a card.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..core.auth import Identity, WorkerLink, require, worker_link
from ..core.db import tenant_session
from ..dispatch import planner, run

router = APIRouter(tags=["dispatch"])

# a person may say they are there from this long before the shift starts
ARRIVE_EARLY = timedelta(hours=2)


def link_base() -> str:
    """Where the personal links open: the web app's address, then /w. DUYUF_APP_URL on a real server."""
    return os.environ.get("DUYUF_APP_URL", "http://localhost:5180").rstrip("/") + "/w"


def operator_name(conn) -> str:
    return conn.execute("SELECT name FROM tenant WHERE id = current_tenant()").fetchone()["name"]


# ---- the roster ----

_WORKER_COLS = """id::text, name, name_ar, phone, roles, languages, airports, max_hours_week, active, note,
                  (SELECT count(*) FROM assignment a WHERE a.worker_id = w.id
                     AND a.status IN ('asked', 'accepted', 'arrived'))::int AS holding"""


class WorkerIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    name_ar: str | None = Field(default=None, max_length=120)
    phone: str = Field(pattern=r"^\+?[0-9 ]{8,20}$")
    roles: list[Literal[planner.ROLES]] = Field(min_length=1)  # type: ignore[valid-type]
    languages: list[str] = []
    airports: list[str] = Field(min_length=1)
    max_hours_week: int = Field(default=48, ge=1, le=84)
    active: bool = True
    note: str | None = Field(default=None, max_length=300)

    @field_validator("languages")
    @classmethod
    def _langs(cls, v):
        v = sorted({x.strip().lower() for x in v if x.strip()})
        if any(len(x) != 2 or not x.isalpha() for x in v):
            raise ValueError("two-letter language codes, like ur")
        return v

    @field_validator("airports")
    @classmethod
    def _airports(cls, v):
        v = sorted({x.strip().upper() for x in v if x.strip()})
        if not v or any(len(x) != 3 or not x.isalpha() for x in v):
            raise ValueError("three-letter airport codes, like JED")
        return v


class WorkerPatch(WorkerIn):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9 ]{8,20}$")
    roles: list[Literal[planner.ROLES]] | None = None  # type: ignore[valid-type]
    languages: list[str] | None = None
    airports: list[str] | None = None
    max_hours_week: int | None = Field(default=None, ge=1, le=84)
    active: bool | None = None


@router.get("/v1/workers")
def list_workers(who: Identity = Depends(require("roster:read"))):
    with tenant_session(who.tenant_id) as conn:
        return {"workers": conn.execute(f"SELECT {_WORKER_COLS} FROM worker w ORDER BY NOT active, name").fetchall()}


@router.post("/v1/workers", status_code=201)
def add_worker(body: WorkerIn, who: Identity = Depends(require("roster:write"))):
    with tenant_session(who.tenant_id) as conn:
        d = body.model_dump()
        wid = conn.execute(f"INSERT INTO worker ({', '.join(d)}) VALUES ({', '.join(f'%({k})s' for k in d)}) "
                           "RETURNING id::text", d).fetchone()["id"]
        return conn.execute(f"SELECT {_WORKER_COLS} FROM worker w WHERE id = %s", (wid,)).fetchone()


@router.patch("/v1/workers/{worker_id}")
def update_worker(worker_id: str, body: WorkerPatch, who: Identity = Depends(require("roster:write"))):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "nothing to change")
    sets = ", ".join(f"{k} = %({k})s" for k in changes)
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute(f"UPDATE worker SET {sets}, updated_at = now() WHERE id = %(id)s RETURNING id",
                            {**changes, "id": worker_id}).fetchone():
            raise HTTPException(404, "no such person")
        return conn.execute(f"SELECT {_WORKER_COLS} FROM worker w WHERE id = %s", (worker_id,)).fetchone()


# ---- the dispatcher ----

class SettingsIn(BaseModel):
    mode: Literal[planner.MODES]  # type: ignore[valid-type]
    horizon_hours: int = Field(default=24, ge=2, le=72)
    answer_minutes: int = Field(default=30, ge=5, le=240)


def _view(conn) -> dict:
    """Everything the Dispatch panel shows: the setting, the plan waiting for approval, and the requests."""
    plan = conn.execute("SELECT id::text, items, made_by, made_at FROM dispatch_plan WHERE status = 'proposed'").fetchone()
    requests = conn.execute(
        """SELECT a.id::text, a.status, a.token, a.message, a.asked_by, a.asked_at, a.answer_by, a.sent_at,
                  a.answered_at, a.arrived_at,
                  w.id::text AS worker_id, w.name, w.name_ar, w.phone,
                  s.id::text AS shift_id, s.airport, s.kind, s.language, s.starts_at, s.ends_at
             FROM assignment a JOIN worker w ON w.id = a.worker_id JOIN resource_shift s ON s.id = a.shift_id
            WHERE s.ends_at > now() - interval '12 hours'
            ORDER BY s.starts_at, s.airport, s.kind, a.asked_at""").fetchall()
    base = link_base()
    for r in requests:
        token = r.pop("token")
        r["link"] = f"{base}#{token}" if token else None
    return {"settings": run.settings(conn), "plan": plan, "requests": requests,
            # no SMS/WhatsApp provider is signed: staff send each request themselves
            "provider": None}


@router.get("/v1/dispatch")
def dispatch_view(who: Identity = Depends(require("roster:read"))):
    with tenant_session(who.tenant_id) as conn:
        return _view(conn)


@router.put("/v1/dispatch/settings")
def set_settings(body: SettingsIn, who: Identity = Depends(require("dispatch:approve"))):
    with tenant_session(who.tenant_id) as conn:
        conn.execute(
            """INSERT INTO dispatch_setting (mode, horizon_hours, answer_minutes, updated_by, updated_at)
               VALUES (%s, %s, %s, %s, now())
               ON CONFLICT (tenant_id) DO UPDATE SET mode = excluded.mode, horizon_hours = excluded.horizon_hours,
                   answer_minutes = excluded.answer_minutes, updated_by = excluded.updated_by, updated_at = now()""",
            (body.mode, body.horizon_hours, body.answer_minutes, who.display_name))
        if body.mode == "off":
            conn.execute("UPDATE dispatch_plan SET status = 'discarded', decided_by = %s, decided_at = now() "
                         "WHERE status = 'proposed'", (who.display_name,))
        return _view(conn)


@router.post("/v1/dispatch/run")
def run_now(who: Identity = Depends(require("dispatch:approve"))):
    """Look at the board now, rather than at the next round. Off still plans, for a supervisor to approve."""
    with tenant_session(who.tenant_id) as conn:
        out = run.tick(conn, operator_name(conn), link_base(), by=who.display_name, force=True)
        return {**_view(conn), "round": out}


def _plan(conn, plan_id: str) -> dict:
    p = conn.execute("SELECT id::text, items FROM dispatch_plan WHERE id = %s AND status = 'proposed' FOR UPDATE",
                     (plan_id,)).fetchone()
    if not p:
        raise HTTPException(409, "this plan is no longer waiting; look again")
    return p


@router.post("/v1/dispatch/plans/{plan_id}/approve")
def approve(plan_id: str, who: Identity = Depends(require("dispatch:approve"))):
    """Carry the plan out: the people in it are asked now."""
    with tenant_session(who.tenant_id) as conn:
        p = _plan(conn, plan_id)
        s = run.settings(conn)
        asked = run.carry_out(conn, p["items"], who.display_name, operator_name(conn), link_base(),
                              s["answer_minutes"], datetime.now(timezone.utc))
        conn.execute("UPDATE dispatch_plan SET status = 'approved', decided_by = %s, decided_at = now() WHERE id = %s",
                     (who.display_name, plan_id))
        return {**_view(conn), "asked": asked}


@router.post("/v1/dispatch/plans/{plan_id}/discard")
def discard(plan_id: str, who: Identity = Depends(require("dispatch:approve"))):
    with tenant_session(who.tenant_id) as conn:
        _plan(conn, plan_id)
        conn.execute("UPDATE dispatch_plan SET status = 'discarded', decided_by = %s, decided_at = now() WHERE id = %s",
                     (who.display_name, plan_id))
        return _view(conn)


@router.post("/v1/dispatch/requests/{assignment_id}/sent")
def mark_sent(assignment_id: str, who: Identity = Depends(require("roster:read"))):
    """Staff sent the request (WhatsApp, from their phone). Kept so nobody sends it twice."""
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("UPDATE assignment SET sent_at = coalesce(sent_at, now()) WHERE id = %s RETURNING id",
                            (assignment_id,)).fetchone():
            raise HTTPException(404, "no such request")
        return _view(conn)


@router.post("/v1/dispatch/requests/{assignment_id}/cancel")
def cancel_request(assignment_id: str, who: Identity = Depends(require("dispatch:approve"))):
    """Take the request back; the dispatcher asks someone else on its next round."""
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("""UPDATE assignment SET status = 'cancelled', answered_at = now()
                                WHERE id = %s AND status IN ('asked', 'accepted') RETURNING id""",
                            (assignment_id,)).fetchone():
            raise HTTPException(409, "this request is already answered or over")
        return _view(conn)


# ---- the person asked, on their link ----

def _mine(conn, link: WorkerLink) -> dict:
    row = conn.execute(
        """SELECT a.status, a.answer_by, a.answered_at, a.arrived_at, w.name, w.name_ar,
                  s.airport, s.kind, s.language, s.starts_at, s.ends_at, t.name AS operator, t.name_ar AS operator_ar
             FROM assignment a JOIN worker w ON w.id = a.worker_id JOIN resource_shift s ON s.id = a.shift_id
             JOIN tenant t ON t.id = a.tenant_id WHERE a.id = %s""", (link.assignment_id,)).fetchone()
    now = datetime.now(timezone.utc)
    first = row.pop("name").split()[0]
    first_ar = (row.pop("name_ar") or "").split(" ")[0] or None
    return {**row, "first_name": first, "first_name_ar": first_ar, "is_demo": link.is_demo,
            "can_answer": row["status"] == "asked" and row["answer_by"] > now and row["starts_at"] > now,
            "can_arrive": row["status"] == "accepted" and row["starts_at"] - ARRIVE_EARLY <= now < row["ends_at"]}


class AnswerIn(BaseModel):
    accept: bool


@router.get("/v1/work/me")
def my_request(link: WorkerLink = Depends(worker_link)):
    with tenant_session(link.tenant_id) as conn:
        return _mine(conn, link)


@router.post("/v1/work/answer")
def answer(body: AnswerIn, link: WorkerLink = Depends(worker_link)):
    with tenant_session(link.tenant_id) as conn:
        hit = conn.execute(
            """UPDATE assignment a SET status = %s, answered_at = now()
                 FROM resource_shift s
                WHERE a.id = %s AND s.id = a.shift_id AND a.status = 'asked' AND a.answer_by > now()
                  AND s.starts_at > now() RETURNING a.id""",
            ("accepted" if body.accept else "declined", link.assignment_id)).fetchone()
        if not hit:
            raise HTTPException(409, "this request can no longer be answered; call the office")
        return _mine(conn, link)


@router.post("/v1/work/arrived")
def arrived(link: WorkerLink = Depends(worker_link)):
    with tenant_session(link.tenant_id) as conn:
        hit = conn.execute(
            """UPDATE assignment a SET status = 'arrived', arrived_at = now()
                 FROM resource_shift s
                WHERE a.id = %s AND s.id = a.shift_id AND a.status = 'accepted'
                  AND s.starts_at - %s <= now() AND now() < s.ends_at RETURNING a.id""",
            (link.assignment_id, ARRIVE_EARLY)).fetchone()
        if not hit:
            raise HTTPException(409, "you can say you are there from two hours before your shift")
        return _mine(conn, link)

