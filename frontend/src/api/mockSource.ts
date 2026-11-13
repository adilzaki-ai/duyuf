import sample from "../../../sample/demo.json";
import { brief, flightState, landingDay, normalFlightNumber, waves } from "../domain/brief";
import { MOVES, refusal, STATUSES, type Status } from "../domain/journey";
import type {
  Arrivals,
  Assignment,
  Flight,
  FlightChange,
  FlightDetail,
  FlightEvent,
  Group,
  JourneyStep,
  Me,
  MovingGroup,
  Need,
  NewFlight,
  Overview,
  Pilgrim,
  PilgrimDetail,
  PilgrimFilter,
  Scope,
  UnplannedGroup,
} from "../domain/types";
import { addDays, ksaDate, ksaIso } from "../lib/dates";
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
  private readonly groupsById = new Map<string, Omit<Group, "pilgrims" | "by_status">>();
  private readonly people = new Map<string, PilgrimDetail>();
  private readonly flights = new Map<string, FlightRecord>();

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
      });
    }
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
  }

  private now(): string {
    return ksaIso(this.clock());
  }

  async me(): Promise<Me> {
    const op = sample.operator;
    return {
      tenant: { id: "sample", slug: op.slug, name: op.name, name_ar: op.name_ar, is_demo: true },
      principal: { id: null, name: ACTOR, role: "administrator" },
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
    const now = this.clock();
    const t = now.getTime();
    const until = t + hours * HOUR;
    const flights = [...this.flights.values()]
      .map((f) => this.view(f, now))
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
    return { now: ksaIso(now), hours, slot_hours: 3, flights, waves: waves(flights, now, hours), unplanned };
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
}
