import { ksaDate, ksaIso } from "../lib/dates";
import type { Status } from "./journey";
import type { Brief, Flight, FlightState, LanguageNeed, Need, Wave } from "./types";

/**
 * What a flight's pilgrims will need on the ground.
 *
 * The platform's own rules are backend/api/duyuf/arrivals/brief.py; this copy
 * exists so the sample mode counts what the platform counts. brief.test.ts
 * reads the Python file and fails if the numbers ever differ.
 */
export const BUS_SEATS = 49;
export const INTERPRETER_EVERY = 40;
export const OLDER_AGE = 75;
export const STAFF_LANGUAGES: readonly string[] = ["ar", "en"];
export const SLOT_HOURS = 3;

export interface BriefPilgrim {
  status: Status;
  needs: readonly Need[];
  date_of_birth: string | null;
  language: string | null;
}

/** Whole years from `born` to `day`, both YYYY-MM-DD. */
export function ageOn(born: string, day: string): number {
  const [by, bm, bd] = born.split("-").map(Number);
  const [y, m, d] = day.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Totals for the pilgrims on one flight landing on `on` (the Saudi date, YYYY-MM-DD). */
export function brief(people: readonly BriefPilgrim[], on: string): Brief {
  const needs = (n: Need) => people.filter((p) => p.needs.includes(n)).length;
  const known = people.filter((p) => p.date_of_birth);
  const counts = new Map<string | null, number>();
  for (const p of people) counts.set(p.language, (counts.get(p.language) ?? 0) + 1);
  /* most speakers first; ties by code; not recorded last — the platform's order */
  const key = (l: string | null) => l ?? "~";
  const languages: LanguageNeed[] = [...counts]
    .sort((a, b) => b[1] - a[1] || (key(a[0]) < key(b[0]) ? -1 : key(a[0]) > key(b[0]) ? 1 : 0))
    .map(([language, n]) => ({
      language,
      pilgrims: n,
      interpreters: language && !STAFF_LANGUAGES.includes(language) ? Math.ceil(n / INTERPRETER_EVERY) : 0,
    }));
  return {
    pilgrims: people.length,
    over_75: known.filter((p) => ageOn(p.date_of_birth!, on) >= OLDER_AGE).length,
    unknown_age: people.length - known.length,
    wheelchair: needs("wheelchair"),
    medical: needs("medical"),
    dietary: needs("dietary"),
    minor_alone: needs("unaccompanied_minor"),
    no_visa: people.filter((p) => p.status === "registered").length,
    buses: Math.ceil(people.length / BUS_SEATS),
    interpreters: languages.reduce((n, l) => n + l.interpreters, 0),
    languages,
  };
}

export function flightState(expected: string, scheduled: string, landed: string | null, now: Date): FlightState {
  if (landed) return "landed";
  const e = Date.parse(expected);
  if (e <= now.getTime()) return "due";
  return e > Date.parse(scheduled) ? "delayed" : "on_time";
}

const HOUR = 3_600_000;

/** The start of the wave block `now` falls in, on the Saudi clock (UTC+3). */
export function slotStart(now: Date): Date {
  const local = new Date(now.getTime() + 3 * HOUR);
  local.setUTCMinutes(0, 0, 0);
  local.setUTCHours(local.getUTCHours() - (local.getUTCHours() % SLOT_HOURS));
  return new Date(local.getTime() - 3 * HOUR);
}

/** Pilgrims landing in each block from now to `hours` ahead, by airport. Confirmed landings are left out. */
export function waves(flights: readonly Flight[], now: Date, hours: number): Wave[] {
  const first = slotStart(now).getTime();
  const end = now.getTime() + hours * HOUR;
  const count = Math.ceil((end - first) / (SLOT_HOURS * HOUR));
  const slots: Wave[] = Array.from({ length: count }, (_, i) => ({
    start: ksaIso(new Date(first + i * SLOT_HOURS * HOUR)),
    by_airport: {},
  }));
  for (const f of flights) {
    const at = Date.parse(f.expected_at);
    if (f.landed_at || at < first || at >= end) continue;
    const by = slots[Math.floor((at - first) / (SLOT_HOURS * HOUR))].by_airport;
    by[f.arrival_airport] = (by[f.arrival_airport] ?? 0) + f.brief.pilgrims;
  }
  return slots;
}

/** The Saudi date a flight lands on, for "over 75 on the day". */
export const landingDay = (expected: string) => ksaDate(new Date(expected));

/** "sv3102" → "SV 3102"; null when it does not look like a flight number. The platform's rule. */
export function normalFlightNumber(raw: string): string | null {
  const m = /^([A-Z0-9]{2}[A-Z]?)\s*([0-9]{1,4}[A-Z]?)$/.exec(raw.trim().toUpperCase());
  return m ? `${m[1]} ${m[2]}` : null;
}
