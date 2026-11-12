/**
 * A pilgrim's journey and the moves allowed along it.
 *
 * The platform's own table is backend/api/duyuf/pilgrims/status.py; this copy
 * exists so the sample mode refuses what the platform refuses. journey.test.ts
 * reads the Python file and fails if the two ever differ.
 */
export const STATUSES = ["registered", "visa_issued", "arrived", "in_makkah", "in_madinah", "departed"] as const;
export type Status = (typeof STATUSES)[number];

export const MOVES: Record<Status, readonly Status[]> = {
  registered: ["visa_issued"],
  visa_issued: ["arrived", "registered"],
  arrived: ["in_makkah", "in_madinah", "departed"],
  in_makkah: ["in_madinah", "departed"],
  in_madinah: ["in_makkah", "departed"],
  departed: [],
};

/** Why `from → to` is refused, worded as the platform words it; null when allowed. */
export function refusal(from: Status, to: Status): string | null {
  if (to === from) return `already ${from}`;
  const next = MOVES[from];
  if (!next.includes(to))
    return `cannot go from ${from} to ${to}; allowed: ${next.length ? next.join(", ") : "nothing (the journey is over)"}`;
  return null;
}

/** In the Kingdom now: landed and not yet gone home. */
export const IN_KINGDOM: readonly Status[] = ["arrived", "in_makkah", "in_madinah"];

export const inKingdom = (by: Record<Status, number>) => IN_KINGDOM.reduce((n, s) => n + by[s], 0);
