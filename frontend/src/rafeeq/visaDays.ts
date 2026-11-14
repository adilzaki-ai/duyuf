/**
 * Days left on the pilgrim's visa, counted on the phone so the window works
 * with no signal. The date is the one staff entered from the visa itself;
 * nothing here guesses it from the kind of visa.
 *
 * Levels (PROPOSED, the operator's call): more than 14 days is fine, 4 to 14
 * is "plan your leaving", 3 or fewer is urgent, below zero it has ended.
 */

export type VisaLevel = "none" | "ok" | "soon" | "urgent" | "ended";

export const SOON_DAYS = 14;
export const URGENT_DAYS = 3;
/** the ring is drawn against this many days: the usual Umrah visa */
export const RING_DAYS = 90;

/** Today in Saudi Arabia, as 2026-11-14. */
export function saudiToday(now = new Date()): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

export interface VisaState {
  level: VisaLevel;
  /** whole days from today to the last valid day; 0 is "ends today" */
  days: number | null;
  /** the group's planned departure is after the visa ends */
  leavesAfter: boolean;
}

export function visaState(expires: string | null | undefined, leaving: string | null | undefined, today = saudiToday()): VisaState {
  if (!expires) return { level: "none", days: null, leavesAfter: false };
  const days = dayNumber(expires) - dayNumber(today);
  const level: VisaLevel = days < 0 ? "ended" : days <= URGENT_DAYS ? "urgent" : days <= SOON_DAYS ? "soon" : "ok";
  return { level, days, leavesAfter: !!leaving && leaving > expires };
}
