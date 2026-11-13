import type { Flight, FlightState, LanguageNeed } from "../../domain/types";
import { fmtNum, getLang, languageName, t } from "../../i18n";
import { daysBetween, ksaDate } from "../../lib/dates";
import a from "./arrivals.module.css";

export function stateLabel(f: Pick<Flight, "state" | "delay_minutes">): string {
  switch (f.state) {
    case "landed":
      return t("Landed");
    case "due":
      return t("Not confirmed");
    case "delayed":
      return t("{n} min late", { n: f.delay_minutes });
    default:
      return t("On time");
  }
}

export function FlightStateChip({ flight }: { flight: Pick<Flight, "state" | "delay_minutes"> }) {
  const cls: Record<FlightState, string> = { on_time: "", delayed: a.delayed, due: a.due, landed: a.landed };
  return <span className={`${a.state} ${cls[flight.state]}`}>{stateLabel(flight)}</span>;
}

/** "Today", "Tomorrow", "Yesterday", or the weekday: the Saudi day of `iso` seen from `now`. The full date sits beside it. */
export function dayWord(iso: string, now: string): string {
  const d = daysBetween(ksaDate(new Date(now)), ksaDate(new Date(iso)));
  if (d === 0) return t("Today");
  if (d === 1) return t("Tomorrow");
  if (d === -1) return t("Yesterday");
  return new Intl.DateTimeFormat(getLang() === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    weekday: "long",
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));
}

export const langName = (l: LanguageNeed["language"]) => (l ? languageName(l) : t("Not recorded"));

/** The two largest languages on a flight, then "+n" for the rest. */
export function Languages({ items }: { items: LanguageNeed[] }) {
  const shown = items.slice(0, 2);
  return (
    <>
      {shown.map((l) => (
        <span key={l.language ?? "-"} className={a.lang}>
          {langName(l.language)} {fmtNum(l.pilgrims)}
        </span>
      ))}
      {items.length > shown.length && <span className={a.lang}>+{items.length - shown.length}</span>}
    </>
  );
}
