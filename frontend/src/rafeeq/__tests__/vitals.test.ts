import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assess, DANGER, RULES, WARNING, WATCH, type Reading } from "../vitals";

/* The platform's rules, read from its own source, so the two cannot drift. */
const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/health/rules.py"), "utf8");
const NOW = new Date("2026-11-14T12:00:00Z");
const ago = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const series = (minutes: number, every: number, hr: number | null, temp: number | null): Reading[] => {
  const out: Reading[] = [];
  for (let m = minutes; m >= 0; m -= every) out.push([ago(m), hr, temp]);
  return out;
};

describe("the health rules", () => {
  it("use the platform's numbers exactly", () => {
    for (const [name, value] of Object.entries(RULES)) {
      const m = new RegExp(`^${name} = ([\\d.]+)`, "m").exec(py);
      expect(m, name).not.toBeNull();
      expect(Number(m![1]), name).toBe(value);
    }
    const tuple = (name: string) => [...new RegExp(`^${name} = \\(([^)]*)\\)`, "m").exec(py)![1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
    expect(tuple("DANGER")).toEqual([...DANGER]);
    expect(tuple("WARNING")).toEqual([...WARNING]);
    expect(tuple("WATCH")).toEqual([...WATCH]);
  });

  it("judge the same cases as the platform's tests", () => {
    expect(assess([...series(20, 5, null, 36.8), [ago(0), null, 38.6]], ago(0), NOW).temperature.state).toBe("raised");
    expect(assess(series(30, 5, null, 38.4), ago(0), NOW).level).toBe("warning");
    expect(assess(series(10, 5, null, 39.8), ago(0), NOW).level).toBe("danger");
    expect(assess(series(10, 5, 125, null), ago(0), NOW).heart.state).toBe("high");
    expect(assess(series(5, 1, 158, null), ago(0), NOW).reasons[0]).toBe("heart_danger_high");
    expect(assess(series(5, 1, 36, null), ago(0), NOW).reasons[0]).toBe("heart_danger_low");
    const jumpy: Reading[] = Array.from({ length: 11 }, (_, i) => [ago(10 - i), (10 - i) % 2 ? 70 : 125, null]);
    expect(assess(jumpy, ago(0), NOW).heart.state).toBe("unstable");
    const both = assess(series(30, 5, 128, 38.5), ago(0), NOW);
    expect([both.level, ...both.reasons.slice(0, 2)]).toEqual(["danger", "fever_and_heart", "fever"]);
    expect(assess(series(30, 5, 80, 36.9), ago(150), NOW).hydration).toBe("due");
    expect(assess(series(30, 5, 115, 37.9), ago(100), NOW).hydration).toBe("risk");
    expect(assess([[ago(40), 160, 39.9]], ago(0), NOW).level).toBe("unknown");
    expect(assess(series(15, 5, 114, 37.0), ago(0), NOW).heat).toBe("stress");
    expect(assess(series(15, 5, 114, 37.9), ago(0), NOW).heat).toBe("exhaustion");
    expect(assess(series(15, 5, null, 39.7), ago(0), NOW).heat).toBe("stroke_risk");
  });
});
