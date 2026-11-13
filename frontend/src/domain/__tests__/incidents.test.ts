import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INCIDENT_KINDS, INCIDENT_MOVES, INCIDENT_STATUSES, incidentRefusal, PRIORITIES } from "../incidents";

/* The platform's table, read from its own source, so the two cannot drift. */
const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/incidents/flow.py"), "utf8");
const tuple = (name: string) => [...(new RegExp(`^${name} = \\(([^)]*)\\)`, "m").exec(py)![1].matchAll(/"(\w+)"/g))].map((m) => m[1]);

describe("an incident's journey", () => {
  it("has the platform's statuses, kinds and priorities", () => {
    expect([...INCIDENT_STATUSES]).toEqual(tuple("STATUSES"));
    expect([...INCIDENT_KINDS]).toEqual(tuple("KINDS"));
    expect([...PRIORITIES]).toEqual(tuple("PRIORITIES"));
  });

  it("allows the platform's moves exactly", () => {
    const block = py.slice(py.indexOf("MOVES:"), py.indexOf("\n}", py.indexOf("MOVES:")));
    const moves: Record<string, { from: string[]; to: string }> = {};
    for (const m of block.matchAll(/"(\w+)": \(\(([^)]*)\), "(\w+)"\)/g))
      moves[m[1]] = { from: [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1]), to: m[3] };
    expect(Object.keys(moves).sort()).toEqual(Object.keys(INCIDENT_MOVES).sort());
    for (const [a, mv] of Object.entries(INCIDENT_MOVES)) expect({ from: [...mv.from], to: mv.to }).toEqual(moves[a]);
    expect(incidentRefusal("resolved", "assign")).toBe("cannot assign an incident that is resolved");
  });
});
