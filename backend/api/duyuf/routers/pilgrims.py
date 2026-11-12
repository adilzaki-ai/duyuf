"""Pilgrims: who they are, which group they travel with, where they are now.

Passport numbers and dates of birth are personal data (Saudi PDPL). Only a
role holding `pilgrim:identity` sees them whole; everyone else gets the last
four characters of the passport and no birth date.
"""
from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..core.auth import Identity, require
from ..core.db import tenant_session
from ..pilgrims.status import STATUSES, allowed, refusal

router = APIRouter(prefix="/v1/pilgrims", tags=["pilgrims"])

NEEDS = ("wheelchair", "medical", "elderly", "dietary", "unaccompanied_minor")

_COLS = """p.id::text, p.group_id::text, g.code AS group_code, g.name AS group_name,
           p.full_name, p.full_name_ar, p.gender, p.date_of_birth, p.nationality,
           p.passport_no, p.phone, p.status, p.needs, p.updated_at"""


def _shown(row: dict, who: Identity) -> dict:
    row = dict(row)
    row["allowed"] = list(allowed(row["status"]))
    if not who.can("pilgrim:identity"):
        tail = row["passport_no"][-4:]
        row["passport_no"] = "•••• " + tail
        row["date_of_birth"] = None
    return row


class PilgrimIn(BaseModel):
    group_id: str
    full_name: str = Field(min_length=1)
    full_name_ar: str | None = None
    gender: Literal["male", "female"]
    date_of_birth: date | None = None
    nationality: str = Field(pattern=r"^[A-Z]{2}$")
    passport_no: str = Field(min_length=5, max_length=20)
    phone: str | None = None
    needs: list[Literal[NEEDS]] = []  # type: ignore[valid-type]


class PilgrimPatch(BaseModel):
    group_id: str | None = None
    full_name: str | None = Field(default=None, min_length=1)
    full_name_ar: str | None = None
    phone: str | None = None
    needs: list[Literal[NEEDS]] | None = None  # type: ignore[valid-type]


class StatusMove(BaseModel):
    to: Literal[STATUSES]  # type: ignore[valid-type]
    note: str | None = None


@router.get("")
def list_pilgrims(
    group_id: str | None = None,
    status: str | None = None,
    q: str | None = Query(default=None, description="name or passport"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    who: Identity = Depends(require("pilgrim:read")),
):
    where, params = [], []
    if group_id:
        where.append("p.group_id = %s")
        params.append(group_id)
    if status:
        where.append("p.status = %s")
        params.append(status)
    if q:
        # Passport search only for those allowed to see passports: otherwise
        # it would confirm a number one character at a time.
        if who.can("pilgrim:identity"):
            where.append("(p.full_name ILIKE %s OR p.full_name_ar ILIKE %s OR p.passport_no ILIKE %s)")
            params += [f"%{q}%"] * 3
        else:
            where.append("(p.full_name ILIKE %s OR p.full_name_ar ILIKE %s)")
            params += [f"%{q}%"] * 2
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    with tenant_session(who.tenant_id) as conn:
        total = conn.execute(f"SELECT count(*)::int AS n FROM pilgrim p {clause}", params).fetchone()["n"]
        rows = conn.execute(
            f"""SELECT {_COLS} FROM pilgrim p JOIN pilgrim_group g ON g.id = p.group_id
                {clause} ORDER BY g.arrival_date NULLS LAST, g.code, p.full_name, p.id
                LIMIT %s OFFSET %s""",
            [*params, limit, offset]).fetchall()
    return {"items": [_shown(r, who) for r in rows], "total": total}


def _one(conn, pilgrim_id: str, who: Identity) -> dict:
    row = conn.execute(f"SELECT {_COLS} FROM pilgrim p JOIN pilgrim_group g ON g.id = p.group_id "
                       "WHERE p.id = %s", (pilgrim_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such pilgrim")
    out = _shown(row, who)
    out["history"] = conn.execute(
        "SELECT from_status, to_status, note, actor, at FROM pilgrim_event "
        "WHERE pilgrim_id = %s ORDER BY at, id", (pilgrim_id,)).fetchall()
    return out


@router.get("/{pilgrim_id}")
def get_pilgrim(pilgrim_id: str, who: Identity = Depends(require("pilgrim:read"))):
    with tenant_session(who.tenant_id) as conn:
        return _one(conn, pilgrim_id, who)


@router.post("", status_code=201)
def create_pilgrim(body: PilgrimIn, who: Identity = Depends(require("pilgrim:write"))):
    with tenant_session(who.tenant_id) as conn:
        pid = conn.execute(
            """INSERT INTO pilgrim (group_id, full_name, full_name_ar, gender, date_of_birth,
                   nationality, passport_no, phone, needs)
               VALUES (%(group_id)s, %(full_name)s, %(full_name_ar)s, %(gender)s, %(date_of_birth)s,
                   %(nationality)s, upper(%(passport_no)s), %(phone)s, %(needs)s)
               RETURNING id::text""", body.model_dump()).fetchone()["id"]
        conn.execute("INSERT INTO pilgrim_event (pilgrim_id, to_status, actor) VALUES (%s, 'registered', %s)",
                     (pid, who.display_name))
        return _one(conn, pid, who)


@router.patch("/{pilgrim_id}")
def update_pilgrim(pilgrim_id: str, body: PilgrimPatch, who: Identity = Depends(require("pilgrim:write"))):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "nothing to change")
    sets = ", ".join(f"{k} = %({k})s" for k in changes)
    with tenant_session(who.tenant_id) as conn:
        hit = conn.execute(f"UPDATE pilgrim SET {sets}, updated_at = now() WHERE id = %(id)s RETURNING id",
                           {**changes, "id": pilgrim_id}).fetchone()
        if not hit:
            raise HTTPException(404, "no such pilgrim")
        return _one(conn, pilgrim_id, who)


@router.post("/{pilgrim_id}/status")
def move_pilgrim(pilgrim_id: str, body: StatusMove, who: Identity = Depends(require("pilgrim:status"))):
    with tenant_session(who.tenant_id) as conn:
        row = conn.execute("SELECT status FROM pilgrim WHERE id = %s FOR UPDATE", (pilgrim_id,)).fetchone()
        if not row:
            raise HTTPException(404, "no such pilgrim")
        why = refusal(row["status"], body.to)
        if why:
            raise HTTPException(409, why)
        conn.execute("UPDATE pilgrim SET status = %s, updated_at = now() WHERE id = %s", (body.to, pilgrim_id))
        conn.execute("INSERT INTO pilgrim_event (pilgrim_id, from_status, to_status, note, actor) "
                     "VALUES (%s, %s, %s, %s, %s)",
                     (pilgrim_id, row["status"], body.to, body.note, who.display_name))
        return _one(conn, pilgrim_id, who)
