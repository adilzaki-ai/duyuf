import { t } from "../i18n";

/**
 * Who to ask to cover each gap: the platform's rule is
 * backend/api/duyuf/dispatch/planner.py. Both sides run the cases in
 * sample/dispatch_cases.json (dispatch.test.ts here). The sample mode uses
 * this to plan; against the platform, the platform plans.
 *
 * - A person can cover a gap when they are active, have the role (an
 *   interpreter must speak the language), work at that airport, are not
 *   already asked for or working an overlapping time, and stay within their
 *   weekly hours.
 * - The fewest hours this week go first, then by name. Exactly as many as are
 *   short are asked; gaps are filled soonest first.
 */
export const MODES = ["off", "approve", "auto"] as const;
export type DispatchMode = (typeof MODES)[number];
export const ROLES = ["interpreter", "wheelchair", "bus"] as const;
export type Role = (typeof ROLES)[number];
export const REQUEST_STATUSES = ["asked", "accepted", "declined", "expired", "cancelled", "arrived"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const HOLDING: readonly RequestStatus[] = ["asked", "accepted", "arrived"];
export const CONFIRMED: readonly RequestStatus[] = ["accepted", "arrived"];

export interface PlanWorker {
  id: string;
  name: string;
  roles: readonly string[];
  languages: readonly string[];
  airports: readonly string[];
  max_hours_week: number;
  active: boolean;
}

export interface PlanGap {
  airport: string;
  kind: Role;
  language: string | null;
  start: string;
  end: string;
  short: number;
  shift_id?: string | null;
  exclude?: readonly string[];
}

export interface PlanItem extends PlanGap {
  ask: string[];
  missing: number;
}

const hoursOf = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / 3_600_000;

export function canCover(w: PlanWorker, g: PlanGap, busy: Record<string, [string, string][]>, hours: Record<string, number>): boolean {
  if (!w.active || !w.roles.includes(g.kind)) return false;
  if (g.kind === "interpreter" && !w.languages.includes(g.language ?? "")) return false;
  if (!w.airports.includes(g.airport)) return false;
  const s = Date.parse(g.start);
  const e = Date.parse(g.end);
  if ((busy[w.id] ?? []).some(([a, b]) => Date.parse(a) < e && s < Date.parse(b))) return false;
  return (hours[w.id] ?? 0) + hoursOf(g.start, g.end) <= w.max_hours_week;
}

export function plan(gaps: readonly PlanGap[], workers: readonly PlanWorker[], busy0: Record<string, [string, string][]> = {}, hours0: Record<string, number> = {}): PlanItem[] {
  const busy: Record<string, [string, string][]> = Object.fromEntries(Object.entries(busy0).map(([k, v]) => [k, [...v]]));
  const hours = { ...hours0 };
  const key = (g: PlanGap) => [new Date(g.start).toISOString(), g.airport, g.kind, g.language ?? ""];
  const sorted = [...gaps].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  });
  return sorted.map((g) => {
    const skip = new Set(g.exclude ?? []);
    const fit = workers
      .filter((w) => !skip.has(w.id) && canCover(w, g, busy, hours))
      .sort((a, b) => (hours[a.id] ?? 0) - (hours[b.id] ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const picks = fit.slice(0, g.short);
    for (const w of picks) {
      (busy[w.id] ??= []).push([g.start, g.end]);
      hours[w.id] = (hours[w.id] ?? 0) + hoursOf(g.start, g.end);
    }
    return {
      airport: g.airport,
      kind: g.kind,
      language: g.language,
      start: g.start,
      end: g.end,
      short: g.short,
      shift_id: g.shift_id ?? null,
      ask: picks.map((w) => w.id),
      missing: g.short - picks.length,
    };
  });
}

const STATUS_EN: Record<RequestStatus, string> = {
  asked: "Waiting for an answer",
  accepted: "Accepted",
  declined: "Declined",
  expired: "No answer",
  cancelled: "Cancelled",
  arrived: "At the airport",
};
export const requestStatusLabel = (s: RequestStatus) => t(STATUS_EN[s]);

const MODE_EN: Record<DispatchMode, string> = { off: "Off", approve: "Approve first", auto: "Automatic" };
export const modeLabel = (m: DispatchMode) => t(MODE_EN[m]);

const ROLE_EN: Record<Role, string> = { interpreter: "Interpreter", wheelchair: "Wheelchair helper", bus: "Bus driver" };
export const roleLabel = (r: Role) => t(ROLE_EN[r]);

/** Every English line this file passes to t(), for the Arabic coverage test. */
export const DISPATCH_LABELS_EN = [...Object.values(STATUS_EN), ...Object.values(MODE_EN), ...Object.values(ROLE_EN)];
