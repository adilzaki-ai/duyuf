import type { IncidentAction, IncidentKind, IncidentStatus, Priority } from "./incidents";
import type { RafeeqLang } from "../rafeeq/help";
import type { Assessment, Reason } from "../rafeeq/vitals";
import type { Status } from "./journey";

export type GroupKind = "hajj" | "umrah";
export type Need = "wheelchair" | "medical" | "elderly" | "dietary" | "unaccompanied_minor";
export type Scope =
  | "group:read"
  | "group:write"
  | "pilgrim:read"
  | "pilgrim:write"
  | "pilgrim:status"
  | "pilgrim:identity"
  | "flight:read"
  | "flight:write"
  | "incident:read"
  | "incident:write"
  | "analyst:ask"
  | "staff:manage"
  | "rafeeq:issue"
  | "health:read"
  | "device:write";

export type Role = "administrator" | "supervisor" | "staff" | "viewer" | "medic";

export interface Me {
  tenant: { id: string; slug: string; name: string; name_ar: string | null; is_demo: boolean };
  principal: {
    id: string | null;
    name: string;
    role: string;
    email?: string | null;
    /** a new or reset password: nothing else opens until it is changed */
    must_change_password?: boolean;
  };
  /** how they came in: signed in (session), an API key, the developer header, or the sample */
  via?: "session" | "key" | "dev" | "sample";
  scopes: Scope[];
}

export interface Group {
  /** where the group gathers; Rafeeq's "Find my way" guides a lost pilgrim there */
  meeting_name?: string | null;
  meeting_lat?: number | null;
  meeting_lon?: number | null;
  id: string;
  code: string;
  name: string;
  kind: GroupKind;
  season: string;
  origin_country: string;
  arrival_date: string | null;
  departure_date: string | null;
  leader_name: string | null;
  leader_phone: string | null;
  pilgrims: number;
  by_status: Partial<Record<Status, number>>;
}

export interface Pilgrim {
  id: string;
  group_id: string;
  group_code: string;
  group_name: string;
  full_name: string;
  full_name_ar: string | null;
  gender: "male" | "female";
  /** null when the caller may not see it (no pilgrim:identity) */
  date_of_birth: string | null;
  nationality: string;
  /** masked to "•••• 1234" without pilgrim:identity */
  passport_no: string;
  phone: string | null;
  /** ISO 639-1, e.g. "ur"; null when not recorded */
  language: string | null;
  status: Status;
  needs: Need[];
  updated_at: string;
  arrival_flight_id: string | null;
  flight_number: string | null;
  /** the moves the platform will accept from here */
  allowed: Status[];
}

export interface JourneyStep {
  from_status: Status | null;
  to_status: Status;
  note: string | null;
  actor: string;
  at: string;
}

export interface PilgrimDetail extends Pilgrim {
  history: JourneyStep[];
}

export interface MovingGroup {
  id: string;
  code: string;
  name: string;
  kind: GroupKind;
  origin_country: string;
  on_date: string;
  pilgrims: number;
}

export interface Overview {
  today: string;
  window_days: number;
  groups: number;
  pilgrims: number;
  by_status: Record<Status, number>;
  needs: Partial<Record<Need, number>>;
  arriving: MovingGroup[];
  departing: MovingGroup[];
}

export interface PilgrimFilter {
  group_id?: string;
  flight_id?: string;
  status?: Status;
  q?: string;
  limit?: number;
  offset?: number;
}

/** on_time · delayed · due (its time has passed and nobody confirmed it) · landed */
export type FlightState = "on_time" | "delayed" | "due" | "landed";

export interface LanguageNeed {
  language: string | null;
  pilgrims: number;
  interpreters: number;
}

/** What a flight's pilgrims will need on the ground. Rules in domain/brief.ts. */
export interface Brief {
  pilgrims: number;
  over_75: number;
  unknown_age: number;
  wheelchair: number;
  medical: number;
  dietary: number;
  minor_alone: number;
  no_visa: number;
  buses: number;
  interpreters: number;
  languages: LanguageNeed[];
}

export interface FlightGroup {
  id: string;
  code: string;
  name: string;
  pilgrims: number;
}

export interface Flight {
  id: string;
  number: string;
  origin_airport: string;
  arrival_airport: string;
  scheduled_at: string;
  estimated_at: string | null;
  landed_at: string | null;
  /** the estimate when there is one, else the schedule */
  expected_at: string;
  delay_minutes: number;
  state: FlightState;
  /** as the airport names it, e.g. "Hajj Terminal"; null until someone enters it */
  terminal: string | null;
  /** the arrival gate, e.g. "H12"; null until someone enters it */
  gate: string | null;
  note: string | null;
  groups: FlightGroup[];
  brief: Brief;
  /** on the board only: its airport is short of something in the block it lands in */
  short?: boolean;
}

export type FlightEvent =
  | { kind: "created"; detail: Record<string, unknown>; actor: string; at: string }
  | { kind: "expected"; detail: { expected_at: string | null }; actor: string; at: string }
  | { kind: "gate"; detail: { terminal: string | null; gate: string | null }; actor: string; at: string }
  | { kind: "added"; detail: { added: number; group?: string }; actor: string; at: string }
  | { kind: "landed"; detail: { arrived: number; no_visa: number }; actor: string; at: string };

export interface FlightDetail extends Flight {
  history: FlightEvent[];
}

export interface Wave {
  start: string;
  by_airport: Record<string, number>;
}

export interface UnplannedGroup {
  id: string;
  code: string;
  name: string;
  arrival_date: string;
  without_flight: number;
}

export type ResourceKind = "wheelchair" | "bus" | "interpreter";

/** Wheelchairs, buses, and interpreters by language. */
export interface Resources {
  wheelchair: number;
  bus: number;
  interpreter: Record<string, number>;
}

export interface Shortfall {
  kind: ResourceKind;
  language: string | null;
  short: number;
}

/** One airport, one block of hours with a flight landing: what is needed and what is on shift. */
export interface LoadRow {
  airport: string;
  start: string;
  flights: string[];
  need: Resources;
  have: Resources;
  short: Shortfall[];
}

export interface Arrivals {
  now: string;
  hours: number;
  slot_hours: number;
  flights: Flight[];
  waves: Wave[];
  load: LoadRow[];
  unplanned: UnplannedGroup[];
  /** true when this is a what-if view, not the live board */
  what_if: boolean;
}

export interface Shift {
  id: string;
  airport: string;
  kind: ResourceKind;
  language: string | null;
  quantity: number;
  starts_at: string;
  ends_at: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface NewShift {
  airport: string;
  kind: ResourceKind;
  language: string | null;
  quantity: number;
  starts_at: string;
  ends_at: string;
  note?: string;
}

export interface ExtraResource {
  airport: string;
  kind: ResourceKind;
  language: string | null;
  quantity: number;
}

export interface WhatIf {
  hours: number;
  delays: { flight_id: string; minutes: number }[];
  extra: ExtraResource[];
}

export interface NewFlight {
  number: string;
  origin_airport: string;
  arrival_airport: string;
  /** with its zone, e.g. 2026-11-14T21:15:00+03:00 */
  scheduled_at: string;
  terminal?: string | null;
  gate?: string | null;
  note?: string;
}

export interface FlightChange {
  /** null puts the flight back on its schedule */
  estimated_at?: string | null;
  /** blank or null: not given yet */
  terminal?: string | null;
  gate?: string | null;
  note?: string | null;
}

export type Assignment = { group_id: string } | { pilgrim_ids: string[] };

export interface NewGroup {
  code: string;
  name: string;
  kind: GroupKind;
  season: string;
  origin_country: string;
  arrival_date: string | null;
  departure_date: string | null;
  leader_name: string | null;
  leader_phone: string | null;
}

export type GroupChange = Partial<
  Pick<NewGroup, "name" | "arrival_date" | "departure_date" | "leader_name" | "leader_phone"> &
    Pick<Group, "meeting_name" | "meeting_lat" | "meeting_lon">
>;

export interface NewPilgrim {
  group_id: string;
  full_name: string;
  full_name_ar: string | null;
  gender: "male" | "female";
  date_of_birth: string | null;
  nationality: string;
  passport_no: string;
  phone: string | null;
  language: string | null;
  needs: Need[];
}

export interface PilgrimChange {
  full_name?: string;
  full_name_ar?: string | null;
  phone?: string | null;
  language?: string | null;
  needs?: Need[];
  /** only null: takes the pilgrim off their arrival flight */
  arrival_flight_id?: null;
}

export interface ImportProblem {
  /** the data row, counting from 1 under the header */
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  rows: number;
  valid: number;
  errors: ImportProblem[];
  saved: boolean;
}

export interface Incident {
  id: string;
  /** "#1042" on screen and on the radio */
  ref: number;
  kind: IncidentKind;
  priority: Priority;
  status: IncidentStatus;
  pilgrim_id: string | null;
  pilgrim_name: string | null;
  pilgrim_name_ar: string | null;
  group_id: string | null;
  group_code: string | null;
  group_name: string | null;
  leader_phone: string | null;
  location: string | null;
  description: string;
  team: string | null;
  resolution: string | null;
  reported_by: string;
  opened_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  updated_at: string;
  /** raised by the pilgrim on their Rafeeq page */
  from_rafeeq: boolean;
  /** when the pilgrim said on Rafeeq that they are fine; staff still close it */
  pilgrim_ok_at: string | null;
  allowed: IncidentAction[];
}

export interface IncidentEvent {
  kind: "opened" | "assigned" | "note" | "resolved" | "reopened";
  note: string | null;
  team: string | null;
  actor: string;
  at: string;
}

export interface IncidentDetail extends Incident {
  history: IncidentEvent[];
  /** the pilgrim's latest place while the incident is open, if they share it */
  live_location?: Place | null;
  /** the readings behind it; medics and administrators only */
  health?: { alert: { reasons: Reason[]; heart_rate: number | null; temperature: number | null; started_at: string } | null; now: Assessment | null } | null;
}

export interface IncidentStats {
  open: number;
  assigned: number;
  urgent: number;
  resolved_today: number;
  /** medians over incidents opened in the last 7 days; null when there are none */
  minutes_to_assign: number | null;
  minutes_to_resolve: number | null;
}

export interface IncidentList {
  items: Incident[];
  stats: IncidentStats;
  /** teams used lately, most recent first, to offer when assigning */
  teams: string[];
}

export interface IncidentFilter {
  status?: "active" | "resolved" | "all";
  kind?: IncidentKind;
  pilgrim_id?: string;
  group_id?: string;
}

export interface NewIncident {
  kind: IncidentKind;
  priority: Priority;
  pilgrim_id: string | null;
  group_id: string | null;
  location: string | null;
  description: string;
}

export interface AnalystStatus {
  ready: boolean;
  model: string;
  /** why not, when not ready */
  reason?: string;
}

/** One look the analyst took at the data: which totals, asked how, and what came back. */
export interface AnalystSource {
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface AnalystChart {
  title: string;
  labels: string[];
  values: number[];
  unit: string | null;
}

export interface AnalystAnswer {
  id: string;
  asked_by: string;
  question: string;
  /** answered · declined (the model would not) · cut_short · failed (the call did not complete) */
  outcome: "answered" | "declined" | "cut_short" | "failed";
  answer: string | null;
  sources: AnalystSource[];
  charts: AnalystChart[];
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  seconds: number | null;
  asked_at: string;
}

export interface StaffMember {
  id: string;
  display_name: string;
  /** null: a person keys were issued to, who cannot sign in */
  email: string | null;
  role: Role;
  disabled: boolean;
  must_change_password: boolean;
  last_signed_in_at: string | null;
  created_at: string;
}

export interface NewStaff {
  display_name: string;
  email: string;
  role: Role;
  password: string;
}

export interface StaffChange {
  display_name?: string;
  role?: Role;
  disabled?: boolean;
  /** a password to hand over; it must be changed at the next sign in */
  password?: string;
}

/** A pilgrim's Rafeeq card in use. Never the card itself: only its hash is kept. */
export interface RafeeqCardInfo {
  language: RafeeqLang;
  issued_by: string;
  issued_at: string;
  last_used_at: string | null;
}

/** A card just made: the secret comes back this once, to print or send now. */
export interface IssuedCard {
  token: string;
  language: RafeeqLang;
  pilgrim_id: string;
  full_name: string;
  full_name_ar: string | null;
  group_code: string;
  group_name: string;
}

export interface GroupCards {
  cards: IssuedCard[];
  /** pilgrims who already had a card and kept it */
  kept: number;
}

export interface Place {
  lat: number;
  lon: number;
  accuracy_m: number | null;
  at: string;
  source: "phone" | "device" | "simulated";
}

export interface HealthAlertBrief {
  id: string;
  state: "counting" | "cancelled" | "sent";
  reasons: Reason[];
  fires_at?: string;
  incident_id: string | null;
  incident_ref: number | null;
}

/** One pilgrim on the health screen: only those who agreed to share. */
export interface HealthRow {
  pilgrim_id: string;
  full_name: string;
  full_name_ar: string | null;
  status: string;
  needs: string[];
  group_id: string;
  group_code: string;
  group_name: string;
  shares_health: boolean;
  shares_location: boolean;
  health: Assessment | null;
  place: Place | null;
  alert: HealthAlertBrief | null;
}

export interface HealthBoard {
  items: HealthRow[];
  stats: {
    danger: number;
    fever: number;
    heart: number;
    dehydration: number;
    sharing_health: number;
    sharing_location: number;
    no_readings: number;
    alerts: number;
  };
  at: string;
}

export interface PilgrimHealth {
  consent: { health: boolean; location: boolean };
  health: Assessment | null;
  readings: { at: string; heart_rate: number | null; temperature: number | null; source: string }[];
  alerts: {
    id: string;
    state: HealthAlertBrief["state"];
    reasons: Reason[];
    heart_rate: number | null;
    temperature: number | null;
    started_at: string;
    ended_at: string | null;
    incident_id: string | null;
    incident_ref: number | null;
  }[];
  places: Place[];
}

/* ---- the AI helpers (backend/api/duyuf/ai): advice only, nothing is sent or saved by them ---- */

export type AiScreen = "overview" | "arrivals" | "resources" | "incidents" | "health" | "groups" | "pilgrims";

export interface AiStatus {
  ready: boolean;
  model: string;
  reason?: string;
}

export interface AiBrief {
  headline: string;
  points: { text: string; tone: "act" | "watch" | "ok"; screen: AiScreen }[];
  first_action: { text: string; screen: AiScreen };
  model: string;
  /** reused from the last ten minutes */
  cached?: boolean;
}

export interface AiMessage {
  language: string;
  text: string;
  english: string;
}

export interface AiCopilot {
  summary: string;
  priority_ok: boolean;
  suggested_priority: Priority;
  team: string;
  next_step: string;
  message_to_leader: AiMessage;
  message_to_pilgrim: AiMessage;
  model: string;
}

export interface AiGap {
  gap: number;
  airport: string;
  /** "Sat 06:00", Saudi time */
  from: string;
  hours: number;
  kind: ResourceKind;
  language: string | null;
  short: number;
  flights: string[];
}

export interface AiAdvice {
  summary: string | null;
  items: { gap: number; explain: string; fix: string; extra: ExtraResource | null; of: AiGap }[];
  gaps: AiGap[];
  model: string | null;
}
