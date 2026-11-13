import { ksaIso } from "../lib/dates";
import { SLOT_HOURS, slotStart } from "./brief";
import type { Brief, Flight, LoadRow, Resources, Shortfall } from "./types";

/**
 * Need against what is on shift, block by block: where the gaps are.
 *
 * The platform's rule is backend/api/duyuf/arrivals/plan.py: each flight holds
 * what its brief asks for through the block it lands in; a shift counts for a
 * block it covers whole; an interpreter covers their own language. plan.test.ts
 * runs the platform's own test case.
 */

export interface ShiftLike {
  airport: string;
  kind: "wheelchair" | "bus" | "interpreter";
  language: string | null;
  quantity: number;
  starts_at: string;
  ends_at: string;
}

export function needOf(b: Pick<Brief, "wheelchair" | "buses" | "languages">): Resources {
  const interpreter: Record<string, number> = {};
  for (const l of b.languages) if (l.interpreters && l.language) interpreter[l.language] = l.interpreters;
  return { wheelchair: b.wheelchair, bus: b.buses, interpreter };
}

const empty = (): Resources => ({ wheelchair: 0, bus: 0, interpreter: {} });

function add(into: Resources, more: Resources) {
  into.wheelchair += more.wheelchair;
  into.bus += more.bus;
  for (const [l, n] of Object.entries(more.interpreter)) into.interpreter[l] = (into.interpreter[l] ?? 0) + n;
}

/** What is at `airport` for the whole of [start, end). */
export function onShift(shifts: readonly ShiftLike[], airport: string, start: number, end: number): Resources {
  const have = empty();
  for (const s of shifts) {
    if (s.airport !== airport || Date.parse(s.starts_at) > start || Date.parse(s.ends_at) < end) continue;
    if (s.kind === "interpreter") have.interpreter[s.language!] = (have.interpreter[s.language!] ?? 0) + s.quantity;
    else have[s.kind] += s.quantity;
  }
  return have;
}

export function shortOf(need: Resources, have: Resources): Shortfall[] {
  const out: Shortfall[] = [];
  for (const kind of ["wheelchair", "bus"] as const)
    if (need[kind] > have[kind]) out.push({ kind, language: null, short: need[kind] - have[kind] });
  for (const [lang, n] of Object.entries(need.interpreter).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    if (n > (have.interpreter[lang] ?? 0))
      out.push({ kind: "interpreter", language: lang, short: n - (have.interpreter[lang] ?? 0) });
  return out;
}

const BLOCK = SLOT_HOURS * 3_600_000;

/** The start of the block a time falls in, counting from the block `now` is in. */
export function blockOf(at: number, now: Date): number {
  const first = slotStart(now).getTime();
  return first + Math.floor((at - first) / BLOCK) * BLOCK;
}

/** One row for each airport and block with a flight landing in it, soonest first. */
export function load(
  flights: readonly Pick<Flight, "number" | "expected_at" | "landed_at" | "arrival_airport" | "brief">[],
  shifts: readonly ShiftLike[],
  now: Date,
  hours: number,
): LoadRow[] {
  const first = slotStart(now).getTime();
  const end = now.getTime() + hours * 3_600_000;
  const rows = new Map<string, LoadRow & { t: number }>();
  for (const f of flights) {
    const at = Date.parse(f.expected_at);
    if (f.landed_at || at < first || at >= end) continue;
    const t = blockOf(at, now);
    const key = `${t}|${f.arrival_airport}`;
    let row = rows.get(key);
    if (!row) {
      row = { t, airport: f.arrival_airport, start: ksaIso(new Date(t)), flights: [], need: empty(), have: empty(), short: [] };
      rows.set(key, row);
    }
    row.flights.push(f.number);
    add(row.need, needOf(f.brief));
  }
  return [...rows.values()]
    .sort((a, b) => a.t - b.t || (a.airport < b.airport ? -1 : 1))
    .map(({ t, ...row }) => {
      const have = onShift(shifts, row.airport, t, t + BLOCK);
      return { ...row, have, short: shortOf(row.need, have) };
    });
}
