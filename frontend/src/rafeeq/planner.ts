import { metres, type Point } from "./places";
import { siteById, TRIP_SITES, type City, type SiteId, type TripSite } from "./guide/sites";
import { goodHour, type WeatherHour } from "./weatherRules";

/**
 * The trip planner: the sites a pilgrim picked, in an order that saves
 * travel and keeps the outdoor ones for the cool hours, split into days.
 *
 * Travel times are ESTIMATES from straight-line distance (a road is about
 * 1.4 times longer; a car in the city about 30 km/h, plus 10 minutes to find
 * a taxi or park). Walking is offered under 1.2 km. The plan lives on the
 * phone only: it is the pilgrim's own and nobody else needs it.
 */

export const WALK_UNDER_M = 1200;
const ROAD = 1.4;
const CAR_KMH = 30;
const CAR_EXTRA_MIN = 10;
const WALK_KMH = 4;
/* an outdoor stop in a hot hour costs this much extra when choosing where to go next */
const HOT_PENALTY_MIN = 45;
/* an indoor stop in a cool hour, while outdoor ones are still to come, costs this much */
const COOL_WASTED_MIN = 30;

/** Where a plan starts when the phone gives no place: the main mosque, near most hotels. */
export const HOME: Record<City, SiteId> = { makkah: "haram", madinah: "nabawi" };

export const START_TIMES = ["06:30", "08:00", "16:00"] as const;
export type StartTime = (typeof START_TIMES)[number];

export interface PlanStop {
  id: SiteId;
  day: number;
  /** "07:10" Saudi time */
  arrive: string;
  leave: string;
  travel_min: number;
  mode: "walk" | "car";
  /** outdoors in a hot hour: the plan says so */
  hot: boolean;
  /** past the end of the day: too many places for the days chosen */
  over?: boolean;
}

export interface Plan {
  city: City;
  days: number;
  start: StartTime;
  picks: SiteId[];
  stops: PlanStop[];
  visited: SiteId[];
  made_at: string;
}

export function travel(a: Point, b: Point): { min: number; mode: "walk" | "car" } {
  const m = metres(a, b);
  if (m < WALK_UNDER_M) return { min: round5((m * ROAD) / ((WALK_KMH * 1000) / 60)), mode: "walk" };
  return { min: round5((m * ROAD) / ((CAR_KMH * 1000) / 60) + CAR_EXTRA_MIN), mode: "car" };
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const clock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Is this hour too hot to be outside? From the forecast when there is one; otherwise 10:00 to 16:00. */
export function hotAt(minute: number, hours: WeatherHour[] | null): boolean {
  const hour = Math.floor(minute / 60) % 24;
  const h = hours?.find((x) => Number(x.at.slice(11, 13)) === hour);
  if (h) return !goodHour(h.feels, h.uv);
  return hour >= 10 && hour < 16;
}

/**
 * Greedy: from where they are, go next to the stop that costs least, counting
 * travel and the heat for outdoor stops; start a new day when this one is full.
 * Morning plans have 6 hours a day, evening plans 5.
 */
export function makePlan(
  picks: SiteId[],
  city: City,
  opts: { days: number; start: StartTime; from?: Point | null; hours?: WeatherHour[] | null },
): PlanStop[] {
  const home = opts.from ?? siteById(HOME[city])!;
  const dayStart = minutesOf(opts.start);
  const dayLength = opts.start === "16:00" ? 300 : 360;
  let left = picks.map((id) => siteById(id)).filter((s): s is TripSite => !!s && s.city === city);
  const stops: PlanStop[] = [];
  let day = 1;
  let at: Point = home;
  let now = dayStart;
  while (left.length) {
    /* while it is cool, outdoor places go first; indoor ones can wait for the hot hours */
    const outdoorLeft = left.some((s) => !s.indoor);
    const cost = (s: TripSite) => {
      const t = travel(at, s);
      const arrive = now + t.min;
      const hot = hotAt(arrive, opts.hours ?? null);
      return t.min + (!s.indoor && hot ? HOT_PENALTY_MIN : 0) + (s.indoor && !hot && outdoorLeft && t.mode === "car" ? COOL_WASTED_MIN : 0);
    };
    const next = [...left].sort((a, b) => cost(a) - cost(b) || a.id.localeCompare(b.id))[0];
    const t = travel(at, next);
    const fits = now + t.min + next.minutes <= dayStart + dayLength;
    if (!fits && stops.some((s) => s.day === day) && day < opts.days) {
      day += 1;
      at = home;
      now = dayStart;
      continue;
    }
    const arrive = now + t.min;
    stops.push({
      id: next.id,
      day,
      arrive: clock(arrive),
      leave: clock(arrive + next.minutes),
      travel_min: t.min,
      mode: t.mode,
      hot: !next.indoor && hotAt(arrive, opts.hours ?? null),
      over: arrive + next.minutes > dayStart + dayLength,
    });
    now = arrive + next.minutes;
    at = next;
    left = left.filter((s) => s.id !== next.id);
  }
  return stops;
}

/** The first choices for a pilgrim who asks Rafeeq to suggest: the top sites, less the mosque they pray in every day. */
export const suggested = (city: City): SiteId[] => TRIP_SITES.filter((s) => s.city === city && s.top && s.id !== HOME[city]).map((s) => s.id);

/** One day's route in the phone's maps app, by car, from the start through every stop. */
export function dayRouteLink(stops: PlanStop[], from: Point): string {
  const pts = stops.map((s) => siteById(s.id)!);
  const last = pts[pts.length - 1];
  const via = pts.slice(0, -1).map((p) => `${p.lat},${p.lon}`).join("|");
  return (
    `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lon}&destination=${last.lat},${last.lon}&travelmode=driving` +
    (via ? `&waypoints=${encodeURIComponent(via)}` : "")
  );
}

/** Directions to one place: walking when it is close, driving otherwise. */
export const directionsLink = (to: Point, mode: "walk" | "car") =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}&travelmode=${mode === "walk" ? "walking" : "driving"}`;

const PLAN_KEY = (city: City) => `rafeeq.plan.${city}`;

export function loadPlan(city: City): Plan | null {
  try {
    const p = JSON.parse(localStorage.getItem(PLAN_KEY(city)) ?? "null") as Plan | null;
    return p && Array.isArray(p.stops) ? p : null;
  } catch {
    return null;
  }
}

export function savePlan(city: City, plan: Plan | null): void {
  try {
    if (plan) localStorage.setItem(PLAN_KEY(city), JSON.stringify(plan));
    else localStorage.removeItem(PLAN_KEY(city));
  } catch {
    /* private window: the plan lasts while the page is open */
  }
}
