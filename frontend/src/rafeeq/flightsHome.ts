import type { ReturnLeg } from "./source";
import { saudiToday, visaState } from "./visaDays";

/**
 * The flights home on the pilgrim's page: when to remind them, and a calendar
 * file so the phone reminds them even when Rafeeq is closed.
 *
 * Reminder windows are PROPOSED (the operator's call): from three days out,
 * stronger the day before and on the day; the visa joins in when it has three
 * days or fewer left.
 */

export const REMIND_FROM_DAYS = 3;

/** Where an airport is, for its local landing time. Unknown airports show Saudi time. */
export const AIRPORTS: Record<string, { city: string; tz: string }> = {
  MED: { city: "Madinah", tz: "Asia/Riyadh" },
  JED: { city: "Jeddah", tz: "Asia/Riyadh" },
  RUH: { city: "Riyadh", tz: "Asia/Riyadh" },
  TIF: { city: "Taif", tz: "Asia/Riyadh" },
  CGK: { city: "Jakarta", tz: "Asia/Jakarta" },
  SUB: { city: "Surabaya", tz: "Asia/Jakarta" },
  UPG: { city: "Makassar", tz: "Asia/Makassar" },
  KUL: { city: "Kuala Lumpur", tz: "Asia/Kuala_Lumpur" },
  KHI: { city: "Karachi", tz: "Asia/Karachi" },
  LHE: { city: "Lahore", tz: "Asia/Karachi" },
  ISB: { city: "Islamabad", tz: "Asia/Karachi" },
  DAC: { city: "Dhaka", tz: "Asia/Dhaka" },
  HYD: { city: "Hyderabad", tz: "Asia/Kolkata" },
  BOM: { city: "Mumbai", tz: "Asia/Kolkata" },
  CAI: { city: "Cairo", tz: "Africa/Cairo" },
  IST: { city: "Istanbul", tz: "Europe/Istanbul" },
  SAW: { city: "Istanbul", tz: "Europe/Istanbul" },
  LHR: { city: "London", tz: "Europe/London" },
  MAN: { city: "Manchester", tz: "Europe/London" },
  CDG: { city: "Paris", tz: "Europe/Paris" },
  KAN: { city: "Kano", tz: "Africa/Lagos" },
  ABV: { city: "Abuja", tz: "Africa/Lagos" },
  LOS: { city: "Lagos", tz: "Africa/Lagos" },
  AMM: { city: "Amman", tz: "Asia/Amman" },
  DXB: { city: "Dubai", tz: "Asia/Dubai" },
  DOH: { city: "Doha", tz: "Asia/Qatar" },
};

/** "Mon 16 Nov · 08:10" in the airport's own time (Saudi time when unknown). */
export function localTime(iso: string, airport: string, lang: string): { day: string; time: string; saudi: boolean } {
  const tz = AIRPORTS[airport]?.tz ?? "Asia/Riyadh";
  const at = new Date(iso);
  try {
    const day = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(at);
    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(at);
    return { day, time, saudi: tz === "Asia/Riyadh" };
  } catch {
    return { day: iso.slice(0, 10), time: iso.slice(11, 16), saudi: false };
  }
}

export interface Reminder {
  level: "info" | "soon" | "today";
  /** English key for say(), with its values */
  line: string;
  vars?: Record<string, string | number>;
}

const dayOf = (iso: string) => saudiToday(new Date(iso));
const daysBetween = (a: string, b: string) => (Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000;

/** What to remind them of now, the most pressing first. */
export function reminders(legs: ReturnLeg[] | undefined, visaEnds: string | null | undefined, now = new Date()): Reminder[] {
  const out: Reminder[] = [];
  const first = legs?.[0];
  const today = saudiToday(now);
  if (first && Date.parse(first.departs_at) > now.getTime()) {
    const days = daysBetween(today, dayOf(first.departs_at));
    const time = localTime(first.departs_at, first.from_airport, "en").time;
    if (days === 0) out.push({ level: "today", line: "Your flight home is today at {time}. Keep your passport and Rafeeq card with you.", vars: { time } });
    else if (days === 1) out.push({ level: "soon", line: "Your flight home is tomorrow at {time}. Pack tonight and keep your passport with you.", vars: { time } });
    else if (days <= REMIND_FROM_DAYS) out.push({ level: "info", line: "Your flight home is in {n} days.", vars: { n: days } });
    if (days <= 1) out.push({ level: days === 0 ? "today" : "soon", line: "Ask your group leader when the bus leaves for the airport." });
  }
  const v = visaState(visaEnds, null, today);
  if (v.level === "urgent" && v.days !== null)
    out.push(
      v.days === 0
        ? { level: "today", line: "Your visa ends today." }
        : { level: "soon", line: "Your visa ends in {n} days.", vars: { n: v.days } },
    );
  return out;
}

/* ---- the calendar file ---- */

const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/**
 * One file with every flight home (reminded a day before and six hours before)
 * and the visa's last day (reminded three days before). Times are UTC, so the
 * phone shows them in its own zone.
 */
export function calendarFile(legs: ReturnLeg[], visaEnds: string | null | undefined, words: { flight: (l: ReturnLeg) => string; visa: string }, stamp = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Duyuf//Rafeeq//EN", "CALSCALE:GREGORIAN"];
  for (const l of legs) {
    const end = l.arrives_at ?? new Date(Date.parse(l.departs_at) + 2 * 3600_000).toISOString();
    lines.push(
      "BEGIN:VEVENT",
      `UID:rafeeq-${l.flight_number.replace(/\s/g, "")}-${icsTime(l.departs_at)}@duyuf`,
      `DTSTAMP:${icsTime(stamp.toISOString())}`,
      `DTSTART:${icsTime(l.departs_at)}`,
      `DTEND:${icsTime(end)}`,
      `SUMMARY:${esc(words.flight(l))}`,
      `LOCATION:${esc(`${l.from_airport} → ${l.to_airport}`)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(words.flight(l))}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(words.flight(l))}`,
      "TRIGGER:-PT6H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  if (visaEnds) {
    const d = visaEnds.replace(/-/g, "");
    const next = new Date(Date.parse(`${visaEnds}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:rafeeq-visa-${d}@duyuf`,
      `DTSTAMP:${icsTime(stamp.toISOString())}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${esc(words.visa)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(words.visa)}`,
      "TRIGGER:-P3D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
