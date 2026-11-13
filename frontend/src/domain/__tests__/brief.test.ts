import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ageOn,
  brief,
  BUS_SEATS,
  INTERPRETER_EVERY,
  normalFlightNumber,
  OLDER_AGE,
  SLOT_HOURS,
  slotStart,
  STAFF_LANGUAGES,
  waves,
  type BriefPilgrim,
} from "../brief";
import type { Flight } from "../types";

/* The platform's rules, read from its own source, so the two cannot drift. */
const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/arrivals/brief.py"), "utf8");
const constant = (name: string) => new RegExp(`^${name} = (.+?)\\s*(#.*)?$`, "m").exec(py)?.[1];

const p = (o: Partial<BriefPilgrim> = {}): BriefPilgrim => ({
  status: "visa_issued",
  needs: [],
  date_of_birth: null,
  language: "ur",
  ...o,
});

describe("the flight brief", () => {
  it("uses the platform's numbers", () => {
    expect(Number(constant("BUS_SEATS"))).toBe(BUS_SEATS);
    expect(Number(constant("INTERPRETER_EVERY"))).toBe(INTERPRETER_EVERY);
    expect(Number(constant("OLDER_AGE"))).toBe(OLDER_AGE);
    expect(Number(constant("SLOT_HOURS"))).toBe(SLOT_HOURS);
    expect(constant("STAFF_LANGUAGES")).toBe(`(${STAFF_LANGUAGES.map((l) => `"${l}"`).join(", ")})`);
  });

  it("counts what the platform's own test counts", () => {
    /* the same people as test_the_brief_counts_by_hand in backend/tests/test_arrivals.py */
    const people = [
      p({ date_of_birth: "1951-11-20" }),
      p({ date_of_birth: "1951-11-21" }),
      p({ needs: ["wheelchair", "medical"] }),
      p({ status: "registered", language: "ar" }),
      p({ language: null }),
      ...Array.from({ length: 45 }, () => p()),
    ];
    const b = brief(people, "2026-11-20");
    expect(b).toMatchObject({ pilgrims: 50, buses: 2, over_75: 1, unknown_age: 48, wheelchair: 1, medical: 1, no_visa: 1 });
    expect(b.languages).toEqual([
      { language: "ur", pilgrims: 48, interpreters: 2 },
      { language: "ar", pilgrims: 1, interpreters: 0 },
      { language: null, pilgrims: 1, interpreters: 0 },
    ]);
    expect(b.interpreters).toBe(2);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
  });

  it("starts the wave on the Saudi three-hour mark", () => {
    const now = new Date("2026-11-13T01:50:00+03:00");
    expect(slotStart(now).toISOString()).toBe(new Date("2026-11-13T00:00:00+03:00").toISOString());
    const f = (h: number, n: number, landed: string | null = null) =>
      ({
        expected_at: new Date(now.getTime() + h * 3_600_000).toISOString(),
        landed_at: landed,
        arrival_airport: "JED",
        brief: { pilgrims: n },
      }) as Flight;
    const w = waves([f(0.5, 10), f(2, 5), f(-2, 99), f(1, 7, now.toISOString())], now, 12);
    expect(w).toHaveLength(5);
    expect(w[0]).toEqual({ start: "2026-11-13T00:00:00+03:00", by_airport: { JED: 10 } });
    expect(w[1].by_airport).toEqual({ JED: 5 });
  });

  it("reads a flight number the way the platform does", () => {
    expect(normalFlightNumber(" sv3102 ")).toBe("SV 3102");
    expect(normalFlightNumber("6E 63")).toBe("6E 63");
    expect(normalFlightNumber("flight one")).toBeNull();
  });
});
