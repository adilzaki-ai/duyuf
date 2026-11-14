"""Incidents: something has happened to a pilgrim or a group, and someone is on it.

Raised by anyone on the operator's staff, or by a pilgrim on Rafeeq
(routers/rafeeq.py), given to a team, resolved. Every step lands in the
incident's history with who took it and when, which is also how "time to help"
is measured. Nothing is deleted: a false alarm is resolved
with that said.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from ..core.auth import Identity, require
from ..core.db import tenant_session
from ..health import record
from ..incidents.flow import KINDS, MOVES, PRIORITIES, refusal

router = APIRouter(prefix="/v1/incidents", tags=["incidents"])

_COLS = """i.id::text, i.ref, i.kind, i.priority, i.status, i.pilgrim_id::text, p.full_name AS pilgrim_name,
           p.full_name_ar AS pilgrim_name_ar, i.group_id::text, g.code AS group_code, g.name AS group_name,
           g.leader_phone, i.location, i.description, i.team, i.resolution, i.reported_by,
           i.opened_at, i.assigned_at, i.resolved_at, i.updated_at,
           (i.rafeeq_card_id IS NOT NULL) AS from_rafeeq, i.pilgrim_ok_at"""
_FROM = """incident i LEFT JOIN pilgrim p ON p.id = i.pilgrim_id
           LEFT JOIN pilgrim_group g ON g.id = i.group_id"""
# Still to deal with first, the most pressing first, the longest waiting first.
_ORDER = """ORDER BY (i.status = 'resolved'),
                    CASE i.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                    CASE WHEN i.status = 'resolved' THEN -extract(epoch FROM i.resolved_at)
                         ELSE extract(epoch FROM i.opened_at) END, i.ref"""


def _shown(row: dict) -> dict:
    row = dict(row)
    row["allowed"] = [a for a, (froms, _) in MOVES.items() if row["status"] in froms]
    return row


def _one(conn, incident_id: str, who: Identity) -> dict:
    row = conn.execute(f"SELECT {_COLS} FROM {_FROM} WHERE i.id = %s", (incident_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such incident")
    out = _shown(row)
    out["history"] = conn.execute(
        "SELECT kind, note, team, actor, at FROM incident_event WHERE incident_id = %s ORDER BY at, id",
        (incident_id,)).fetchall()
    # Where to go: the pilgrim's latest place while the incident is open, if they share it.
    out["live_location"] = None
    if row["pilgrim_id"] and row["status"] != "resolved" and record.consent(conn, row["pilgrim_id"])["location"]:
        out["live_location"] = record.last_place(conn, row["pilgrim_id"], fresh_only=True)
    # The readings behind it, for medics and administrators only.
    out["health"] = None
    if row["pilgrim_id"] and who.can("health:read"):
        alert = conn.execute(
            """SELECT reasons, heart_rate, temperature::float AS temperature, started_at FROM health_alert
                WHERE incident_id = %s""", (incident_id,)).fetchone()
        agreed = record.consent(conn, row["pilgrim_id"])["health"]
        if alert or agreed:
            out["health"] = {"alert": alert, "now": record.state(conn, row["pilgrim_id"]) if agreed else None}
    return out


def _stats(conn) -> dict:
    return conn.execute("""
        SELECT count(*) FILTER (WHERE status = 'open')::int AS open,
               count(*) FILTER (WHERE status = 'assigned')::int AS assigned,
               count(*) FILTER (WHERE status <> 'resolved' AND priority = 'urgent')::int AS urgent,
               count(*) FILTER (WHERE status = 'resolved' AND resolved_at >= date_trunc('day', now()))::int
                   AS resolved_today,
               round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM assigned_at - opened_at) / 60)
                     FILTER (WHERE assigned_at IS NOT NULL AND opened_at > now() - interval '7 days'))::int
                   AS minutes_to_assign,
               round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM resolved_at - opened_at) / 60)
                     FILTER (WHERE status = 'resolved' AND opened_at > now() - interval '7 days'))::int
                   AS minutes_to_resolve
          FROM incident""").fetchone()


@router.get("")
def list_incidents(
    status: Literal["active", "resolved", "all"] = "active",
    kind: str | None = None,
    pilgrim_id: str | None = None,
    group_id: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    who: Identity = Depends(require("incident:read")),
):
    """`active` is open and assigned. The stats cover every incident, whatever the filter."""
    where, params = [], []
    if status == "active":
        where.append("i.status <> 'resolved'")
    elif status == "resolved":
        where.append("i.status = 'resolved'")
    for col, v in (("i.kind", kind), ("i.pilgrim_id", pilgrim_id), ("i.group_id", group_id)):
        if v:
            where.append(f"{col} = %s")
            params.append(v)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    with tenant_session(who.tenant_id) as conn:
        rows = conn.execute(f"SELECT {_COLS} FROM {_FROM} {clause} {_ORDER} LIMIT %s", [*params, limit]).fetchall()
        return {"items": [_shown(r) for r in rows], "stats": _stats(conn),
                "teams": [r["team"] for r in conn.execute(
                    "SELECT team FROM incident WHERE team IS NOT NULL GROUP BY team ORDER BY max(updated_at) DESC "
                    "LIMIT 20")]}


@router.get("/{incident_id}")
def get_incident(incident_id: str, who: Identity = Depends(require("incident:read"))):
    with tenant_session(who.tenant_id) as conn:
        return _one(conn, incident_id, who)


class IncidentIn(BaseModel):
    kind: Literal[KINDS]  # type: ignore[valid-type]
    priority: Literal[PRIORITIES]  # type: ignore[valid-type]
    pilgrim_id: str | None = None
    group_id: str | None = None
    location: str | None = Field(default=None, max_length=200)
    description: str = Field(min_length=1, max_length=2000)


class Assign(BaseModel):
    team: str = Field(min_length=1, max_length=80)
    note: str | None = Field(default=None, max_length=2000)


class Resolve(BaseModel):
    resolution: str = Field(min_length=1, max_length=2000)


class Note(BaseModel):
    note: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def _strip(self):
        self.note = self.note.strip()
        if not self.note:
            raise ValueError("a note needs words")
        return self


@router.post("", status_code=201)
def raise_incident(body: IncidentIn, who: Identity = Depends(require("incident:write"))):
    with tenant_session(who.tenant_id) as conn:
        group_id = body.group_id
        if body.pilgrim_id:
            # A pilgrim's incident belongs to their group, whatever was sent.
            p = conn.execute("SELECT group_id::text FROM pilgrim WHERE id = %s", (body.pilgrim_id,)).fetchone()
            if not p:
                raise HTTPException(422, "refers to something that does not exist: no such pilgrim")
            group_id = p["group_id"]
        iid = conn.execute(
            """INSERT INTO incident (kind, priority, pilgrim_id, group_id, location, description, reported_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id::text""",
            (body.kind, body.priority, body.pilgrim_id, group_id, body.location, body.description.strip(),
             who.display_name)).fetchone()["id"]
        conn.execute("INSERT INTO incident_event (incident_id, kind, actor) VALUES (%s, 'opened', %s)",
                     (iid, who.display_name))
        return _one(conn, iid, who)


def _locked(conn, incident_id: str, action: str) -> dict:
    row = conn.execute("SELECT status FROM incident WHERE id = %s FOR UPDATE", (incident_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such incident")
    why = refusal(row["status"], action)
    if why:
        raise HTTPException(409, why)
    return row


@router.post("/{incident_id}/assign")
def assign(incident_id: str, body: Assign, who: Identity = Depends(require("incident:write"))):
    with tenant_session(who.tenant_id) as conn:
        _locked(conn, incident_id, "assign")
        team = body.team.strip()
        conn.execute("""UPDATE incident SET status = 'assigned', team = %s,
                               assigned_at = coalesce(assigned_at, now()), updated_at = now() WHERE id = %s""",
                     (team, incident_id))
        conn.execute("INSERT INTO incident_event (incident_id, kind, team, note, actor) VALUES (%s, 'assigned', %s, %s, %s)",
                     (incident_id, team, body.note, who.display_name))
        return _one(conn, incident_id, who)


@router.post("/{incident_id}/resolve")
def resolve(incident_id: str, body: Resolve, who: Identity = Depends(require("incident:write"))):
    with tenant_session(who.tenant_id) as conn:
        _locked(conn, incident_id, "resolve")
        conn.execute("""UPDATE incident SET status = 'resolved', resolution = %s, resolved_at = now(),
                               updated_at = now() WHERE id = %s""", (body.resolution.strip(), incident_id))
        conn.execute("INSERT INTO incident_event (incident_id, kind, note, actor) VALUES (%s, 'resolved', %s, %s)",
                     (incident_id, body.resolution.strip(), who.display_name))
        return _one(conn, incident_id, who)


@router.post("/{incident_id}/reopen")
def reopen(incident_id: str, body: Note, who: Identity = Depends(require("incident:write"))):
    with tenant_session(who.tenant_id) as conn:
        _locked(conn, incident_id, "reopen")
        conn.execute("""UPDATE incident SET status = 'open', resolution = NULL, resolved_at = NULL,
                               updated_at = now() WHERE id = %s""", (incident_id,))
        conn.execute("INSERT INTO incident_event (incident_id, kind, note, actor) VALUES (%s, 'reopened', %s, %s)",
                     (incident_id, body.note, who.display_name))
        return _one(conn, incident_id, who)


@router.post("/{incident_id}/notes")
def add_note(incident_id: str, body: Note, who: Identity = Depends(require("incident:write"))):
    with tenant_session(who.tenant_id) as conn:
        if not conn.execute("UPDATE incident SET updated_at = now() WHERE id = %s RETURNING id",
                            (incident_id,)).fetchone():
            raise HTTPException(404, "no such incident")
        conn.execute("INSERT INTO incident_event (incident_id, kind, note, actor) VALUES (%s, 'note', %s, %s)",
                     (incident_id, body.note, who.display_name))
        return _one(conn, incident_id, who)
