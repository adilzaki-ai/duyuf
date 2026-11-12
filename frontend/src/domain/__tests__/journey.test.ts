import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MOVES, refusal, STATUSES } from "../journey";

/* The platform's table, read from its own source, so the two cannot drift. */
function platformMoves(): Record<string, string[]> {
  const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/pilgrims/status.py"), "utf8");
  const block = py.slice(py.indexOf("MOVES"), py.indexOf("}", py.indexOf("MOVES")));
  const out: Record<string, string[]> = {};
  for (const m of block.matchAll(/"(\w+)":\s*\(([^)]*)\)/g)) out[m[1]] = [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1]);
  return out;
}

describe("the journey", () => {
  it("matches the platform's moves exactly", () => {
    const py = platformMoves();
    expect(Object.keys(py).sort()).toEqual([...STATUSES].sort());
    for (const s of STATUSES) expect(MOVES[s]).toEqual(py[s]);
  });

  it("refuses a skipped step in the platform's words", () => {
    expect(refusal("registered", "in_makkah")).toBe("cannot go from registered to in_makkah; allowed: visa_issued");
    expect(refusal("departed", "in_makkah")).toMatch(/nothing \(the journey is over\)$/);
    expect(refusal("arrived", "in_makkah")).toBeNull();
  });
});
