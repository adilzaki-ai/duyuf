/** Makkah and Madinah keep one clock; "today" is the Saudi day wherever the screen is. */
export const KSA_TZ = "Asia/Riyadh";

/** YYYY-MM-DD for the Saudi calendar day of `at`. */
export function ksaDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KSA_TZ }).format(at);
}

/** A YYYY-MM-DD date moved by whole days. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
