import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_EN } from "../guide/en";
import { GUIDE_AR } from "../guide/ar";
import { GUIDE_FR } from "../guide/fr";
import { GUIDE_ID } from "../guide/id";
import { GUIDE_TR } from "../guide/tr";
import { GUIDE_UR } from "../guide/ur";
import { TRIP_SITES } from "../guide/sites";
import { makePlan, suggested, travel } from "../planner";
import { visaState } from "../visaDays";
import * as W from "../weatherRules";

const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/weather/rules.py"), "utf8");
const num = (name: string) => Number(new RegExp(`^${name} = (\\d+)`, "m").exec(py)![1]);
const bands = (name: string) => [...new RegExp(`^${name} = \\((.*)\\)$`, "m").exec(py)![1].matchAll(/\("(\w+)", (\d+)\)/g)].map((m) => [m[1], Number(m[2])]);

describe("the weather rules", () => {
  it("are the platform's exactly", () => {
    expect(W.HEAT_BANDS.map((x) => [...x])).toEqual(bands("HEAT_BANDS"));
    expect(W.UV_BANDS.map((x) => [...x])).toEqual(bands("UV_BANDS"));
    for (const k of ["GOOD_FEELS_BELOW", "GOOD_UV_BELOW", "DAY_FROM_HOUR", "DAY_TO_HOUR", "REFRESH_MIN", "STALE_MIN"] as const)
      expect(W[k], k).toBe(num(k));
  });

  it("find the cool runs of the day as the platform does", () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ at: `2026-11-14T${String(h).padStart(2, "0")}:00`, feels: h >= 9 && h < 17 ? 36 : 28, uv: 0 }));
    expect(W.goodWindows(hours)).toEqual([
      { from: "05:00", to: "09:00" },
      { from: "17:00", to: "23:00" },
    ]);
    expect([20, 27, 32, 40, 52].map(W.heatBand)).toEqual(["comfortable", "caution", "extreme_caution", "danger", "extreme_danger"]);
  });

  it("give the sample a whole report for both cities", () => {
    const r = W.sampleWeather(new Date("2026-11-14T06:30:00Z"));
    expect(r.sample).toBe(true);
    for (const c of ["makkah", "madinah"] as const) {
      expect(r.cities[c].hours[0].at).toBe("2026-11-14T09:00");
      expect(r.cities[c].days).toHaveLength(4);
      expect(r.cities[c].days[0].good.length).toBeGreaterThan(0);
    }
    /* Madinah in November is cooler than Makkah */
    expect(r.cities.madinah.days[0].max!).toBeLessThan(r.cities.makkah.days[0].max!);
  });
});

describe("the guide", () => {
  it("covers every site in all six languages, item for item", () => {
    for (const [lang, g] of Object.entries({ ar: GUIDE_AR, id: GUIDE_ID, ur: GUIDE_UR, tr: GUIDE_TR, fr: GUIDE_FR, en: GUIDE_EN })) {
      expect(Object.keys(g), lang).toEqual(TRIP_SITES.map((s) => s.id));
      for (const s of TRIP_SITES) {
        const t = g[s.id];
        for (const k of ["name", "summary", "story"] as const) expect(t[k]?.trim(), `${s.id}.${k} in ${lang}`).toBeTruthy();
        expect(t.see.length, `${s.id}.see in ${lang}`).toBe(GUIDE_EN[s.id].see.length);
        expect(t.tips.length, `${s.id}.tips in ${lang}`).toBe(GUIDE_EN[s.id].tips.length);
      }
    }
  });

  it("places every site in its own city", () => {
    for (const s of TRIP_SITES) {
      const box = s.city === "makkah" ? [21.2, 21.6, 39.6, 40.1] : [24.3, 24.7, 39.4, 39.8];
      expect(s.lat >= box[0] && s.lat <= box[1] && s.lon >= box[2] && s.lon <= box[3], s.id).toBe(true);
    }
  });
});

describe("the planner", () => {
  it("walks short hops and drives long ones", () => {
    const nabawi = TRIP_SITES.find((s) => s.id === "nabawi")!;
    expect(travel(nabawi, TRIP_SITES.find((s) => s.id === "ghamamah")!).mode).toBe("walk");
    const uhud = travel(nabawi, TRIP_SITES.find((s) => s.id === "uhud")!);
    expect(uhud.mode).toBe("car");
    expect(uhud.min).toBeGreaterThanOrEqual(15);
  });

  it("plans every pick once, in time order, and keeps outdoor places out of the hot hours when it can", () => {
    const picks = suggested("madinah");
    const stops = makePlan(picks, "madinah", { days: 1, start: "06:30" });
    expect(stops.map((s) => s.id).sort()).toEqual([...picks].sort());
    const times = stops.map((s) => s.arrive);
    expect(times).toEqual([...times].sort());
    /* Uhud is outdoors: early, before 10:00 */
    expect(stops.find((s) => s.id === "uhud")!.arrive < "10:00").toBe(true);
    expect(stops[0].arrive >= "06:30").toBe(true);
  });

  it("splits a long list over two days", () => {
    const all = TRIP_SITES.filter((s) => s.city === "makkah").map((s) => s.id);
    const stops = makePlan(all, "makkah", { days: 2, start: "06:30" });
    expect(new Set(stops.map((s) => s.day))).toEqual(new Set([1, 2]));
    expect(stops).toHaveLength(all.length);
  });

  it("ignores places in the other city", () => {
    expect(makePlan(["quba", "hira"], "makkah", { days: 1, start: "08:00" }).map((s) => s.id)).toEqual(["hira"]);
  });
});

describe("the visa window", () => {
  it("counts the days in Saudi time and says how urgent", () => {
    expect(visaState(null, null, "2026-11-14")).toEqual({ level: "none", days: null, leavesAfter: false });
    expect(visaState("2027-01-10", "2026-12-20", "2026-11-14")).toMatchObject({ level: "ok", days: 57, leavesAfter: false });
    expect(visaState("2026-11-28", null, "2026-11-14")).toMatchObject({ level: "soon", days: 14 });
    expect(visaState("2026-11-17", null, "2026-11-14")).toMatchObject({ level: "urgent", days: 3 });
    expect(visaState("2026-11-14", null, "2026-11-14")).toMatchObject({ level: "urgent", days: 0 });
    expect(visaState("2026-11-13", null, "2026-11-14")).toMatchObject({ level: "ended", days: -1 });
    expect(visaState("2026-11-20", "2026-11-22", "2026-11-14").leavesAfter).toBe(true);
  });
});
