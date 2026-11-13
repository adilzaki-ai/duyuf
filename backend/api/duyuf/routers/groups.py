"""Pilgrim groups: the unit a service company plans transport and housing for."""
from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.auth import Identity, require
from ..core.db import tenant_session

router = APIRouter(prefix="/v1/groups", tags=["groups"])

def _rows(conn, where: str = "", params: tuple = ()) -> list[dict]:
    """Groups with their head count and how many are at each stage."""
    return conn.execute(f"""
        SELECT g.id::text, g.code, g.name, g.kind, g.season, g.origin_country,
               g.arrival_date, g.departure_date, g.leader_name, g.leader_phone,
               g.meeting_name, g.meeting_lat, g.meeting_lon,
               coalesce(c.total, 0) AS pilgrims, coalesce(c.by_status, '{{}}') AS by_status
          FROM pilgrim_group g
          LEFT JOIN LATERAL (
                SELECT sum(n)::int AS total, jsonb_object_agg(status, n) AS by_status
                  FROM (SELECT status, count(*)::int AS n FROM pilgrim
                         WHERE group_id = g.id GROUP BY status) s
          ) c ON true
         {where}
         ORDER BY g.arrival_date NULLS LAST, g.code""", params).fetchall()


class GroupIn(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1)
    kind: Literal["hajj", "umrah"]
    season: str = Field(min_length=4, max_length=8)
    origin_country: str = Field(pattern=r"^[A-Z]{2}$")
    arrival_date: date | None = None
    departure_date: date | None = None
    leader_name: str | None = None
    leader_phone: str | None = None


class GroupPatch(BaseModel):
    # where the group gathers: a name, and its place (both, or neither)
    meeting_name: str | None = Field(default=None, max_length=80)
    meeting_lat: float | None = Field(default=None, ge=-90, le=90)
    meeting_lon: float | None = Field(default=None, ge=-180, le=180)
    name: str | None = Field(default=None, min_length=1)
    arrival_date: date | None = None
    departure_date: date | None = None
    leader_name: str | None = None
    leader_phone: str | None = None


@router.get("")
def list_groups(who: Identity = Depends(require("group:read"))):
    with tenant_session(who.tenant_id) as conn:
        return {"items": _rows(conn)}


@router.get("/{group_id}")
def get_group(group_id: str, who: Identity = Depends(require("group:read"))):
    with tenant_session(who.tenant_id) as conn:
        rows = _rows(conn, "WHERE g.id = %s", (group_id,))
    if not rows:
        raise HTTPException(404, "no such group")
    return rows[0]


@router.post("", status_code=201)
def create_group(body: GroupIn, who: Identity = Depends(require("group:write"))):
    with tenant_session(who.tenant_id) as conn:
        gid = conn.execute(
            """INSERT INTO pilgrim_group (code, name, kind, season, origin_country,
                   arrival_date, departure_date, leader_name, leader_phone)
               VALUES (%(code)s, %(name)s, %(kind)s, %(season)s, %(origin_country)s,
                   %(arrival_date)s, %(departure_date)s, %(leader_name)s, %(leader_phone)s)
               RETURNING id::text""", body.model_dump()).fetchone()["id"]
        return _rows(conn, "WHERE g.id = %s", (gid,))[0]


@router.patch("/{group_id}")
def update_group(group_id: str, body: GroupPatch, who: Identity = Depends(require("group:write"))):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "nothing to change")
    sets = ", ".join(f"{k} = %({k})s" for k in changes)
    with tenant_session(who.tenant_id) as conn:
        hit = conn.execute(f"UPDATE pilgrim_group SET {sets}, updated_at = now() "
                           "WHERE id = %(id)s RETURNING id", {**changes, "id": group_id}).fetchone()
        if not hit:
            raise HTTPException(404, "no such group")
        return _rows(conn, "WHERE g.id = %s", (group_id,))[0]
