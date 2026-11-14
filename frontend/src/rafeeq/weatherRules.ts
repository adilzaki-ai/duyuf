/**
 * The weather report's rules, as the platform has them in
 * backend/api/duyuf/weather/rules.py (weatherRules.test.ts reads that file, so
 * change both). The platform does the work for real pages; these copies let
 * the sample build the same report with no network, and let the page turn
 * the bands into advice.
 *
 * Heat bands: US National Weather Service heat-index categories on the
 * "feels like" temperature. UV bands: the WHO UV index. Good hours to walk
 * are PROPOSED, for the operator's doctor to agree.
 */
import type { City } from "./guide/sites";

export const HEAT_BANDS = [
  ["extreme_danger", 52],
  ["danger", 40],
  ["extreme_caution", 32],
  ["caution", 27],
] as const;
export const UV_BANDS = [
  ["extreme", 11],
  ["very_high", 8],
  ["high", 6],
  ["moderate", 3],
] as const;
export const GOOD_FEELS_BELOW = 32;
export const GOOD_UV_BELOW = 6;
export const DAY_FROM_HOUR = 5;
export const DAY_TO_HOUR = 23;
export const REFRESH_MIN = 30;
export const STALE_MIN = 180;

export type HeatBand = "unknown" | "comfortable" | (typeof HEAT_BANDS)[number][0];
export type UvBand = "unknown" | "low" | (typeof UV_BANDS)[number][0];

export function heatBand(feels: number | null | undefined): HeatBand {
  if (feels == null) return "unknown";
  for (const [name, at] of HEAT_BANDS) if (feels >= at) return name;
  return "comfortable";
}

export function uvBand(uv: number | null | undefined): UvBand {
  if (uv == null) return "unknown";
  for (const [name, at] of UV_BANDS) if (uv >= at) return name;
  return "low";
}

export const goodHour = (feels: number | null | undefined, uv: number | null | undefined) =>
  feels != null && feels < GOOD_FEELS_BELOW && (uv ?? 0) < GOOD_UV_BELOW;

export interface Window {
  from: string;
  to: string;
}

/** Runs of good hours within one day's hours, in order. */
export function goodWindows(hours: { at: string; feels: number | null; uv: number | null }[]): Window[] {
  const out: (Window & { next: number })[] = [];
  for (const h of hours) {
    const hour = Number(h.at.slice(11, 13));
    if (hour < DAY_FROM_HOUR || hour >= DAY_TO_HOUR || !goodHour(h.feels, h.uv)) continue;
    const last = out[out.length - 1];
    if (last && last.next === hour) {
      last.to = hh(hour + 1);
      last.next = hour + 1;
    } else out.push({ from: hh(hour), to: hh(hour + 1), next: hour + 1 });
  }
  return out.map(({ from, to }) => ({ from, to }));
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export interface WeatherHour {
  at: string;
  temp: number | null;
  feels: number | null;
  humidity: number | null;
  uv: number | null;
  rain_chance: number | null;
  code: number | null;
  wind: number | null;
  heat: HeatBand;
}

export interface WeatherDay {
  date: string;
  code: number | null;
  max: number | null;
  min: number | null;
  feels_max: number | null;
  uv_max: number | null;
  rain_chance: number | null;
  sunrise: string;
  sunset: string;
  heat: HeatBand;
  uv: UvBand;
  good: Window[];
}

export interface CityWeather {
  now: {
    temp: number | null;
    feels: number | null;
    humidity: number | null;
    code: number | null;
    wind: number | null;
    uv: number | null;
    heat: HeatBand;
    uv_band: UvBand;
  };
  hours: WeatherHour[];
  days: WeatherDay[];
}

export interface WeatherReport {
  updated_at: string;
  source: string;
  stale: boolean;
  cities: Record<City, CityWeather>;
  /** the sample's typical weather for the month, not a forecast */
  sample?: boolean;
}

/** What the sky is doing, from the WMO weather code, as an English key for say(). */
export function skyWord(code: number | null | undefined): string {
  if (code == null) return "—";
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

export type Sky = "sun" | "partly" | "cloud" | "rain" | "storm" | "fog";
export function skyKind(code: number | null | undefined): Sky {
  if (code == null || code <= 1) return "sun";
  if (code === 2) return "partly";
  if (code === 45 || code === 48) return "fog";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloud";
}

/** The day's advice, as English keys for say(), most important first. */
export function adviceFor(day: WeatherDay, hours: WeatherHour[]): { line: string; vars?: Record<string, string> }[] {
  const out: { line: string; vars?: Record<string, string> }[] = [];
  const HEAT: Record<HeatBand, string | null> = {
    unknown: null,
    comfortable: "A pleasant day. Enjoy your visits.",
    caution: "Warm today. Drink water and rest in the shade.",
    extreme_caution: "Hot today. Stay out of the sun at midday.",
    danger: "Very hot today. Avoid walking outside at midday.",
    extreme_danger: "Dangerous heat today. Stay indoors at midday.",
  };
  const heat = HEAT[day.heat];
  if (heat) out.push({ line: heat });
  const strong = hours.filter((h) => h.at.startsWith(day.date) && (h.uv ?? 0) >= GOOD_UV_BELOW);
  if (strong.length)
    out.push({
      line: "Strong sun from {from} to {to}. Use an umbrella.",
      vars: { from: strong[0].at.slice(11, 16), to: hh(Number(strong[strong.length - 1].at.slice(11, 13)) + 1) },
    });
  if ((day.rain_chance ?? 0) >= 40) out.push({ line: "Rain is possible. Stay away from valleys and flood channels." });
  const windy = hours.some((h) => h.at.startsWith(day.date) && (h.wind ?? 0) >= 40);
  if (windy) out.push({ line: "Strong wind: dust is likely. Cover your nose and mouth." });
  return out;
}

/* ---- the sample's weather: typical for the month, shaped like the platform's report ---- */

/** Average high and low by month (°C), January first: long-term climate normals, rounded. */
const NORMALS: Record<City, { hi: number[]; lo: number[]; humid: number; uv: number[] }> = {
  makkah: {
    hi: [31, 32, 35, 39, 42, 44, 43, 43, 42, 39, 35, 32],
    lo: [19, 20, 22, 25, 28, 29, 30, 30, 29, 26, 23, 21],
    humid: 50,
    uv: [8, 9, 11, 12, 12, 12, 12, 12, 11, 10, 8, 7],
  },
  madinah: {
    hi: [24, 27, 31, 35, 39, 43, 42, 43, 41, 36, 30, 26],
    lo: [12, 14, 18, 22, 26, 29, 29, 30, 28, 23, 18, 14],
    humid: 25,
    uv: [7, 8, 10, 11, 12, 12, 12, 12, 11, 9, 7, 6],
  },
};

const riyadh = (d: Date) => new Date(d.getTime() + 3 * 3600_000);
const isoHour = (d: Date) => riyadh(d).toISOString().slice(0, 13) + ":00";

/** One city's typical day, hour by hour: coolest at 05:00, hottest at 14:00. */
function sampleCity(city: City, now: Date): CityWeather {
  const n = NORMALS[city];
  const hours: WeatherHour[] = [];
  const start = new Date(Date.UTC(riyadh(now).getUTCFullYear(), riyadh(now).getUTCMonth(), riyadh(now).getUTCDate()) - 3 * 3600_000);
  for (let i = 0; i < 4 * 24; i++) {
    const at = new Date(start.getTime() + i * 3600_000);
    const m = riyadh(at).getUTCMonth();
    const hour = riyadh(at).getUTCHours();
    const day = Math.floor(i / 24);
    const hi = n.hi[m] + [0, 1, -1, 0][day];
    const lo = n.lo[m];
    /* rises from 05:00 to 14:00, falls until 05:00 the next day */
    const rising = hour >= 5 && hour <= 14;
    const f = rising ? (hour - 5) / 9 : hour > 14 ? 1 - (hour - 14) / 15 : 1 - (hour + 10) / 15;
    const temp = Math.round((lo + (hi - lo) * (0.5 - 0.5 * Math.cos(Math.PI * f))) * 10) / 10;
    const humidity = Math.round(n.humid * (1.3 - 0.6 * f));
    const feels = Math.round((temp + (humidity > 40 ? 2 : 0)) * 10) / 10;
    const uv = hour >= 6 && hour <= 18 ? Math.round(Math.max(0, n.uv[m] * Math.cos(((hour - 12) / 7) * (Math.PI / 2))) * 10) / 10 : 0;
    hours.push({ at: isoHour(at), temp, feels, humidity, uv, rain_chance: 0, code: hour >= 11 && hour <= 15 && day === 2 ? 2 : 0, wind: 10 + Math.round(8 * f), heat: heatBand(feels) });
  }
  const days: WeatherDay[] = [0, 1, 2, 3].map((d) => {
    const of = hours.slice(d * 24, d * 24 + 24);
    const max = Math.max(...of.map((h) => h.temp ?? 0));
    const feelsMax = Math.max(...of.map((h) => h.feels ?? 0));
    const uvMax = Math.max(...of.map((h) => h.uv ?? 0));
    return {
      date: of[0].at.slice(0, 10),
      code: d === 2 ? 2 : 0,
      max,
      min: Math.min(...of.map((h) => h.temp ?? 0)),
      feels_max: feelsMax,
      uv_max: uvMax,
      rain_chance: 0,
      sunrise: city === "makkah" ? "06:25" : "06:35",
      sunset: city === "makkah" ? "17:40" : "17:45",
      heat: heatBand(feelsMax),
      uv: uvBand(uvMax),
      good: goodWindows(of),
    };
  });
  const here = isoHour(now);
  const at = hours.find((h) => h.at === here) ?? hours[0];
  return {
    now: { temp: at.temp, feels: at.feels, humidity: at.humidity, code: at.code, wind: at.wind, uv: at.uv, heat: at.heat, uv_band: uvBand(at.uv) },
    hours: hours.filter((h) => h.at >= here).slice(0, 24),
    days,
  };
}

export function sampleWeather(now = new Date()): WeatherReport {
  return {
    updated_at: now.toISOString(),
    source: "sample",
    stale: false,
    sample: true,
    cities: { makkah: sampleCity("makkah", now), madinah: sampleCity("madinah", now) },
  };
}
