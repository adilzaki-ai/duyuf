import { t } from "../i18n";

/**
 * An incident's journey and the moves allowed along it.
 *
 * The platform's table is backend/api/duyuf/incidents/flow.py; incidents.test.ts
 * reads it and fails if the two ever differ.
 */
export const INCIDENT_STATUSES = ["open", "assigned", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_KINDS = ["sos", "lost", "medical", "heat", "transport", "other"] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const PRIORITIES = ["urgent", "high", "normal"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type IncidentAction = "assign" | "resolve" | "reopen";

export const INCIDENT_MOVES: Record<IncidentAction, { from: readonly IncidentStatus[]; to: IncidentStatus }> = {
  assign: { from: ["open", "assigned"], to: "assigned" },
  resolve: { from: ["open", "assigned"], to: "resolved" },
  reopen: { from: ["resolved"], to: "open" },
};

export function incidentRefusal(current: IncidentStatus, action: IncidentAction): string | null {
  return INCIDENT_MOVES[action].from.includes(current) ? null : `cannot ${action} an incident that is ${current}`;
}

export const allowedActions = (s: IncidentStatus) =>
  (Object.keys(INCIDENT_MOVES) as IncidentAction[]).filter((a) => INCIDENT_MOVES[a].from.includes(s));

const KIND_EN: Record<IncidentKind, string> = {
  sos: "SOS",
  lost: "Lost",
  medical: "Medical",
  heat: "Heat",
  transport: "Transport",
  other: "Other",
};
const PRIORITY_EN: Record<Priority, string> = { urgent: "Urgent", high: "High", normal: "Normal" };
const STATUS_EN: Record<IncidentStatus, string> = { open: "Open", assigned: "Assigned", resolved: "Resolved" };

export const incidentKindLabel = (k: IncidentKind) => t(KIND_EN[k]);
export const priorityLabel = (p: Priority) => t(PRIORITY_EN[p]);
export const incidentStatusLabel = (s: IncidentStatus) => t(STATUS_EN[s]);

/** The English the tables above pass to t(), for the Arabic coverage test. */
export const INCIDENT_LABELS_EN = [...Object.values(KIND_EN), ...Object.values(PRIORITY_EN), ...Object.values(STATUS_EN)];
