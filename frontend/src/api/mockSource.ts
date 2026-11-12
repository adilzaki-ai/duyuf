import sample from "../../../sample/demo.json";
import { MOVES, refusal, STATUSES, type Status } from "../domain/journey";
import type {
  Group,
  JourneyStep,
  Me,
  MovingGroup,
  Need,
  Overview,
  Pilgrim,
  PilgrimDetail,
  PilgrimFilter,
  Scope,
} from "../domain/types";
import { addDays, ksaDate, KSA_TZ } from "../lib/dates";
import { DataSourceError, type DataSource } from "./dataSource";

/**
 * The sample, with no backend: sample/demo.json, the same file
 * backend/scripts/seed_demo.py loads into the demo operator. Day offsets are
 * resolved against today, so a group always lands this week. Changes made
 * here live until the page is reloaded.
 */

interface SampleStep {
  from: Status | null;
  to: Status;
  day: number;
  hour: number;
}

const WINDOW_DAYS = 7;
const ALL_SCOPES: Scope[] = [
  "group:read",
  "group:write",
  "pilgrim:read",
  "pilgrim:write",
  "pilgrim:status",
  "pilgrim:identity",
];

/** A day offset and an hour as an instant, read on the Saudi clock (UTC+3, no daylight saving). */
function at(today: string, day: number, hour: number): string {
  return `${addDays(today, day)}T${String(hour).padStart(2, "0")}:00:00+03:00`;
}

export class MockSource implements DataSource {
  readonly kind = "mock" as const;
  private readonly today: string;
  private readonly groupsById = new Map<string, Omit<Group, "pilgrims" | "by_status">>();
  private readonly people = new Map<string, PilgrimDetail>();

  constructor(now: Date = new Date()) {
    this.today = ksaDate(now);
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
        status,
        needs: p.needs as Need[],
        updated_at: history[history.length - 1].at,
        allowed: [...MOVES[status]],
        history,
      });
    });
  }

  async me(): Promise<Me> {
    const op = sample.operator;
    return {
      tenant: { id: "sample", slug: op.slug, name: op.name, name_ar: op.name_ar, is_demo: true },
      principal: { id: null, name: "Sample viewer", role: "administrator" },
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

  async movePilgrim(id: string, to: Status, note?: string): Promise<PilgrimDetail> {
    const p = this.people.get(id);
    if (!p) throw new DataSourceError("no such pilgrim", { status: 404 });
    const why = refusal(p.status, to);
    if (why) throw new DataSourceError(why, { status: 409 });
    const now = new Date().toLocaleString("sv-SE", { timeZone: KSA_TZ }).replace(" ", "T") + "+03:00";
    const next: PilgrimDetail = {
      ...p,
      status: to,
      allowed: [...MOVES[to]],
      updated_at: now,
      history: [...p.history, { from_status: p.status, to_status: to, note: note ?? null, actor: "Sample viewer", at: now }],
    };
    this.people.set(id, next);
    return { ...next };
  }
}
