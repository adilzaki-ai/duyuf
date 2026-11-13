import sample from "../../../sample/demo.json";
import { brief, flightState, landingDay, normalFlightNumber, waves } from "../domain/brief";
import { checkRow, IMPORT_COLUMNS } from "../domain/importRow";
import { allowedActions, incidentRefusal, type IncidentAction, type IncidentKind, type Priority } from "../domain/incidents";
import { blockOf, load } from "../domain/plan";
import { MOVES, refusal, STATUSES, type Status } from "../domain/journey";
import type {
  AnalystAnswer,
  AnalystStatus,
  Arrivals,
  Assignment,
  Flight,
  FlightChange,
  FlightDetail,
  FlightEvent,
  Group,
  GroupChange,
  GroupCards,
  HealthBoard,
  HealthRow,
  ImportProblem,
  ImportResult,
  Incident,
  IncidentDetail,
  IncidentEvent,
  IncidentFilter,
  IncidentList,
  IssuedCard,
  JourneyStep,
  Me,
  MovingGroup,
  Need,
  NewFlight,
  NewGroup,
  NewIncident,
  NewPilgrim,
  NewShift,
  NewStaff,
  Overview,
  Pilgrim,
  PilgrimDetail,
  PilgrimChange,
  PilgrimFilter,
  PilgrimHealth,
  RafeeqCardInfo,
  Scope,
  Shift,
  StaffChange,
  StaffMember,
  UnplannedGroup,
  WhatIf,
} from "../domain/types";
import { addDays, ksaDate, ksaIso } from "../lib/dates";
import { isRafeeqLang, type RafeeqLang } from "../rafeeq/help";
import { assess, type Reading } from "../rafeeq/vitals";
import { DataSourceError, type DataSource } from "./dataSource";

/**
 * The sample, with no backend: sample/demo.json, the same file
 * backend/scripts/seed_demo.py loads into the demo operator. Day offsets are
 * resolved against today, so a group always lands this week and a flight
 * always lands in the next two days. Changes made here live until the page
 * is reloaded.
 */

interface SampleStep {
  from: Status | null;
  to: Status;
  day: number;
  hour: number;
}

interface FlightRecord {
  id: string;
  number: string;
  origin_airport: string;
  arrival_airport: string;
  scheduled_at: string;
  estimated_at: string | null;
  landed_at: string | null;
  note: string | null;
  history: FlightEvent[];
}

const WINDOW_DAYS = 7;
const HOUR = 3_600_000;
/* the platform's windows: an unconfirmed flight stays on the board two days, a confirmed one six hours */
const DUE_GRACE = 48 * HOUR;
const LANDED_GRACE = 6 * HOUR;
const PRE_ARRIVAL: readonly Status[] = ["registered", "visa_issued"];
const ACTOR = "Sample viewer";
const ALL_SCOPES: Scope[] = [
  "group:read",
  "group:write",
  "pilgrim:read",
  "pilgrim:write",
  "pilgrim:status",
  "pilgrim:identity",
  "flight:read",
  "flight:write",
  "incident:read",
  "incident:write",
  "analyst:ask",
  "staff:manage",
  "rafeeq:issue",
  "health:read",
  "device:write",
];

/** A day offset and an hour as an instant, read on the Saudi clock (UTC+3, no daylight saving). */
function at(today: string, day: number, hour: number): string {
  return `${addDays(today, day)}T${String(hour).padStart(2, "0")}:00:00+03:00`;
}

const plusMinutes = (iso: string, mins: number) => ksaIso(new Date(Date.parse(iso) + mins * 60_000));

export class MockSource implements DataSource {
  readonly kind = "mock" as const;
  private readonly today: string;
  /** a fixed moment in tests; the real clock otherwise, so "due" arrives as time passes */
  private readonly clock: () => Date;
  /** "U-ID-0412|2" → the third pilgrim of that group, as sample/demo.json counts them */
  private readonly byPlace = new Map<string, string>();
  private readonly groupsById = new Map<string, Omit<Group, "pilgrims" | "by_status">>();
  private readonly people = new Map<string, PilgrimDetail>();
  private readonly flights = new Map<string, FlightRecord>();
  private readonly shiftsById = new Map<string, Shift>();
  private readonly incidentsById = new Map<string, Omit<IncidentDetail, "allowed">>();
  /* the demo operator's staff, as backend/scripts/seed_demo.py signs them in */
  private readonly staffById = new Map<string, StaffMember>(
    (
      [
        ["Amina Al-Harbi", "amina@duyuf.demo", "administrator"],
        ["Omar Siddiqui", "omar@duyuf.demo", "supervisor"],
        ["Arrivals desk", "desk@duyuf.demo", "staff"],
        ["Ministry visitor", "viewer@duyuf.demo", "viewer"],
      ] as const
    ).map(([display_name, email, role], i) => [
      `s-${i}`,
      {
        id: `s-${i}`,
        display_name,
        email,
        role,
        disabled: false,
        must_change_password: false,
        last_signed_in_at: null,
        created_at: "2026-10-01T09:00:00+03:00",
      },
    ]),
  );

  constructor(now?: Date) {
    this.clock = now ? () => now : () => new Date();
    this.today = ksaDate(this.clock());
    for (const g of sample.groups) {
      this.groupsById.set(`g-${g.code}`, {
        id: `g-${g.code}`,
        code: g.code,
        name: g.name,
        kind: g.kind as Group["kind"],
        season: g.season,
        origin_country: g.origin_country,
        arrival_date: addDays(this.today, g.arrive_in_days),
        departure_date: addDays(this.today, g.depart_in_days),
        leader_name: g.leader_name,
        leader_phone: g.leader_phone,
        meeting_name: g.meeting?.name ?? null,
        meeting_lat: g.meeting?.lat ?? null,
        meeting_lon: g.meeting?.lon ?? null,
      });
    }
    sample.resources.forEach((r, i) => {
      const id = `s-${i}`;
      this.shiftsById.set(id, {
        id,
        airport: r.airport,
        kind: r.kind as Shift["kind"],
        language: r.language,
        quantity: r.quantity,
        starts_at: at(this.today, r.from_day, 0),
        ends_at: at(this.today, r.to_day, 0),
        note: null,
        created_by: "Demo load",
        created_at: at(this.today, -20, 0),
      });
    });
    const flightId = new Map<string, string>();
    for (const f of sample.flights) {
      const id = `f-${f.number.replace(" ", "")}`;
      const scheduled = `${addDays(this.today, f.day)}T${f.time}:00+03:00`;
      flightId.set(f.number, id);
      this.flights.set(id, {
        id,
        number: f.number,
        origin_airport: f.origin_airport,
        arrival_airport: f.arrival_airport,
        scheduled_at: scheduled,
        estimated_at: f.delay_minutes > 0 ? plusMinutes(scheduled, f.delay_minutes) : null,
        landed_at: null,
        note: null,
        history: [{ kind: "created", detail: {}, actor: "Demo load", at: at(this.today, -20, 0) }],
      });
    }
    sample.pilgrims.forEach((p, i) => {
      const group = this.groupsById.get(`g-${p.group_code}`)!;
      const steps = p.history as SampleStep[];
      const history: JourneyStep[] = steps.map((h) => ({
        from_status: h.from,
        to_status: h.to,
        note: null,
        actor: "Demo load",
        at: at(this.today, h.day, h.hour),
      }));
      const status = p.status as Status;
      this.people.set(`p-${i}`, {
        id: `p-${i}`,
        group_id: group.id,
        group_code: group.code,
        group_name: group.name,
        full_name: p.full_name,
        full_name_ar: p.full_name_ar,
        gender: p.gender as Pilgrim["gender"],
        date_of_birth: p.date_of_birth,
        nationality: p.nationality,
        passport_no: p.passport_no,
        phone: p.phone,
        language: p.language,
        status,
        needs: p.needs as Need[],
        updated_at: history[history.length - 1].at,
        arrival_flight_id: p.flight ? flightId.get(p.flight)! : null,
        flight_number: p.flight,
        allowed: [...MOVES[status]],
        history,
      });
    });
    const place = new Map<string, number>();
    const byPlace = this.byPlace;
    sample.pilgrims.forEach((p, i) => {
      const n = place.get(p.group_code) ?? 0;
      byPlace.set(`${p.group_code}|${n}`, `p-${i}`);
      place.set(p.group_code, n + 1);
    });
    const t0 = this.clock().getTime();
    const ago = (mins: number) => ksaIso(new Date(t0 - mins * 60_000));
    sample.incidents.forEach((x, i) => {
      const opened = ago(x.minutes_ago);
      const after = (m: number | null) => (m == null ? null : ago(x.minutes_ago - m));
      const pid = x.pilgrim_index == null ? null : byPlace.get(`${x.group_code}|${x.pilgrim_index}`)!;
      const history: IncidentEvent[] = [{ kind: "opened", note: null, team: null, actor: x.reported_by, at: opened }];
      if (x.team) history.push({ kind: "assigned", note: null, team: x.team, actor: "Operations desk", at: after(x.assigned_after)! });
      if (x.resolved_after != null)
        history.push({ kind: "resolved", note: x.resolution, team: null, actor: x.team!, at: after(x.resolved_after)! });
      this.incidentsById.set(`i-${i}`, {
        id: `i-${i}`,
        ref: 1001 + i,
        kind: x.kind as IncidentKind,
        priority: x.priority as Priority,
        status: x.resolved_after != null ? "resolved" : x.team ? "assigned" : "open",
        pilgrim_id: pid,
        pilgrim_name: null,
        pilgrim_name_ar: null,
        group_id: `g-${x.group_code}`,
        group_code: null,
        group_name: null,
        leader_phone: null,
        location: x.location,
        description: x.description,
        team: x.team,
        resolution: x.resolution,
        reported_by: x.reported_by,
        opened_at: opened,
        assigned_at: after(x.assigned_after),
        resolved_at: after(x.resolved_after),
        updated_at: history[history.length - 1].at,
        from_rafeeq: false,
        pilgrim_ok_at: null,
        history,
      });
    });
  }

  private now(): string {
    return ksaIso(this.clock());
  }

  async me(): Promise<Me> {
    const op = sample.operator;
    return {
      tenant: { id: "sample", slug: op.slug, name: op.name, name_ar: op.name_ar, is_demo: true },
      principal: { id: null, name: ACTOR, role: "administrator", email: null, must_change_password: false },
      via: "sample",
      scopes: ALL_SCOPES,
    };
  }

  private withCounts(g: Omit<Group, "pilgrims" | "by_status">): Group {
    const by_status: Group["by_status"] = {};
    let pilgrims = 0;
    for (const p of this.people.values()) {
      if (p.group_id !== g.id) continue;
      pilgrims += 1;
      by_status[p.status] = (by_status[p.status] ?? 0) + 1;
    }
    return { ...g, pilgrims, by_status };
  }

  async overview(): Promise<Overview> {
    const by_status = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
    const needs: Overview["needs"] = {};
    for (const p of this.people.values()) {
      by_status[p.status] += 1;
      if (p.status !== "departed") for (const n of p.needs) needs[n] = (needs[n] ?? 0) + 1;
    }
    const until = addDays(this.today, WINDOW_DAYS);
    const moving = (field: "arrival_date" | "departure_date"): MovingGroup[] =>
      [...this.groupsById.values()]
        .filter((g) => g[field] != null && g[field]! >= this.today && g[field]! <= until)
        .sort((a, b) => a[field]!.localeCompare(b[field]!) || a.code.localeCompare(b.code))
        .map((g) => ({
          id: g.id,
          code: g.code,
          name: g.name,
          kind: g.kind,
          origin_country: g.origin_country,
          on_date: g[field]!,
          pilgrims: this.withCounts(g).pilgrims,
        }));
    return {
      today: this.today,
      window_days: WINDOW_DAYS,
      groups: this.groupsById.size,
      pilgrims: this.people.size,
      by_status,
      needs,
      arriving: moving("arrival_date"),
      departing: moving("departure_date"),
    };
  }

  async groups(): Promise<Group[]> {
    return [...this.groupsById.values()]
      .map((g) => this.withCounts(g))
      .sort((a, b) => (a.arrival_date ?? "9").localeCompare(b.arrival_date ?? "9") || a.code.localeCompare(b.code));
  }

  async group(id: string): Promise<Group> {
    const g = this.groupsById.get(id);
    if (!g) throw new DataSourceError("no such group", { status: 404 });
    return this.withCounts(g);
  }

  async pilgrims(f: PilgrimFilter) {
    const q = f.q?.trim().toLowerCase();
    const all = [...this.people.values()]
      .filter((p) => !f.group_id || p.group_id === f.group_id)
      .filter((p) => !f.flight_id || p.arrival_flight_id === f.flight_id)
      .filter((p) => !f.status || p.status === f.status)
      .filter(
        (p) =>
          !q ||
          p.full_name.toLowerCase().includes(q) ||
          (p.full_name_ar ?? "").includes(q) ||
          p.passport_no.toLowerCase().includes(q),
      )
      /* the platform's order: groups by arrival, then names */
      .sort(
        (a, b) =>
          (this.groupsById.get(a.group_id)!.arrival_date ?? "9").localeCompare(
            this.groupsById.get(b.group_id)!.arrival_date ?? "9",
          ) ||
          a.group_code.localeCompare(b.group_code) ||
          a.full_name.localeCompare(b.full_name),
      );
    const offset = f.offset ?? 0;
    const items = all.slice(offset, offset + (f.limit ?? 100)).map(({ history: _h, ...p }) => p);
    return { items, total: all.length };
  }

  async pilgrim(id: string): Promise<PilgrimDetail> {
    const p = this.people.get(id);
    if (!p) throw new DataSourceError("no such pilgrim", { status: 404 });
    return { ...p, history: [...p.history] };
  }

  private step(p: PilgrimDetail, to: Status, note: string | null): PilgrimDetail {
    const now = this.now();
    const next: PilgrimDetail = {
      ...p,
      status: to,
      allowed: [...MOVES[to]],
      updated_at: now,
      history: [...p.history, { from_status: p.status, to_status: to, note, actor: ACTOR, at: now }],
    };
    this.people.set(p.id, next);
    return next;
  }

  async movePilgrim(id: string, to: Status, note?: string): Promise<PilgrimDetail> {
    const p = this.people.get(id);
    if (!p) throw new DataSourceError("no such pilgrim", { status: 404 });
    const why = refusal(p.status, to);
    if (why) throw new DataSourceError(why, { status: 409 });
    return { ...this.step(p, to, note ?? null) };
  }

  /* ---- arrivals ---- */

  private view(f: FlightRecord, now: Date): Flight {
    const expected = f.estimated_at ?? f.scheduled_at;
    const on = [...this.people.values()].filter((p) => p.arrival_flight_id === f.id);
    const groups = new Map<string, Flight["groups"][number]>();
    for (const p of on) {
      const g = groups.get(p.group_id) ?? { id: p.group_id, code: p.group_code, name: p.group_name, pilgrims: 0 };
      g.pilgrims += 1;
      groups.set(p.group_id, g);
    }
    const { history: _h, ...rest } = f;
    return {
      ...rest,
      expected_at: expected,
      delay_minutes: Math.floor((Date.parse(expected) - Date.parse(f.scheduled_at)) / 60_000),
      state: flightState(expected, f.scheduled_at, f.landed_at, now),
      groups: [...groups.values()].sort((a, b) => a.code.localeCompare(b.code)),
      brief: brief(on, landingDay(expected)),
    };
  }

  private detail(id: string): FlightDetail {
    const f = this.flights.get(id);
    if (!f) throw new DataSourceError("no such flight", { status: 404 });
    return { ...this.view(f, this.clock()), history: [...f.history] };
  }

  async arrivals(hours: number): Promise<Arrivals> {
    return this.board(hours, {}, []);
  }

  async whatIf(w: WhatIf): Promise<Arrivals> {
    for (const x of w.extra)
      if ((x.kind === "interpreter") !== (x.language != null))
        throw new DataSourceError("an interpreter needs a language; nothing else has one", { status: 422 });
    return this.board(w.hours, Object.fromEntries(w.delays.map((d) => [d.flight_id, d.minutes])), w.extra);
  }

  /** The platform's board: with delays and extra resources it is a what-if, and nothing is kept. */
  private board(hours: number, delays: Record<string, number>, extra: WhatIf["extra"]): Arrivals {
    const now = this.clock();
    const t = now.getTime();
    const until = t + hours * HOUR;
    const flights = [...this.flights.values()]
      .map((rec) => {
        const minutes = delays[rec.id];
        if (!minutes || rec.landed_at) return this.view(rec, now);
        const moved = plusMinutes(rec.estimated_at ?? rec.scheduled_at, minutes);
        return this.view({ ...rec, estimated_at: moved }, now);
      })
      .filter((f) => {
        const e = Date.parse(f.expected_at);
        if (e >= until) return false;
        return e >= t || (!f.landed_at && e >= t - DUE_GRACE) || (!!f.landed_at && Date.parse(f.landed_at) >= t - LANDED_GRACE);
      })
      .sort((a, b) => Date.parse(a.expected_at) - Date.parse(b.expected_at) || a.number.localeCompare(b.number));
    const from = ksaDate(now);
    const to = ksaDate(new Date(until));
    const unplanned: UnplannedGroup[] = [];
    for (const g of this.groupsById.values()) {
      if (!g.arrival_date || g.arrival_date < from || g.arrival_date > to) continue;
      const n = [...this.people.values()].filter(
        (p) => p.group_id === g.id && !p.arrival_flight_id && PRE_ARRIVAL.includes(p.status),
      ).length;
      if (n) unplanned.push({ id: g.id, code: g.code, name: g.name, arrival_date: g.arrival_date, without_flight: n });
    }
    unplanned.sort((a, b) => a.arrival_date.localeCompare(b.arrival_date) || a.code.localeCompare(b.code));
    const far = (d: number) => ksaIso(new Date(t + d * 3650 * 24 * HOUR));
    const shifts = [
      ...this.shiftsById.values(),
      ...extra.map((x) => ({ ...x, starts_at: far(-1), ends_at: far(1) })),
    ];
    const rows = load(flights, shifts, now, hours);
    const gapAt = new Set(rows.filter((r) => r.short.length).map((r) => `${Date.parse(r.start)}|${r.airport}`));
    const first = blockOf(t, now);
    const marked = flights.map((f) => {
      const at = Date.parse(f.expected_at);
      return { ...f, short: !f.landed_at && at >= first && gapAt.has(`${blockOf(at, now)}|${f.arrival_airport}`) };
    });
    return {
      now: ksaIso(now),
      hours,
      slot_hours: 3,
      flights: marked,
      waves: waves(marked, now, hours),
      load: rows,
      unplanned,
      what_if: Object.keys(delays).length > 0 || extra.length > 0,
    };
  }

  /* ---- resources on shift ---- */

  async shifts(): Promise<Shift[]> {
    const now = this.clock().getTime();
    const key = (s: Shift) => [s.airport, s.starts_at, s.kind, s.language ?? ""].join("|");
    return [...this.shiftsById.values()]
      .filter((s) => Date.parse(s.ends_at) > now)
      .sort((a, b) => (key(a) < key(b) ? -1 : 1));
  }

  async addShift(n: NewShift): Promise<Shift> {
    if (!/^[A-Za-z]{3}$/.test(n.airport)) throw new DataSourceError("an airport is three letters, like JED", { status: 422 });
    if (Date.parse(n.ends_at) <= Date.parse(n.starts_at))
      throw new DataSourceError("a shift ends after it starts", { status: 422 });
    if ((n.kind === "interpreter") !== (n.language != null))
      throw new DataSourceError("an interpreter needs a language; nothing else has one", { status: 422 });
    if (n.quantity < 1 || n.quantity > 1000) throw new DataSourceError("between 1 and 1000", { status: 422 });
    const s: Shift = {
      id: `s-new-${this.shiftsById.size + 1}-${Date.now()}`,
      airport: n.airport.toUpperCase(),
      kind: n.kind,
      language: n.language,
      quantity: n.quantity,
      starts_at: ksaIso(new Date(n.starts_at)),
      ends_at: ksaIso(new Date(n.ends_at)),
      note: n.note ?? null,
      created_by: ACTOR,
      created_at: this.now(),
    };
    this.shiftsById.set(s.id, s);
    return s;
  }

  async removeShift(id: string): Promise<void> {
    if (!this.shiftsById.delete(id)) throw new DataSourceError("no such shift", { status: 404 });
  }

  async flight(id: string): Promise<FlightDetail> {
    return this.detail(id);
  }

  async createFlight(n: NewFlight): Promise<FlightDetail> {
    const number = normalFlightNumber(n.number);
    if (!number) throw new DataSourceError("a flight number looks like SV 3102: airline code, then number", { status: 422 });
    for (const code of [n.origin_airport, n.arrival_airport])
      if (!/^[A-Za-z]{3}$/.test(code)) throw new DataSourceError("an airport is three letters, like JED", { status: 422 });
    const scheduled = ksaIso(new Date(n.scheduled_at));
    for (const f of this.flights.values())
      if (f.number === number && Date.parse(f.scheduled_at) === Date.parse(scheduled))
        throw new DataSourceError(`already exists: ${number} at that time`, { status: 409 });
    const id = `f-new-${this.flights.size + 1}`;
    this.flights.set(id, {
      id,
      number,
      origin_airport: n.origin_airport.toUpperCase(),
      arrival_airport: n.arrival_airport.toUpperCase(),
      scheduled_at: scheduled,
      estimated_at: null,
      landed_at: null,
      note: n.note ?? null,
      history: [{ kind: "created", detail: { scheduled_at: scheduled }, actor: ACTOR, at: this.now() }],
    });
    return this.detail(id);
  }

  async updateFlight(id: string, change: FlightChange): Promise<FlightDetail> {
    const f = this.flights.get(id);
    if (!f) throw new DataSourceError("no such flight", { status: 404 });
    if ("estimated_at" in change) {
      if (f.landed_at)
        throw new DataSourceError(`${f.number} has landed; its time is no longer an estimate`, { status: 409 });
      f.estimated_at = change.estimated_at ? ksaIso(new Date(change.estimated_at)) : null;
      f.history.push({ kind: "expected", detail: { expected_at: f.estimated_at }, actor: ACTOR, at: this.now() });
    }
    if ("note" in change) f.note = change.note ?? null;
    return this.detail(id);
  }

  async assignToFlight(id: string, who: Assignment): Promise<FlightDetail & { added: number }> {
    const f = this.flights.get(id);
    if (!f) throw new DataSourceError("no such flight", { status: 404 });
    if (f.landed_at)
      throw new DataSourceError(`${f.number} has landed; put these pilgrims on another flight`, { status: 409 });
    let chosen: PilgrimDetail[];
    let group: string | undefined;
    if ("group_id" in who) {
      const g = this.groupsById.get(who.group_id);
      if (!g) throw new DataSourceError("no such group", { status: 404 });
      group = g.code;
      chosen = [...this.people.values()].filter(
        (p) => p.group_id === g.id && !p.arrival_flight_id && PRE_ARRIVAL.includes(p.status),
      );
    } else {
      const missing = who.pilgrim_ids.filter((pid) => !this.people.has(pid));
      if (missing.length) throw new DataSourceError(`no such pilgrim: ${missing.join(", ")}`, { status: 404 });
      chosen = who.pilgrim_ids.map((pid) => this.people.get(pid)!);
      const gone = chosen.filter((p) => !PRE_ARRIVAL.includes(p.status)).map((p) => p.full_name);
      if (gone.length)
        throw new DataSourceError(`already in the Kingdom or gone home: ${gone.join(", ")}`, { status: 409 });
    }
    const now = this.now();
    for (const p of chosen)
      this.people.set(p.id, { ...p, arrival_flight_id: f.id, flight_number: f.number, updated_at: now });
    if (chosen.length)
      f.history.push({
        kind: "added",
        detail: group ? { added: chosen.length, group } : { added: chosen.length },
        actor: ACTOR,
        at: now,
      });
    return { ...this.detail(id), added: chosen.length };
  }

  async landFlight(id: string, note?: string): Promise<FlightDetail & { arrived: number; no_visa: number }> {
    const f = this.flights.get(id);
    if (!f) throw new DataSourceError("no such flight", { status: 404 });
    if (f.landed_at) throw new DataSourceError(`${f.number} was already marked landed`, { status: 409 });
    f.landed_at = this.now();
    const on = [...this.people.values()].filter((p) => p.arrival_flight_id === f.id);
    const moving = on.filter((p) => refusal(p.status, "arrived") === null);
    for (const p of moving) this.step(p, "arrived", note || `Flight ${f.number} landed`);
    const no_visa = on.filter((p) => p.status === "registered").length;
    f.history.push({ kind: "landed", detail: { arrived: moving.length, no_visa }, actor: ACTOR, at: f.landed_at });
    return { ...this.detail(id), arrived: moving.length, no_visa };
  }

  /* ---- adding and editing ---- */

  async createGroup(g: NewGroup): Promise<Group> {
    if ([...this.groupsById.values()].some((x) => x.code === g.code))
      throw new DataSourceError(`already exists: a group with code ${g.code}`, { status: 409 });
    if (!/^[A-Z]{2}$/.test(g.origin_country))
      throw new DataSourceError("a value is not in the form expected: country is two letters", { status: 422 });
    if (g.arrival_date && g.departure_date && g.departure_date < g.arrival_date)
      throw new DataSourceError("a value is not in the form expected: it leaves before it arrives", { status: 400 });
    const id = `g-${g.code}`;
    this.groupsById.set(id, { id, ...g });
    return this.withCounts(this.groupsById.get(id)!);
  }

  async updateGroup(id: string, change: GroupChange): Promise<Group> {
    const g = this.groupsById.get(id);
    if (!g) throw new DataSourceError("no such group", { status: 404 });
    const next = { ...g, ...change };
    if (next.arrival_date && next.departure_date && next.departure_date < next.arrival_date)
      throw new DataSourceError("a value is not in the form expected: it leaves before it arrives", { status: 400 });
    if ((next.meeting_lat == null) !== (next.meeting_lon == null) || (next.meeting_lat != null && !next.meeting_name))
      throw new DataSourceError("a value is not in the form expected: a meeting point needs a name and a place", { status: 400 });
    this.groupsById.set(id, next);
    for (const p of this.people.values())
      if (p.group_id === id && next.name !== g.name) this.people.set(p.id, { ...p, group_name: next.name });
    return this.withCounts(next);
  }

  private add(p: NewPilgrim, note: string | null): PilgrimDetail {
    const g = this.groupsById.get(p.group_id);
    if (!g) throw new DataSourceError("refers to something that does not exist: the group", { status: 422 });
    const passport = p.passport_no.replace(/\s+/g, "").toUpperCase();
    if ([...this.people.values()].some((x) => x.nationality === p.nationality && x.passport_no === passport))
      throw new DataSourceError(`already exists: passport ${passport}`, { status: 409 });
    const now = this.now();
    const id = `p-new-${this.people.size}-${Date.now()}`;
    const detail: PilgrimDetail = {
      ...p,
      id,
      passport_no: passport,
      group_code: g.code,
      group_name: g.name,
      status: "registered",
      allowed: [...MOVES.registered],
      updated_at: now,
      arrival_flight_id: null,
      flight_number: null,
      history: [{ from_status: null, to_status: "registered", note, actor: ACTOR, at: now }],
    };
    this.people.set(id, detail);
    return detail;
  }

  async createPilgrim(p: NewPilgrim): Promise<PilgrimDetail> {
    return { ...this.add(p, null) };
  }

  async updatePilgrim(id: string, change: PilgrimChange): Promise<PilgrimDetail> {
    const p = this.people.get(id);
    if (!p) throw new DataSourceError("no such pilgrim", { status: 404 });
    const next: PilgrimDetail = { ...p, ...change, updated_at: this.now() };
    if ("arrival_flight_id" in change) next.flight_number = null;
    this.people.set(id, next);
    return { ...next };
  }

  async importPilgrims(groupId: string, rows: Record<string, string>[], dryRun: boolean): Promise<ImportResult> {
    if (!this.groupsById.has(groupId)) throw new DataSourceError("no such group", { status: 404 });
    const errors: ImportProblem[] = [];
    const good: [number, Omit<NewPilgrim, "group_id">][] = [];
    const seen = new Map<string, number>();
    rows.forEach((raw, i) => {
      const { value, problems } = checkRow(raw);
      errors.push(...problems.map((x) => ({ row: i + 1, ...x })));
      if (!value) return;
      const key = `${value.nationality}|${value.passport_no}`;
      if (seen.has(key)) {
        errors.push({ row: i + 1, field: "passport_no", message: `same passport as row ${seen.get(key)}` });
        return;
      }
      seen.set(key, i + 1);
      good.push([i + 1, value]);
    });
    for (const [row, v] of good)
      if ([...this.people.values()].some((x) => x.nationality === v.nationality && x.passport_no === v.passport_no))
        errors.push({ row, field: "passport_no", message: "already registered with this operator" });
    const order = (f: string) => {
      const i = (IMPORT_COLUMNS as readonly string[]).indexOf(f);
      return i < 0 ? 99 : i;
    };
    errors.sort((a, b) => a.row - b.row || order(a.field) - order(b.field));
    const bad = new Set(errors.map((e) => e.row));
    const saved = !dryRun && errors.length === 0 && rows.length > 0;
    if (saved) for (const [, v] of good) this.add({ ...v, group_id: groupId }, "Imported from a spreadsheet");
    return { rows: rows.length, valid: rows.length - bad.size, errors, saved };
  }

  /* ---- incidents ---- */

  /** With the pilgrim's and group's current names, as the platform joins them. */
  private shown(rec: Omit<IncidentDetail, "allowed">): IncidentDetail {
    const p = rec.pilgrim_id ? this.people.get(rec.pilgrim_id) : undefined;
    const g = rec.group_id ? this.groupsById.get(rec.group_id) : undefined;
    return {
      ...rec,
      pilgrim_name: p?.full_name ?? null,
      pilgrim_name_ar: p?.full_name_ar ?? null,
      group_code: g?.code ?? null,
      group_name: g?.name ?? null,
      leader_phone: g?.leader_phone ?? null,
      allowed: allowedActions(rec.status),
      history: [...rec.history],
    };
  }

  async incidents(f: IncidentFilter): Promise<IncidentList> {
    const rank = { urgent: 0, high: 1, normal: 2 } as const;
    const all = [...this.incidentsById.values()];
    const items: Incident[] = all
      .filter((i) => (f.status ?? "active") === "all" || ((f.status ?? "active") === "active") === (i.status !== "resolved"))
      .filter((i) => !f.kind || i.kind === f.kind)
      .filter((i) => !f.pilgrim_id || i.pilgrim_id === f.pilgrim_id)
      .filter((i) => !f.group_id || i.group_id === f.group_id)
      /* the platform's order: still to deal with, most pressing, longest waiting; resolved, latest first */
      .sort((a, b) => {
        const ra = a.status === "resolved" ? 1 : 0;
        const rb = b.status === "resolved" ? 1 : 0;
        if (ra !== rb) return ra - rb;
        if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
        const ka = ra ? -Date.parse(a.resolved_at!) : Date.parse(a.opened_at);
        const kb = rb ? -Date.parse(b.resolved_at!) : Date.parse(b.opened_at);
        return ka - kb || a.ref - b.ref;
      })
      .map((i) => {
        const { history: _h, ...rest } = this.shown(i);
        return rest;
      });
    const now = this.clock().getTime();
    const week = all.filter((i) => Date.parse(i.opened_at) > now - 7 * 24 * HOUR);
    const median = (xs: number[]) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      const m = s.length / 2;
      return Math.round(Number.isInteger(m) ? (s[m - 1] + s[m]) / 2 : s[Math.floor(m)]);
    };
    const mins = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;
    const today = ksaDate(this.clock());
    const teams = new Map<string, number>();
    for (const i of all) if (i.team) teams.set(i.team, Math.max(teams.get(i.team) ?? 0, Date.parse(i.updated_at)));
    return {
      items,
      stats: {
        open: all.filter((i) => i.status === "open").length,
        assigned: all.filter((i) => i.status === "assigned").length,
        urgent: all.filter((i) => i.status !== "resolved" && i.priority === "urgent").length,
        resolved_today: all.filter((i) => i.status === "resolved" && ksaDate(new Date(i.resolved_at!)) === today).length,
        minutes_to_assign: median(week.filter((i) => i.assigned_at).map((i) => mins(i.opened_at, i.assigned_at!))),
        minutes_to_resolve: median(
          week.filter((i) => i.status === "resolved").map((i) => mins(i.opened_at, i.resolved_at!)),
        ),
      },
      teams: [...teams].sort((a, b) => b[1] - a[1]).map(([team]) => team),
    };
  }

  async incident(id: string): Promise<IncidentDetail> {
    const rec = this.incidentsById.get(id);
    if (!rec) throw new DataSourceError("no such incident", { status: 404 });
    return this.shown(rec);
  }

  async raiseIncident(n: NewIncident): Promise<IncidentDetail> {
    if (!n.description.trim()) throw new DataSourceError("a description is needed", { status: 422 });
    let group_id = n.group_id;
    if (n.pilgrim_id) {
      const p = this.people.get(n.pilgrim_id);
      if (!p) throw new DataSourceError("refers to something that does not exist: no such pilgrim", { status: 422 });
      group_id = p.group_id;
    }
    const now = this.now();
    const id = `i-new-${this.incidentsById.size}-${Date.now()}`;
    this.incidentsById.set(id, {
      id,
      ref: 1001 + this.incidentsById.size,
      kind: n.kind,
      priority: n.priority,
      status: "open",
      pilgrim_id: n.pilgrim_id,
      pilgrim_name: null,
      pilgrim_name_ar: null,
      group_id,
      group_code: null,
      group_name: null,
      leader_phone: null,
      location: n.location,
      description: n.description.trim(),
      team: null,
      resolution: null,
      reported_by: ACTOR,
      opened_at: now,
      assigned_at: null,
      resolved_at: null,
      updated_at: now,
      from_rafeeq: false,
      pilgrim_ok_at: null,
      history: [{ kind: "opened", note: null, team: null, actor: ACTOR, at: now }],
    });
    return this.incident(id);
  }

  private act(id: string, action: IncidentAction | null, change: Partial<IncidentDetail>, event: Omit<IncidentEvent, "actor" | "at">) {
    const rec = this.incidentsById.get(id);
    if (!rec) throw new DataSourceError("no such incident", { status: 404 });
    if (action) {
      const why = incidentRefusal(rec.status, action);
      if (why) throw new DataSourceError(why, { status: 409 });
    }
    const now = this.now();
    this.incidentsById.set(id, {
      ...rec,
      ...change,
      updated_at: now,
      history: [...rec.history, { ...event, actor: ACTOR, at: now }],
    });
    return this.incident(id);
  }

  async assignIncident(id: string, team: string, note?: string): Promise<IncidentDetail> {
    const rec = this.incidentsById.get(id);
    const name = team.trim();
    if (!name) throw new DataSourceError("a team is needed", { status: 422 });
    return this.act(
      id,
      "assign",
      { status: "assigned", team: name, assigned_at: rec?.assigned_at ?? this.now() },
      { kind: "assigned", team: name, note: note?.trim() || null },
    );
  }

  async resolveIncident(id: string, resolution: string): Promise<IncidentDetail> {
    if (!resolution.trim()) throw new DataSourceError("say how it was resolved", { status: 422 });
    return this.act(
      id,
      "resolve",
      { status: "resolved", resolution: resolution.trim(), resolved_at: this.now() },
      { kind: "resolved", team: null, note: resolution.trim() },
    );
  }

  async reopenIncident(id: string, note: string): Promise<IncidentDetail> {
    if (!note.trim()) throw new DataSourceError("a note needs words", { status: 422 });
    return this.act(id, "reopen", { status: "open", resolution: null, resolved_at: null }, { kind: "reopened", team: null, note: note.trim() });
  }

  async noteIncident(id: string, note: string): Promise<IncidentDetail> {
    if (!note.trim()) throw new DataSourceError("a note needs words", { status: 422 });
    return this.act(id, null, {}, { kind: "note", team: null, note: note.trim() });
  }

  /* ---- the analyst: it needs the platform; the sample sends nothing anywhere ---- */

  async analystStatus(): Promise<AnalystStatus> {
    return { ready: false, model: "claude-opus-5-5", reason: "sample mode: questions are never sent out" };
  }

  async ask(_question: string, _history: { question: string; answer: string }[]): Promise<AnalystAnswer> {
    throw new DataSourceError("The analyst needs the platform. Sample mode does not send questions out.", { status: 503 });
  }

  async analystRecent(): Promise<AnalystAnswer[]> {
    return [];
  }

  /* ---- Rafeeq cards: a sample card opens the sample Rafeeq page for that pilgrim; nothing is sent ---- */

  private readonly cards = new Map<string, RafeeqCardInfo>();

  async rafeeqCard(pilgrimId: string): Promise<RafeeqCardInfo | null> {
    if (!this.people.has(pilgrimId)) throw new DataSourceError("no such pilgrim", { status: 404 });
    return this.cards.get(pilgrimId) ?? null;
  }

  private card(pilgrimId: string, language?: RafeeqLang): IssuedCard {
    const p = this.people.get(pilgrimId);
    if (!p) throw new DataSourceError("no such pilgrim", { status: 404 });
    if (p.status === "departed")
      throw new DataSourceError("this pilgrim has left the Kingdom; a card would not help them", { status: 409 });
    const lang = language ?? (isRafeeqLang(p.language) ? p.language : "en");
    this.cards.set(pilgrimId, { language: lang, issued_by: ACTOR, issued_at: this.now(), last_used_at: null });
    return {
      token: `rfq_sample.${pilgrimId}.${lang}`,
      language: lang,
      pilgrim_id: pilgrimId,
      full_name: p.full_name,
      full_name_ar: p.full_name_ar,
      group_code: p.group_code,
      group_name: p.group_name,
    };
  }

  async issueRafeeqCard(pilgrimId: string, language?: RafeeqLang): Promise<IssuedCard> {
    return this.card(pilgrimId, language);
  }

  async stopRafeeqCard(pilgrimId: string): Promise<void> {
    this.cards.delete(pilgrimId);
  }

  async issueGroupRafeeqCards(groupId: string, replace: boolean): Promise<GroupCards> {
    if (!this.groupsById.has(groupId)) throw new DataSourceError("no such group", { status: 404 });
    const on = [...this.people.values()]
      .filter((p) => p.group_id === groupId && p.status !== "departed")
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    const kept = replace ? 0 : on.filter((p) => this.cards.has(p.id)).length;
    return { cards: on.filter((p) => replace || !this.cards.has(p.id)).map((p) => this.card(p.id)), kept };
  }

  /* ---- health: the sample's invented readings, judged by the same rules, times counted back from now ---- */

  private sampleVitals() {
    const t0 = this.clock().getTime();
    const ago = (m: number) => new Date(t0 - m * 60_000).toISOString();
    return sample.vitals.map((v) => ({
      id: this.byPlace.get(`${v.group_code}|${v.pilgrim_index}`)!,
      v,
      readings: v.readings.map((r) => [ago(r.minutes_ago), r.heart_rate, r.temperature] as Reading),
      water: v.water_minutes_ago != null && v.health ? ago(v.water_minutes_ago) : null,
      place: { lat: v.place.lat, lon: v.place.lon, accuracy_m: v.place.accuracy_m, at: ago(v.place.minutes_ago), source: "simulated" as const },
    }));
  }

  async health(): Promise<HealthBoard> {
    const rank = { danger: 0, warning: 1, watch: 2, ok: 3, unknown: 4 };
    const items: HealthRow[] = this.sampleVitals().map(({ id, v, readings, water, place }) => {
      const p = this.people.get(id)!;
      const health = v.health ? { ...assess(readings, water, this.clock()), simulated: true } : null;
      return {
        pilgrim_id: id,
        full_name: p.full_name,
        full_name_ar: p.full_name_ar,
        status: p.status,
        needs: p.needs,
        group_id: p.group_id,
        group_code: p.group_code,
        group_name: p.group_name,
        shares_health: v.health,
        shares_location: true,
        health,
        place,
        alert: null,
      };
    });
    items.sort(
      (a, b) => rank[a.health?.level ?? "unknown"] - rank[b.health?.level ?? "unknown"] || a.full_name.localeCompare(b.full_name),
    );
    const has = (x: HealthRow, r: string) => (x.health?.reasons as string[] | undefined)?.includes(r) ?? false;
    return {
      items,
      stats: {
        danger: items.filter((x) => x.health?.level === "danger").length,
        fever: items.filter((x) => has(x, "fever")).length,
        heart: items.filter((x) => ["heart_high", "heart_unstable", "heart_danger_high", "heart_danger_low"].some((r) => has(x, r))).length,
        dehydration: items.filter((x) => has(x, "dehydration_risk")).length,
        sharing_health: items.filter((x) => x.shares_health).length,
        sharing_location: items.filter((x) => x.shares_location).length,
        no_readings: items.filter((x) => x.health && x.health.heart.state === "unknown" && x.health.temperature.state === "unknown").length,
        alerts: 0,
      },
      at: this.now(),
    };
  }

  async pilgrimHealth(pilgrimId: string): Promise<PilgrimHealth> {
    if (!this.people.has(pilgrimId)) throw new DataSourceError("no such pilgrim", { status: 404 });
    const found = this.sampleVitals().find((x) => x.id === pilgrimId);
    if (!found) return { consent: { health: false, location: false }, health: null, readings: [], alerts: [], places: [] };
    const { v, readings, water, place } = found;
    return {
      consent: { health: v.health, location: true },
      health: v.health ? { ...assess(readings, water, this.clock()), simulated: true } : null,
      readings: readings.map(([at, heart_rate, temperature]) => ({ at, heart_rate, temperature, source: "simulated" })),
      alerts: [],
      places: [place],
    };
  }

  /* ---- signing in, and staff: the sample has no sign in; its staff list lives until reload ---- */

  async signIn(_email: string, _password: string): Promise<Me> {
    return this.me();
  }

  async signOut(): Promise<void> {}

  async changePassword(_current: string, _next: string): Promise<Me> {
    throw new DataSourceError("The sample has no passwords. Sign in to the platform to change yours.", { status: 400 });
  }

  async staff(): Promise<StaffMember[]> {
    return [...this.staffById.values()].sort(
      (a, b) => Number(a.disabled) - Number(b.disabled) || a.role.localeCompare(b.role) || a.display_name.localeCompare(b.display_name),
    );
  }

  async addStaff(n: NewStaff): Promise<StaffMember> {
    const email = n.email.trim().toLowerCase();
    if ([...this.staffById.values()].some((x) => x.email === email))
      throw new DataSourceError("already exists: that email signs in already", { status: 409 });
    if (n.password.length < 10) throw new DataSourceError("a password needs at least 10 characters", { status: 422 });
    const s: StaffMember = {
      id: `s-new-${Date.now()}`,
      display_name: n.display_name.trim(),
      email,
      role: n.role,
      disabled: false,
      must_change_password: true,
      last_signed_in_at: null,
      created_at: this.now(),
    };
    this.staffById.set(s.id, s);
    return s;
  }

  async updateStaff(id: string, c: StaffChange): Promise<StaffMember> {
    const s = this.staffById.get(id);
    if (!s) throw new DataSourceError("no such person", { status: 404 });
    const next: StaffMember = {
      ...s,
      ...(c.display_name ? { display_name: c.display_name } : {}),
      ...(c.role ? { role: c.role } : {}),
      ...(c.disabled != null ? { disabled: c.disabled } : {}),
      ...(c.password ? { must_change_password: true } : {}),
    };
    const admins = [...this.staffById.values()].filter((x) => x.id !== id && x.role === "administrator" && !x.disabled);
    if (s.role === "administrator" && (next.role !== "administrator" || next.disabled) && admins.length === 0)
      throw new DataSourceError("the operator needs at least one administrator who can sign in", { status: 409 });
    this.staffById.set(id, next);
    return next;
  }
}
