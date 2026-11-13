import { t } from "../i18n";
import type { Heat, HeartState, Hydration, Level, Reason, TempState } from "../rafeeq/vitals";

/** Staff words for what the health rules (rafeeq/vitals.ts) decide. */
const LEVEL_EN: Record<Level, string> = {
  danger: "Danger",
  warning: "Warning",
  watch: "Watch",
  ok: "Normal",
  unknown: "No readings",
};
const REASON_EN: Record<Reason, string> = {
  heart_danger_high: "Heart very fast",
  heart_danger_low: "Heart very slow",
  high_fever: "High fever",
  fever_and_heart: "Fever with a fast heart",
  fever: "Fever",
  heart_high: "Fast heart",
  heart_unstable: "Unsteady heart",
  dehydration_risk: "Dehydration risk",
  heat_exhaustion: "Heat exhaustion signs",
  temperature_raised: "Temperature a little high",
  heat_stress: "Heat stress",
  water_due: "Has not drunk lately",
};
const HEART_EN: Record<HeartState, string> = {
  unknown: "No reading",
  ok: "Normal",
  high: "Fast",
  unstable: "Unsteady",
  danger_high: "Very fast",
  danger_low: "Very slow",
};
const TEMP_EN: Record<TempState, string> = {
  unknown: "No reading",
  ok: "Normal",
  raised: "A little high",
  fever: "Fever",
  high_fever: "High fever",
};
const WATER_EN: Record<Hydration, string> = { ok: "Drank recently", due: "Time to drink", risk: "Dehydration risk" };
const HEAT_EN: Record<Heat, string> = {
  unknown: "No reading",
  ok: "Normal",
  stress: "Heat stress",
  exhaustion: "Heat exhaustion signs",
  stroke_risk: "Heat stroke risk",
};

export const levelLabel = (l: Level) => t(LEVEL_EN[l]);
export const reasonLabel = (r: Reason) => t(REASON_EN[r]);
export const heartLabel = (h: HeartState) => t(HEART_EN[h]);
export const tempLabel = (s: TempState) => t(TEMP_EN[s]);
export const waterLabel = (h: Hydration) => t(WATER_EN[h]);
export const heatLabel = (h: Heat) => t(HEAT_EN[h]);

/** The English the tables above pass to t(), for the Arabic coverage test. */
export const HEALTH_LABELS_EN = [
  ...Object.values(LEVEL_EN),
  ...Object.values(REASON_EN),
  ...Object.values(HEART_EN),
  ...Object.values(TEMP_EN),
  ...Object.values(WATER_EN),
  ...Object.values(HEAT_EN),
];
