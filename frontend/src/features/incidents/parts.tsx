import { incidentKindLabel, priorityLabel, type IncidentKind, type Priority } from "../../domain/incidents";
import { t } from "../../i18n";
import s from "./incidents.module.css";

export function PriorityChip({ priority }: { priority: Priority }) {
  const cls = priority === "urgent" ? s.urgent : priority === "high" ? s.high : "";
  return <span className={`${s.priority} ${cls}`}>{priorityLabel(priority)}</span>;
}

export const kindText = (k: IncidentKind) => incidentKindLabel(k);

/** "6 min", "2 h 10 min", "3 days": how long since `from`. */
export function since(from: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - Date.parse(from)) / 60_000));
  if (mins < 60) return t("{n} min", { n: mins });
  if (mins < 48 * 60) return t("{h} h {m} min", { h: Math.floor(mins / 60), m: mins % 60 });
  return t("{n} days", { n: Math.floor(mins / 1440) });
}

/** A median in minutes, said the same way; a dash when there is nothing to measure. */
export const minutesText = (m: number | null) =>
  m == null ? "—" : m < 60 ? t("{n} min", { n: m }) : t("{h} h {m} min", { h: Math.floor(m / 60), m: m % 60 });
