import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AIRPORT_NAMES_EN } from "../../domain/airports";
import { INCIDENT_LABELS_EN } from "../../domain/incidents";
import { ANALYST_LABELS_EN } from "../../features/analyst/AnalystPage";
import { AR } from "../ar";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" ? [] : sources(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("Arabic", () => {
  it("has every string the screens pass to t()", () => {
    const missing = new Set<string>();
    for (const file of sources(resolve(__dirname, "../.."))) {
      for (const m of readFileSync(file, "utf8").matchAll(/\bt\(\s*"([^"]+)"/g)) if (!(m[1] in AR)) missing.add(m[1]);
    }
    /* labels.ts and the overview pass English through a table; check those too */
    for (const en of ["Registered", "Visa issued", "In Makkah", "Wheelchair", "Minor alone", "Hajj", "Umrah", "Groups"])
      if (!(en in AR)) missing.add(en);
    /* and the arrivals board's tables: its nav entry, windows and airports */
    for (const en of ["Arrivals", "48 hours", "7 days", ...AIRPORT_NAMES_EN]) if (!(en in AR)) missing.add(en);
    /* incidents: kinds, priorities, states, the nav entry and the filter tabs */
    for (const en of [...INCIDENT_LABELS_EN, "Incidents", "Not resolved", "All"]) if (!(en in AR)) missing.add(en);
    for (const en of [...ANALYST_LABELS_EN, "Analyst"]) if (!(en in AR)) missing.add(en);
    expect([...missing]).toEqual([]);
  });
});
