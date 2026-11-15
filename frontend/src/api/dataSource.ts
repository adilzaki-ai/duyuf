import type { Status } from "../domain/journey";
import type {
  AiAdvice,
  AiBrief,
  AiCopilot,
  AiStatus,
  AnalystAnswer,
  AnalystStatus,
  Arrivals,
  Assignment,
  FlightChange,
  FlightDetail,
  Group,
  GroupChange,
  GroupCards,
  HealthBoard,
  ImportResult,
  IncidentDetail,
  IncidentFilter,
  IncidentList,
  IssuedCard,
  Me,
  NewIncident,
  NewFlight,
  NewGroup,
  NewPilgrim,
  NewShift,
  NewStaff,
  PilgrimChange,
  StaffChange,
  StaffMember,
  Shift,
  WhatIf,
  Overview,
  Pilgrim,
  PilgrimDetail,
  PilgrimFilter,
  PilgrimHealth,
  RafeeqCardInfo,
  NewReturnLeg,
  NewVenue,
  ReturnLeg,
  StaffBooking,
  Venue,
  VenueChange,
} from "../domain/types";
import type { StaffAction } from "../domain/bookings";
import type { DispatchNote, DispatchSettings, DispatchView, NewWorker, Worker, WorkerChange } from "../domain/types";
import type { RafeeqLang } from "../rafeeq/help";

/**
 * Everything the screens read and write, behind one interface with two
 * adapters: PlatformSource (the backend) and MockSource (sample/demo.json, no
 * backend). Screens never know which one they have, except to show the
 * SAMPLE banner.
 */
export interface DataSource {
  readonly kind: "mock" | "platform";
  me(): Promise<Me>;
  overview(): Promise<Overview>;
  groups(): Promise<Group[]>;
  group(id: string): Promise<Group>;
  pilgrims(filter: PilgrimFilter): Promise<{ items: Pilgrim[]; total: number }>;
  pilgrim(id: string): Promise<PilgrimDetail>;
  movePilgrim(id: string, to: Status, note?: string): Promise<PilgrimDetail>;
  /** Flights landing from a little before now to `hours` ahead, with the wave and who has no flight. */
  arrivals(hours: number): Promise<Arrivals>;
  flight(id: string): Promise<FlightDetail>;
  createFlight(f: NewFlight): Promise<FlightDetail>;
  updateFlight(id: string, change: FlightChange): Promise<FlightDetail>;
  assignToFlight(id: string, who: Assignment): Promise<FlightDetail & { added: number }>;
  /** Moves everyone on it with a visa to "arrived"; says how many moved and how many had no visa. */
  landFlight(id: string, note?: string): Promise<FlightDetail & { arrived: number; no_visa: number }>;
  /** The board as it would be with these delays and extra resources. Nothing is saved. */
  whatIf(w: WhatIf): Promise<Arrivals>;
  /** Resources on shift that are not over yet. */
  shifts(): Promise<Shift[]>;
  addShift(s: NewShift): Promise<Shift>;
  removeShift(id: string): Promise<void>;
  createGroup(g: NewGroup): Promise<Group>;
  updateGroup(id: string, change: GroupChange): Promise<Group>;
  createPilgrim(p: NewPilgrim): Promise<PilgrimDetail>;
  updatePilgrim(id: string, change: PilgrimChange): Promise<PilgrimDetail>;
  /** Spreadsheet rows as read; the platform checks them. All or nothing; `dryRun` checks only. */
  importPilgrims(groupId: string, rows: Record<string, string>[], dryRun: boolean): Promise<ImportResult>;
  /** Still to deal with first, the most pressing and longest waiting first; stats over all of them. */
  incidents(f: IncidentFilter): Promise<IncidentList>;
  incident(id: string): Promise<IncidentDetail>;
  raiseIncident(i: NewIncident): Promise<IncidentDetail>;
  assignIncident(id: string, team: string, note?: string): Promise<IncidentDetail>;
  resolveIncident(id: string, resolution: string): Promise<IncidentDetail>;
  reopenIncident(id: string, note: string): Promise<IncidentDetail>;
  noteIncident(id: string, note: string): Promise<IncidentDetail>;
  /** Whether the server can reach the AI analyst at all. */
  analystStatus(): Promise<AnalystStatus>;
  /** A question about this operator's totals, with the last few turns for follow-ups. Can take a minute. */
  ask(question: string, history: { question: string; answer: string }[]): Promise<AnalystAnswer>;
  analystRecent(): Promise<AnalystAnswer[]>;
  /** Email and password; the session is a cookie the page cannot read. */
  signIn(email: string, password: string): Promise<Me>;
  signOut(): Promise<void>;
  /** Their own password. Every other session of theirs ends. */
  changePassword(current: string, next: string): Promise<Me>;
  /** The pilgrim's Rafeeq card in use, if any. */
  rafeeqCard(pilgrimId: string): Promise<RafeeqCardInfo | null>;
  /** A new card; any card they had stops working. */
  issueRafeeqCard(pilgrimId: string, language?: RafeeqLang): Promise<IssuedCard>;
  stopRafeeqCard(pilgrimId: string): Promise<void>;
  /** Cards for everyone still on the journey; with `replace`, those already handed out are replaced too. */
  issueGroupRafeeqCards(groupId: string, replace: boolean): Promise<GroupCards>;
  /** Pilgrims sharing readings or their place, the most serious first. Medics and administrators. */
  health(): Promise<HealthBoard>;
  pilgrimHealth(pilgrimId: string): Promise<PilgrimHealth>;
  /** Whether the AI helpers are set up on the server. */
  aiStatus(): Promise<AiStatus>;
  /** The shift briefing from today's totals; reused for ten minutes unless `refresh`. */
  aiBrief(language: "en" | "ar", refresh: boolean): Promise<AiBrief>;
  /** Help with one incident: priority, team, next step, messages in the pilgrim's language. */
  aiCopilot(incidentId: string, language: "en" | "ar"): Promise<AiCopilot>;
  /** Each gap on the arrivals board explained, with a fix to preview. */
  aiAdvice(language: "en" | "ar", hours: number): Promise<AiAdvice>;
  /** A group's flights home, in the order they fly. */
  returnLegs(groupId: string): Promise<ReturnLeg[]>;
  /** All legs at once; an empty list clears them. */
  setReturnLegs(groupId: string, legs: NewReturnLeg[]): Promise<ReturnLeg[]>;
  /** The places offered to pilgrims, switched-off ones too. */
  venues(): Promise<Venue[]>;
  addVenue(v: NewVenue): Promise<Venue>;
  updateVenue(id: string, change: VenueChange): Promise<Venue>;
  /** Waiting for an answer and waiting for payment first, then the rest; `waiting` counts requests. */
  bookings(): Promise<{ bookings: StaffBooking[]; waiting: number }>;
  booking(id: string): Promise<StaffBooking>;
  /** Confirm (pay at the place), ask for payment online, decline, or cancel; the note is shown to the pilgrim. */
  decideBooking(id: string, action: StaffAction, amount?: number | null, note?: string | null): Promise<StaffBooking>;
  /** The roster: people who can cover shifts. */
  workers(): Promise<Worker[]>;
  addWorker(w: NewWorker): Promise<Worker>;
  updateWorker(id: string, change: WorkerChange): Promise<Worker>;
  /** The dispatcher's setting, the plan waiting for approval, and the requests out. */
  dispatch(): Promise<DispatchView>;
  setDispatchSettings(s: Pick<DispatchSettings, "mode" | "horizon_hours" | "answer_minutes">): Promise<DispatchView>;
  /** Look at the board now: Automatic asks at once; otherwise a plan waits for approval. */
  runDispatch(): Promise<DispatchView>;
  approvePlan(id: string): Promise<DispatchView & { asked: number }>;
  discardPlan(id: string): Promise<DispatchView>;
  /** Staff sent the request themselves (WhatsApp). */
  markSent(requestId: string): Promise<DispatchView>;
  cancelRequest(requestId: string): Promise<DispatchView>;
  /** The plan explained by the AI helper: roles and counts, never names. */
  aiDispatch(language: "en" | "ar"): Promise<DispatchNote>;
  staff(): Promise<StaffMember[]>;
  addStaff(s: NewStaff): Promise<StaffMember>;
  updateStaff(id: string, change: StaffChange): Promise<StaffMember>;
}

/** A refusal or failure, carrying the platform's own words so the screen can show them. */
export class DataSourceError extends Error {
  readonly status?: number;
  constructor(message: string, opts: { status?: number } = {}) {
    super(message);
    this.name = "DataSourceError";
    this.status = opts.status;
  }
}
