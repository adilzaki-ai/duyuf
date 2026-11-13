import type { Status } from "../domain/journey";
import type {
  Arrivals,
  Assignment,
  FlightChange,
  FlightDetail,
  Group,
  GroupChange,
  ImportResult,
  IncidentDetail,
  IncidentFilter,
  IncidentList,
  Me,
  NewIncident,
  NewFlight,
  NewGroup,
  NewPilgrim,
  NewShift,
  PilgrimChange,
  Shift,
  WhatIf,
  Overview,
  Pilgrim,
  PilgrimDetail,
  PilgrimFilter,
} from "../domain/types";

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
