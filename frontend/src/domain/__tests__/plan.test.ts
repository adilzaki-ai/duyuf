import { describe, expect, it } from "vitest";
import { load, type ShiftLike } from "../plan";
import type { Brief } from "../types";

const brief = (wheelchair: number, langs: [string, number][] = []): Brief =>
  ({
    wheelchair,
    buses: 1,
    languages: langs.map(([language, n]) => ({ language, pilgrims: 40 * n, interpreters: n })),
  }) as Brief;

describe("need against shift", () => {
  /* the same case as test_need_against_shift_block_by_block in backend/tests/test_resources.py */
  it("adds flights in a block, counts shifts covering it whole, and matches interpreters by language", () => {
    const now = new Date("2026-11-13T10:00:00+03:00");
    const h = (x: number) => new Date(now.getTime() + x * 3_600_000).toISOString();
    const f = (number: string, x: number, airport: string, b: Brief, landed: string | null = null) => ({
      number,
      expected_at: h(x),
      landed_at: landed,
      arrival_airport: airport,
      brief: b,
    });
    const flights = [
      f("A 1", 0.5, "JED", brief(3, [["ur", 1]])),
      f("A 2", 1.5, "JED", brief(2, [["ur", 1], ["id", 2]])),
      f("A 3", 4, "JED", brief(1)),
      f("A 4", 0.2, "MED", brief(9), now.toISOString()),
    ];
    const shift = (kind: ShiftLike["kind"], quantity: number, language: string | null = null, start = -1, end = 5) => ({
      airport: "JED",
      kind,
      language,
      quantity,
      starts_at: h(start),
      ends_at: h(end),
    });
    const rows = load(
      flights,
      [shift("wheelchair", 4), shift("bus", 2), shift("interpreter", 2, "ur"), shift("wheelchair", 5, null, 0)],
      now,
      12,
    );
    expect(rows.map((r) => [r.start, r.airport, r.flights])).toEqual([
      ["2026-11-13T09:00:00+03:00", "JED", ["A 1", "A 2"]],
      ["2026-11-13T12:00:00+03:00", "JED", ["A 3"]],
    ]);
    expect(rows[0].need).toEqual({ wheelchair: 5, bus: 2, interpreter: { ur: 2, id: 2 } });
    expect(rows[0].have).toEqual({ wheelchair: 4, bus: 2, interpreter: { ur: 2 } });
    expect(rows[0].short).toEqual([
      { kind: "wheelchair", language: null, short: 1 },
      { kind: "interpreter", language: "id", short: 2 },
    ]);
    expect(rows[1].have.wheelchair).toBe(9);
    expect(rows[1].short).toEqual([]);
  });
});
