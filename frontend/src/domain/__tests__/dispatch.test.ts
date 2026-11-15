import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODES, plan, REQUEST_STATUSES, ROLES, type PlanGap, type PlanWorker } from "../dispatch";

const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/dispatch/planner.py"), "utf8");
const tuple = (name: string) => [...new RegExp(`^${name} = \\(([^)]*)\\)`, "m").exec(py)![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
const cases = JSON.parse(readFileSync(resolve(__dirname, "../../../../sample/dispatch_cases.json"), "utf8")).cases as {
  name: string;
  workers: PlanWorker[];
  busy: Record<string, [string, string][]>;
  hours: Record<string, number>;
  gaps: PlanGap[];
  expect: { kind: string; language: string | null; ask: string[]; missing: number }[];
}[];

describe("the dispatch rule", () => {
  it("has the platform's modes, roles and request states", () => {
    expect([...MODES]).toEqual(tuple("MODES"));
    expect([...ROLES]).toEqual(tuple("ROLES"));
    expect([...REQUEST_STATUSES]).toEqual(tuple("STATUSES"));
  });

  for (const c of cases)
    it(`gives the platform's answer: ${c.name}`, () => {
      const got = plan(c.gaps, c.workers, c.busy, c.hours).map(({ kind, language, ask, missing }) => ({ kind, language, ask, missing }));
      expect(got).toEqual(c.expect);
    });
});
