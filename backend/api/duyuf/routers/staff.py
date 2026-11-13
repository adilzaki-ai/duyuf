"""The operator's staff: who may sign in, with which role. Administrators only.

A new person, and a password reset, get a password the administrator hands
over; it must be changed at the next sign in. Switching someone off, or
resetting their password, signs them out everywhere at once.

Two guards: an administrator cannot switch off or demote themselves, and an
operator always keeps at least one administrator who can sign in.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..core.auth import ROLE_SCOPES, Identity, hash_password, password_problem, require
from ..core.db import tenant_session

router = APIRouter(prefix="/v1/staff", tags=["staff"])

Role = Literal[tuple(ROLE_SCOPES)]  # type: ignore[valid-type]
_COLS = """id::text, display_name, email, role, (disabled_at IS NOT NULL) AS disabled, must_change_password,
           last_signed_in_at, created_at"""


class _Email(BaseModel):
    @field_validator("email", check_fields=False)
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1] or " " in v:
            raise ValueError("an email address like name@company.sa")
        return v


class StaffIn(_Email):
    display_name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=254)
    role: Role  # type: ignore[valid-type]
    password: str = Field(max_length=200)


class StaffPatch(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None  # type: ignore[valid-type]
    disabled: bool | None = None
    # a new password to hand over; it must be changed at the next sign in
    password: str | None = Field(default=None, max_length=200)


def _one(conn, staff_id: str) -> dict:
    row = conn.execute(f"SELECT {_COLS} FROM principal WHERE id = %s", (staff_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such person")
    return row


@router.get("")
def list_staff(who: Identity = Depends(require("staff:manage"))):
    with tenant_session(who.tenant_id) as conn:
        # Everyone: people who sign in, and the people keys were issued to (no email: they cannot sign in).
        return {"items": conn.execute(
            f"SELECT {_COLS} FROM principal ORDER BY (disabled_at IS NOT NULL), role, display_name").fetchall()}


@router.post("", status_code=201)
def add_staff(body: StaffIn, who: Identity = Depends(require("staff:manage"))):
    why = password_problem(body.password)
    if why:
        raise HTTPException(422, why)
    with tenant_session(who.tenant_id) as conn:
        sid = conn.execute(
            """INSERT INTO principal (tenant_id, external_id, display_name, role, email, password_hash,
                                      must_change_password)
               VALUES (current_tenant(), %s, %s, %s, %s, %s, true) RETURNING id::text""",
            (body.email, body.display_name.strip(), body.role, body.email, hash_password(body.password))).fetchone()["id"]
        return _one(conn, sid)


@router.patch("/{staff_id}")
def update_staff(staff_id: str, body: StaffPatch, who: Identity = Depends(require("staff:manage"))):
    change = body.model_dump(exclude_unset=True)
    if not change:
        raise HTTPException(422, "nothing to change")
    with tenant_session(who.tenant_id) as conn:
        person = conn.execute("SELECT id::text, role, (disabled_at IS NOT NULL) AS disabled FROM principal "
                              "WHERE id = %s FOR UPDATE", (staff_id,)).fetchone()
        if not person:
            raise HTTPException(404, "no such person")
        demoting = "role" in change and change["role"] != "administrator"
        disabling = change.get("disabled") is True
        if staff_id == who.principal_id and (demoting or disabling):
            raise HTTPException(409, "you cannot switch off or change the role of your own account")
        if person["role"] == "administrator" and not person["disabled"] and (demoting or disabling):
            others = conn.execute("""SELECT count(*)::int AS n FROM principal
                                      WHERE role = 'administrator' AND disabled_at IS NULL AND id <> %s
                                        AND email IS NOT NULL""", (staff_id,)).fetchone()["n"]
            if others == 0:
                raise HTTPException(409, "the operator needs at least one administrator who can sign in")
        sets, params = [], []
        if "display_name" in change:
            sets.append("display_name = %s")
            params.append(change["display_name"].strip())
        if "role" in change:
            sets.append("role = %s")
            params.append(change["role"])
        if "disabled" in change:
            if change["disabled"]:
                sets += ["disabled_at = now()", "sessions_valid_from = now()"]
            else:
                sets.append("disabled_at = NULL")
        if change.get("password") is not None:
            why = password_problem(change["password"])
            if why:
                raise HTTPException(422, why)
            sets += ["password_hash = %s", "must_change_password = true", "sessions_valid_from = now()"]
            params.append(hash_password(change["password"]))
        conn.execute(f"UPDATE principal SET {', '.join(sets)} WHERE id = %s", [*params, staff_id])
        return _one(conn, staff_id)
