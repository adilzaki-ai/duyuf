"""Resources on shift: what the operator has at each airport, and when.

The arrivals board sets these against what landing flights need (see
arrivals/plan.py). A shift is planned, not edited: a wrong one is removed and
added again, so what the board was reading is never quietly rewritten.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator

from ..arrivals.brief import KSA
from ..core.auth import Identity, require
from ..core.db import tenant_session

router = APIRouter(prefix="/v1/resources", tags=["resources"])

_COLS = "id::text, airport, kind, language, quantity, starts_at, ends_at, note, created_by, created_at"


class ShiftIn(BaseModel):
    airport: str = Field(pattern=r"^[A-Za-z]{3}$")
    kind: Literal["wheelchair", "bus", "interpreter"]
    language: str | None = Field(default=None, pattern=r"^[a-z]{2}$")
    quantity: int = Field(ge=1, le=1000)
    starts_at: datetime
    ends_at: datetime
    note: str | None = None

    @field_validator("airport")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _zone(cls, v: datetime) -> datetime:
        """A time with no zone is a Saudi time."""
        return v.replace(tzinfo=KSA) if v.tzinfo is None else v

    @model_validator(mode="after")
    def _check(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("a shift ends after it starts")
        if (self.kind == "interpreter") != (self.language is not None):
            raise ValueError("an interpreter needs a language; nothing else has one")
        return self


@router.get("")
def list_shifts(include_past: bool = Query(default=False), who: Identity = Depends(require("flight:read"))):
    """Shifts not yet over (or all of them), by airport and start."""
    with tenant_session(who.tenant_id) as conn:
        where = "" if include_past else "WHERE ends_at > now()"
        return {"items": conn.execute(
            f"SELECT {_COLS} FROM resource_shift {where} ORDER BY airport, starts_at, kind, language").fetchall()}


@router.post("", status_code=201)
def add_shift(body: ShiftIn, who: Identity = Depends(require("flight:write"))):
    with tenant_session(who.tenant_id) as conn:
        return conn.execute(
            f"""INSERT INTO resource_shift (airport, kind, language, quantity, starts_at, ends_at, note, created_by)
                VALUES (%(airport)s, %(kind)s, %(language)s, %(quantity)s, %(starts_at)s, %(ends_at)s,
                        %(note)s, %(by)s)
                RETURNING {_COLS}""", {**body.model_dump(), "by": who.display_name}).fetchone()


@router.delete("/{shift_id}", status_code=204)
def remove_shift(shift_id: str, who: Identity = Depends(require("flight:write"))):
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("DELETE FROM resource_shift WHERE id = %s RETURNING id", (shift_id,)).fetchone():
            raise HTTPException(404, "no such shift")
