"""Bring a group's pilgrims in from a spreadsheet.

The web app reads the CSV and sends its rows as they are; the checking happens
here, so the platform is the only judge of what is valid. All or nothing: one
bad row and nothing is saved, and the answer lists every problem by row, so a
fixed file can simply be sent again. `dry_run` checks without saving: the
preview screen uses it.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator

from ..core.auth import Identity, require
from ..core.db import tenant_session
from .pilgrims import NEEDS

router = APIRouter(prefix="/v1/groups", tags=["groups"])

MAX_ROWS = 2000
COLUMNS = ("full_name", "full_name_ar", "gender", "date_of_birth", "nationality",
           "passport_no", "phone", "language", "needs")

_GENDER = {"male": "male", "m": "male", "ذكر": "male", "female": "female", "f": "female", "أنثى": "female"}


def _blank(v):
    return None if isinstance(v, str) and not v.strip() else v


class Row(BaseModel):
    """One spreadsheet row, read generously: 'M', '02/03/1960', 'wheelchair; medical'."""
    full_name: str = Field(min_length=1)
    full_name_ar: str | None = None
    gender: str
    date_of_birth: date | None = None
    nationality: str = Field(pattern=r"^[A-Z]{2}$")
    passport_no: str = Field(min_length=5, max_length=20)
    phone: str | None = None
    language: str | None = Field(default=None, pattern=r"^[a-z]{2}$")
    needs: list[str] = []

    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, v):
        v = _blank(v)
        return v.strip() if isinstance(v, str) else v

    @field_validator("gender", mode="before")
    @classmethod
    def _gender(cls, v):
        g = _GENDER.get(str(v or "").strip().lower())
        if not g:
            raise ValueError("male or female (M or F)")
        return g

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def _born(cls, v):
        if v is None or isinstance(v, date):
            return v
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                born = datetime.strptime(str(v).strip(), fmt).date()
            except ValueError:
                continue
            if born > date.today() or born.year < 1900:
                raise ValueError("not a likely birth date")
            return born
        raise ValueError("a date like 1960-03-02 or 02/03/1960")

    @field_validator("nationality", mode="before")
    @classmethod
    def _country(cls, v):
        return str(v or "").strip().upper()

    @field_validator("passport_no", mode="before")
    @classmethod
    def _passport(cls, v):
        return re.sub(r"\s+", "", str(v or "")).upper()

    @field_validator("language", mode="before")
    @classmethod
    def _language(cls, v):
        return str(v).strip().lower() if v else None

    @field_validator("needs", mode="before")
    @classmethod
    def _needs(cls, v):
        if not v:
            return []
        items = [n.strip().lower().replace(" ", "_") for n in re.split(r"[;,|]", str(v)) if n.strip()]
        unknown = [n for n in items if n not in NEEDS]
        if unknown:
            raise ValueError(f"unknown need {', '.join(unknown)}; use {', '.join(NEEDS)}")
        return sorted(set(items), key=NEEDS.index)


class ImportBody(BaseModel):
    rows: list[dict[str, str | None]] = Field(max_length=MAX_ROWS)
    dry_run: bool = False


def _problems(exc: ValidationError) -> list[tuple[str, str]]:
    out = []
    for e in exc.errors():
        field = str(e["loc"][0]) if e["loc"] else "row"
        msg = e["msg"].removeprefix("Value error, ")
        if e["type"] == "missing" or (e["type"] == "string_type" and e.get("input") is None):
            msg = "required"
        elif e["type"] == "string_pattern_mismatch":
            msg = {"nationality": "two letters, like PK", "language": "two letters, like ur"}.get(field, msg)
        elif e["type"] in ("string_too_short", "string_too_long") and field == "passport_no":
            msg = "5 to 20 letters and digits"
        out.append((field, msg))
    return out


@router.post("/{group_id}/pilgrims/import")
def import_pilgrims(group_id: str, body: ImportBody, who: Identity = Depends(require("pilgrim:write"))):
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("SELECT 1 FROM pilgrim_group WHERE id = %s", (group_id,)).fetchone():
            raise HTTPException(404, "no such group")
        errors: list[dict] = []
        good: list[tuple[int, Row]] = []
        seen: dict[tuple[str, str], int] = {}
        for i, raw in enumerate(body.rows, start=1):
            row = {k.strip().lower(): v for k, v in raw.items() if k and k.strip().lower() in COLUMNS}
            try:
                r = Row(**row)
            except ValidationError as exc:
                errors += [{"row": i, "field": f, "message": m} for f, m in _problems(exc)]
                continue
            key = (r.nationality, r.passport_no)
            if key in seen:
                errors.append({"row": i, "field": "passport_no",
                               "message": f"same passport as row {seen[key]}"})
                continue
            seen[key] = i
            good.append((i, r))
        if good:
            taken = {(x["nationality"], x["passport_no"]) for x in conn.execute(
                """SELECT nationality, passport_no FROM pilgrim
                    WHERE (nationality, passport_no) IN (SELECT * FROM unnest(%s::text[], %s::text[]))""",
                ([r.nationality for _, r in good], [r.passport_no for _, r in good])).fetchall()}
            for i, r in good:
                if (r.nationality, r.passport_no) in taken:
                    errors.append({"row": i, "field": "passport_no", "message": "already registered with this operator"})
        errors.sort(key=lambda e: (e["row"], COLUMNS.index(e["field"]) if e["field"] in COLUMNS else 99))
        bad_rows = {e["row"] for e in errors}
        valid = sum(1 for i in range(1, len(body.rows) + 1) if i not in bad_rows)
        save = not body.dry_run and not errors and len(body.rows) > 0
        if save:
            for _, r in good:
                pid = conn.execute(
                    """INSERT INTO pilgrim (group_id, full_name, full_name_ar, gender, date_of_birth, nationality,
                           passport_no, phone, language, needs)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (group_id, r.full_name, r.full_name_ar, r.gender, r.date_of_birth, r.nationality,
                     r.passport_no, r.phone, r.language, r.needs)).fetchone()["id"]
                conn.execute("INSERT INTO pilgrim_event (pilgrim_id, to_status, note, actor) "
                             "VALUES (%s, 'registered', 'Imported from a spreadsheet', %s)", (pid, who.display_name))
    return {"rows": len(body.rows), "valid": valid, "errors": errors, "saved": save}
