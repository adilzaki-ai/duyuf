"""What the AI analyst may look at: totals, never people.

Each tool runs inside the asking operator's own session (row-level security
applies as for any request) and returns counts and operational facts only.
No tool returns a pilgrim's name, passport, birth date or phone, a group
leader's name or phone, or an incident's free-text description, which may
name someone. That is the line agreed with the owner: aggregates only.
A test checks every tool's output for the demo's names and passports.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field

from ..arrivals.brief import KSA
from ..core.db import tenant_session

DIMENSIONS = {
    "status": "p.status",
    "nationality": "p.nationality",
    "group": "g.code",
    "kind": "g.kind",
    "need": "n.need",
    "language": "coalesce(p.language, 'not recorded')",
    "gender": "p.gender",
    "age_band": """CASE WHEN p.date_of_birth IS NULL THEN 'unknown'
                        WHEN age(current_date, p.date_of_birth) < interval '40 years' THEN 'under 40'
                        WHEN age(current_date, p.date_of_birth) < interval '60 years' THEN '40-59'
                        WHEN age(current_date, p.date_of_birth) < interval '70 years' THEN '60-69'
                        WHEN age(current_date, p.date_of_birth) < interval '75 years' THEN '70-74'
                        ELSE '75 and over' END""",
    "flight": "coalesce(f.number, 'no flight')",
    "arrival_airport": "coalesce(f.arrival_airport, 'no flight')",
    "landing_date": "coalesce(to_char(coalesce(f.estimated_at, f.scheduled_at), 'YYYY-MM-DD'), 'no flight')",
    "group_arrival_date": "coalesce(g.arrival_date::text, 'not set')",
}
Dimension = Literal[tuple(DIMENSIONS)]  # type: ignore[valid-type]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CountFilters(_Strict):
    status: list[Literal["registered", "visa_issued", "arrived", "in_makkah", "in_madinah", "departed"]] | None = None
    in_kingdom: bool | None = None
    nationality: list[str] | None = None
    group: list[str] | None = None
    kind: Literal["hajj", "umrah"] | None = None
    need: list[Literal["wheelchair", "medical", "elderly", "dietary", "unaccompanied_minor"]] | None = None
    language: list[str] | None = None
    gender: Literal["male", "female"] | None = None
    min_age: int | None = Field(default=None, ge=0, le=120)
    max_age: int | None = Field(default=None, ge=0, le=120)
    flight: list[str] | None = None
    arrival_airport: list[str] | None = None
    landing_from: datetime | None = None
    landing_to: datetime | None = None
    group_arrival_from: date | None = None
    group_arrival_to: date | None = None


class CountArgs(_Strict):
    group_by: list[Dimension] = Field(default=[], max_length=3)  # type: ignore[valid-type]
    filters: CountFilters = CountFilters()


class ArrivalsArgs(_Strict):
    hours: int = Field(default=48, ge=6, le=168)


class IncidentArgs(_Strict):
    status: Literal["active", "resolved", "all"] = "active"
    since_hours: int | None = Field(default=None, ge=1, le=24 * 60)


class NoArgs(_Strict):
    pass


class ChartArgs(_Strict):
    title: str = Field(min_length=1, max_length=120)
    labels: list[str] = Field(min_length=1, max_length=24)
    values: list[float] = Field(min_length=1, max_length=24)
    unit: str | None = Field(default=None, max_length=40)


def _ksa(v: datetime) -> datetime:
    return v.replace(tzinfo=KSA) if v.tzinfo is None else v


def count_pilgrims(tenant_id: str, a: CountArgs) -> dict:
    f = a.filters
    where, params = [], []

    def any_of(expr: str, values: list[str] | None, upper: bool = False, lower: bool = False):
        if values:
            vals = [v.upper() if upper else v.lower() if lower else v for v in values]
            where.append(f"{expr} = ANY(%s)")
            params.append(vals)

    any_of("p.status", f.status)
    if f.in_kingdom is not None:
        where.append(("" if f.in_kingdom else "NOT ") + "(p.status IN ('arrived', 'in_makkah', 'in_madinah'))")
    any_of("p.nationality", f.nationality, upper=True)
    any_of("g.code", f.group, upper=True)
    if f.kind:
        where.append("g.kind = %s")
        params.append(f.kind)
    if f.need:
        where.append("p.needs && %s::text[]")
        params.append(f.need)
    any_of("p.language", f.language, lower=True)
    if f.gender:
        where.append("p.gender = %s")
        params.append(f.gender)
    if f.min_age is not None:
        where.append("age(current_date, p.date_of_birth) >= make_interval(years => %s)")
        params.append(f.min_age)
    if f.max_age is not None:
        where.append("age(current_date, p.date_of_birth) < make_interval(years => %s)")
        params.append(f.max_age + 1)
    any_of("f.number", f.flight, upper=True)
    any_of("f.arrival_airport", f.arrival_airport, upper=True)
    if f.landing_from:
        where.append("coalesce(f.estimated_at, f.scheduled_at) >= %s")
        params.append(_ksa(f.landing_from))
    if f.landing_to:
        where.append("coalesce(f.estimated_at, f.scheduled_at) < %s")
        params.append(_ksa(f.landing_to))
    if f.group_arrival_from:
        where.append("g.arrival_date >= %s")
        params.append(f.group_arrival_from)
    if f.group_arrival_to:
        where.append("g.arrival_date <= %s")
        params.append(f.group_arrival_to)

    by_need = "need" in a.group_by
    source = """pilgrim p JOIN pilgrim_group g ON g.id = p.group_id
                LEFT JOIN flight f ON f.id = p.arrival_flight_id"""
    if by_need:
        source += " LEFT JOIN LATERAL unnest(CASE WHEN p.needs = '{}' THEN ARRAY['none'] ELSE p.needs END) AS n(need) ON true"
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    with tenant_session(tenant_id) as conn:
        total = conn.execute(f"SELECT count(DISTINCT p.id)::int AS n FROM {source} {clause}", params).fetchone()["n"]
        rows = []
        if a.group_by:
            cols = ", ".join(f"{DIMENSIONS[d]} AS {d}" for d in a.group_by)
            keys = ", ".join(str(i + 1) for i in range(len(a.group_by)))
            rows = conn.execute(
                f"SELECT {cols}, count(DISTINCT p.id)::int AS pilgrims FROM {source} {clause} "
                f"GROUP BY {keys} ORDER BY pilgrims DESC, {keys} LIMIT 200", params).fetchall()
    out: dict[str, Any] = {"pilgrims": total, "rows": rows}
    if by_need:
        out["note"] = "A pilgrim with several needs is counted under each; 'none' means no recorded need."
    if f.min_age is not None or f.max_age is not None:
        out["note_age"] = "Pilgrims with no birth date recorded are left out of age filters."
    return out


def arrivals(tenant_id: str, a: ArrivalsArgs) -> dict:
    from ..routers.arrivals import _board  # the board, exactly as the Arrivals screen shows it
    with tenant_session(tenant_id) as conn:
        b = _board(conn, a.hours)
    iso = lambda v: v.astimezone(KSA).isoformat(timespec="minutes") if v else None
    return {
        "now": iso(b["now"]),
        "hours": b["hours"],
        "flights": [{
            "number": f["number"], "from": f["origin_airport"], "to": f["arrival_airport"],
            "scheduled": iso(f["scheduled_at"]), "expected": iso(f["expected_at"]), "landed": iso(f["landed_at"]),
            "state": f["state"], "minutes_late": max(0, f["delay_minutes"]),
            "groups": [g["code"] for g in f["groups"]], "short_of_resources": f["short"],
            "brief": {k: v for k, v in f["brief"].items()},
        } for f in b["flights"]],
        "need_vs_on_shift": [{**r, "start": iso(r["start"])} for r in b["load"]],
        "groups_without_flight": [{"group": u["code"], "arrives": u["arrival_date"].isoformat(),
                                   "pilgrims": u["without_flight"]} for u in b["unplanned"]],
        "rules": "Buses: 49 seats each. Interpreters: one per 40 pilgrims of a language other than Arabic "
                 "or English. A flight holds what it needs for the 3-hour block it lands in; a shift counts "
                 "for a block it covers whole.",
    }


def incidents(tenant_id: str, a: IncidentArgs) -> dict:
    where = {"active": "i.status <> 'resolved'", "resolved": "i.status = 'resolved'", "all": "true"}[a.status]
    params: list = []
    if a.since_hours:
        where += " AND i.opened_at > now() - make_interval(hours => %s)"
        params.append(a.since_hours)
    with tenant_session(tenant_id) as conn:
        by = conn.execute(f"""SELECT i.kind, i.priority, i.status, count(*)::int AS incidents
                                FROM incident i WHERE {where} GROUP BY 1, 2, 3 ORDER BY 4 DESC""", params).fetchall()
        # No pilgrim names and no descriptions: those are free text that may name someone.
        items = conn.execute(f"""
            SELECT i.ref, i.kind, i.priority, i.status, g.code AS group_code, i.location, i.team,
                   (i.pilgrim_id IS NOT NULL) AS about_one_pilgrim,
                   round(extract(epoch FROM (coalesce(i.resolved_at, now()) - i.opened_at)) / 60)::int AS minutes_open
              FROM incident i LEFT JOIN pilgrim_group g ON g.id = i.group_id
             WHERE {where} ORDER BY i.opened_at DESC LIMIT 50""", params).fetchall()
        from ..routers.incidents import _stats
        stats = _stats(conn)
    return {"by_kind_priority_status": by, "incidents": items, "stats_all_time": stats}


def groups(tenant_id: str, _: NoArgs) -> dict:
    with tenant_session(tenant_id) as conn:
        rows = conn.execute("""
            SELECT g.code, g.name, g.kind, g.season, g.origin_country, g.arrival_date::text, g.departure_date::text,
                   coalesce(c.by_status, '{}') AS pilgrims_by_status, coalesce(c.total, 0) AS pilgrims
              FROM pilgrim_group g
              LEFT JOIN LATERAL (
                    SELECT sum(n)::int AS total, jsonb_object_agg(status, n) AS by_status
                      FROM (SELECT status, count(*)::int AS n FROM pilgrim WHERE group_id = g.id GROUP BY status) s
              ) c ON true
             ORDER BY g.arrival_date NULLS LAST, g.code""").fetchall()
    return {"groups": rows}


def resources(tenant_id: str, _: NoArgs) -> dict:
    with tenant_session(tenant_id) as conn:
        rows = conn.execute("""SELECT airport, kind, language, quantity,
                                      to_char(starts_at, 'YYYY-MM-DD"T"HH24:MI') AS from_saudi_time,
                                      to_char(ends_at, 'YYYY-MM-DD"T"HH24:MI') AS until_saudi_time
                                 FROM resource_shift WHERE ends_at > now()
                                ORDER BY airport, starts_at, kind""").fetchall()
    return {"shifts": rows}


class Tool:
    def __init__(self, name: str, description: str, args: type[BaseModel], run: Callable | None):
        self.name, self.description, self.args, self.run = name, description, args, run

    def schema(self) -> dict:
        s = self.args.model_json_schema()
        return {"name": self.name, "description": self.description, "input_schema": s}


TOOLS = [
    Tool("count_pilgrims",
         "Count this operator's pilgrims, optionally split by up to three dimensions and narrowed by filters. "
         "Returns totals only. Dimensions: status (journey stage), nationality (ISO country code), group (group "
         "code), kind (hajj/umrah), need, language (ISO 639-1), gender, age_band, flight (arrival flight number), "
         "arrival_airport (IATA), landing_date, group_arrival_date. Landing filters use the flight's expected "
         "landing time, Saudi time. in_kingdom means arrived, in Makkah or in Madinah.",
         CountArgs, count_pilgrims),
    Tool("arrivals_board",
         "The arrivals board for the next `hours` (default 48): each flight with its expected time, state, "
         "delay and brief (pilgrims, over 75, wheelchairs, medical, no visa, buses, interpreters by language), "
         "need against resources on shift per airport and 3-hour block (with shortfalls), and groups landing "
         "in the window with pilgrims on no flight. Saudi time.",
         ArrivalsArgs, arrivals),
    Tool("incidents",
         "Incidents: counts by kind, priority and status; the most recent 50 (reference number, kind, priority, "
         "status, group code, location, team, minutes open) without names or descriptions; and medians of "
         "minutes to a team and to resolution over the last 7 days.",
         IncidentArgs, incidents),
    Tool("list_groups",
         "Every group: code, name, hajj/umrah, season, origin country, arrival and departure dates, and how many "
         "pilgrims are at each journey stage.", NoArgs, groups),
    Tool("resources_on_shift",
         "Wheelchairs, buses and interpreters (by language) on shift at each airport, with times, for shifts "
         "not yet over. Saudi time.", NoArgs, resources),
    Tool("show_chart",
         "Show a bar chart under the answer. Use only numbers taken from other tools' results. Labels and values "
         "in the same order; at most 24 bars.", ChartArgs, None),
]
BY_NAME = {t.name: t for t in TOOLS}
