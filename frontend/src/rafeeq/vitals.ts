/**
 * How readings are judged: heart, temperature, water.
 *
 * The platform's rules are backend/api/duyuf/health/rules.py; vitals.test.ts
 * reads its numbers and fails if the two ever differ. Every number is
 * PROPOSED: no doctor has signed them off yet.
 */
export const RULES = {
  FEVER_C: 38.0,
  FEVER_FOR_MIN: 30,
  HIGH_FEVER_C: 39.5,
  HIGH_FEVER_FOR_MIN: 10,
  RAISED_C: 37.5,
  HEART_HIGH: 120,
  HEART_HIGH_FOR_MIN: 10,
  HEART_DANGER_HIGH: 150,
  HEART_DANGER_LOW: 40,
  HEART_DANGER_FOR_MIN: 5,
  HEART_SWING: 40,
  HEART_SWINGS: 3,
  HEART_SWING_WINDOW_MIN: 15,
  STRAIN_HEART: 110,
  STRAIN_C: 37.8,
  STRAIN_FOR_MIN: 10,
  WATER_RISK_MIN: 90,
  WATER_DUE_MIN: 120,
  HEART_STALE_MIN: 15,
  TEMP_STALE_MIN: 30,
  WINDOW_MIN: 90,
  COUNTDOWN_S: 30,
  QUIET_AFTER_OK_MIN: 10,
} as const;

export const DANGER = ["heart_danger_high", "heart_danger_low", "high_fever", "fever_and_heart"] as const;
export const WARNING = ["fever", "heart_high", "heart_unstable", "dehydration_risk", "heat_exhaustion"] as const;
export const WATCH = ["temperature_raised", "heat_stress", "water_due"] as const;
export type Reason = (typeof DANGER)[number] | (typeof WARNING)[number] | (typeof WATCH)[number];

export type Level = "danger" | "warning" | "watch" | "ok" | "unknown";
export type HeartState = "unknown" | "ok" | "high" | "unstable" | "danger_high" | "danger_low";
export type TempState = "unknown" | "ok" | "raised" | "fever" | "high_fever";
export type Hydration = "ok" | "due" | "risk";
/** judged from the body: there is no weather feed yet */
export type Heat = "unknown" | "ok" | "stress" | "exhaustion" | "stroke_risk";

export interface Assessment {
  level: Level;
  reasons: Reason[];
  heart: { state: HeartState; bpm: number | null; at: string | null };
  temperature: { state: TempState; c: number | null; at: string | null };
  hydration: Hydration;
  heat: Heat;
  water_at: string | null;
  /** some of the last day's readings were the demonstration's */
  simulated?: boolean;
}

/** at (ISO), heart rate, temperature */
export type Reading = [string, number | null, number | null];

const MIN = 60_000;

function held(points: [number, number][], test: (v: number) => boolean, minutes: number): boolean {
  const run: number[] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    if (!test(points[i][1])) break;
    run.push(points[i][0]);
  }
  return run.length > 0 && run[0] - run[run.length - 1] >= minutes * MIN;
}

export function assess(readings: Reading[], waterAt: string | null, now: Date): Assessment {
  const t = now.getTime();
  const rows = readings
    .map(([at, h, c]) => [Date.parse(at), h, c] as const)
    .filter(([at]) => at >= t - RULES.WINDOW_MIN * MIN)
    .sort((a, b) => a[0] - b[0]);
  const hr = rows.filter((r) => r[1] != null).map((r) => [r[0], r[1]!] as [number, number]);
  const tc = rows.filter((r) => r[2] != null).map((r) => [r[0], r[2]!] as [number, number]);
  const iso = (ms: number) => new Date(ms).toISOString();

  const heart: Assessment["heart"] = { state: "unknown", bpm: null, at: null };
  if (hr.length && hr[hr.length - 1][0] >= t - RULES.HEART_STALE_MIN * MIN) {
    const [at, bpm] = hr[hr.length - 1];
    heart.bpm = Math.round(bpm);
    heart.at = iso(at);
    const recent = hr.filter(([a]) => a >= t - RULES.HEART_SWING_WINDOW_MIN * MIN).map(([, v]) => v);
    const swings = recent.slice(1).filter((v, i) => Math.abs(v - recent[i]) >= RULES.HEART_SWING).length;
    heart.state = held(hr, (v) => v >= RULES.HEART_DANGER_HIGH, RULES.HEART_DANGER_FOR_MIN)
      ? "danger_high"
      : held(hr, (v) => v <= RULES.HEART_DANGER_LOW, RULES.HEART_DANGER_FOR_MIN)
        ? "danger_low"
        : swings >= RULES.HEART_SWINGS
          ? "unstable"
          : held(hr, (v) => v >= RULES.HEART_HIGH, RULES.HEART_HIGH_FOR_MIN)
            ? "high"
            : "ok";
  }

  const temperature: Assessment["temperature"] = { state: "unknown", c: null, at: null };
  if (tc.length && tc[tc.length - 1][0] >= t - RULES.TEMP_STALE_MIN * MIN) {
    const [at, c] = tc[tc.length - 1];
    temperature.c = c;
    temperature.at = iso(at);
    temperature.state = held(tc, (v) => v >= RULES.HIGH_FEVER_C, RULES.HIGH_FEVER_FOR_MIN)
      ? "high_fever"
      : held(tc, (v) => v >= RULES.FEVER_C, RULES.FEVER_FOR_MIN)
        ? "fever"
        : c >= RULES.RAISED_C
          ? "raised"
          : "ok";
  }

  const sinceWater = waterAt ? t - Date.parse(waterAt) : null;
  const heartStrained = held(hr, (v) => v >= RULES.STRAIN_HEART, RULES.STRAIN_FOR_MIN);
  const bodyStrained = held(tc, (v) => v >= RULES.STRAIN_C, RULES.STRAIN_FOR_MIN);
  const strained = heartStrained || bodyStrained;
  const hydration: Hydration =
    strained && (sinceWater == null || sinceWater >= RULES.WATER_RISK_MIN * MIN)
      ? "risk"
      : sinceWater == null || sinceWater >= RULES.WATER_DUE_MIN * MIN
        ? "due"
        : "ok";

  const fevered = temperature.state === "fever" || temperature.state === "high_fever";
  const heat: Heat =
    temperature.state === "high_fever" || (fevered && (heart.state === "high" || heart.state === "unstable"))
      ? "stroke_risk"
      : heartStrained && bodyStrained
        ? "exhaustion"
        : strained
          ? "stress"
          : heart.state !== "unknown" || temperature.state !== "unknown"
            ? "ok"
            : "unknown";
  const reasons: Reason[] = [];
  if (heart.state === "danger_high") reasons.push("heart_danger_high");
  if (heart.state === "danger_low") reasons.push("heart_danger_low");
  if (temperature.state === "high_fever") reasons.push("high_fever");
  if (fevered && (heart.state === "high" || heart.state === "unstable")) reasons.push("fever_and_heart");
  if (fevered) reasons.push("fever");
  if (heart.state === "high") reasons.push("heart_high");
  if (heart.state === "unstable") reasons.push("heart_unstable");
  if (hydration === "risk") reasons.push("dehydration_risk");
  if (heat === "exhaustion") reasons.push("heat_exhaustion");
  if (temperature.state === "raised") reasons.push("temperature_raised");
  if (heat === "stress") reasons.push("heat_stress");
  if (hydration === "due") reasons.push("water_due");

  const has = (list: readonly string[]) => reasons.some((r) => list.includes(r));
  const level: Level = has(DANGER)
    ? "danger"
    : has(WARNING)
      ? "warning"
      : reasons.length
        ? "watch"
        : heart.state !== "unknown" || temperature.state !== "unknown"
          ? "ok"
          : "unknown";
  return { level, reasons, heart, temperature, hydration, heat, water_at: waterAt };
}

/** Readings over the last `minutes`, one every `every` minutes, for the demonstration's buttons. */
export function series(minutes: number, every: number, heart: number | null, temp: number | null, now = new Date()) {
  const out: { at: string; heart_rate?: number; temperature?: number }[] = [];
  for (let m = minutes; m >= 0; m -= every) {
    const wobble = (m % 3) - 1;
    out.push({
      at: new Date(now.getTime() - m * MIN).toISOString(),
      ...(heart != null ? { heart_rate: heart + wobble * 2 } : {}),
      ...(temp != null ? { temperature: Math.round((temp + wobble * 0.1) * 10) / 10 } : {}),
    });
  }
  return out;
}
