import type { Status } from "../domain/journey";
import type {
  AnalystAnswer,
  AnalystStatus,
  Arrivals,
  Assignment,
  FlightChange,
  FlightDetail,
  Group,
  GroupChange,
  GroupCards,
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
  RafeeqCardInfo,
} from "../domain/types";
import type { RafeeqLang } from "../rafeeq/help";
import type { DataSource } from "./dataSource";
import { HttpClient, type HttpOptions } from "./http";

/** The backend, at backend/api/duyuf. */
export class PlatformSource implements DataSource {
  readonly kind = "platform" as const;
  private readonly http: HttpClient;

  constructor(opts: HttpOptions) {
    this.http = new HttpClient(opts);
  }

  me() {
    return this.http.get<Me>("/v1/me");
  }

  overview() {
    return this.http.get<Overview>("/v1/overview");
  }

  async groups() {
    return (await this.http.get<{ items: Group[] }>("/v1/groups")).items;
  }

  group(id: string) {
    return this.http.get<Group>(`/v1/groups/${encodeURIComponent(id)}`);
  }

  pilgrims(f: PilgrimFilter) {
    return this.http.get<{ items: Pilgrim[]; total: number }>("/v1/pilgrims", { ...f });
  }

  pilgrim(id: string) {
    return this.http.get<PilgrimDetail>(`/v1/pilgrims/${encodeURIComponent(id)}`);
  }

  movePilgrim(id: string, to: Status, note?: string) {
    return this.http.post<PilgrimDetail>(`/v1/pilgrims/${encodeURIComponent(id)}/status`, { to, note });
  }

  arrivals(hours: number) {
    return this.http.get<Arrivals>("/v1/arrivals", { hours });
  }

  flight(id: string) {
    return this.http.get<FlightDetail>(`/v1/flights/${encodeURIComponent(id)}`);
  }

  createFlight(f: NewFlight) {
    return this.http.post<FlightDetail>("/v1/flights", f);
  }

  updateFlight(id: string, change: FlightChange) {
    return this.http.patch<FlightDetail>(`/v1/flights/${encodeURIComponent(id)}`, change);
  }

  assignToFlight(id: string, who: Assignment) {
    return this.http.post<FlightDetail & { added: number }>(`/v1/flights/${encodeURIComponent(id)}/pilgrims`, who);
  }

  landFlight(id: string, note?: string) {
    return this.http.post<FlightDetail & { arrived: number; no_visa: number }>(
      `/v1/flights/${encodeURIComponent(id)}/landed`,
      { note },
    );
  }

  whatIf(w: WhatIf) {
    return this.http.post<Arrivals>("/v1/arrivals/what-if", w);
  }

  async shifts() {
    return (await this.http.get<{ items: Shift[] }>("/v1/resources")).items;
  }

  addShift(s: NewShift) {
    return this.http.post<Shift>("/v1/resources", s);
  }

  removeShift(id: string) {
    return this.http.delete(`/v1/resources/${encodeURIComponent(id)}`);
  }

  createGroup(g: NewGroup) {
    return this.http.post<Group>("/v1/groups", g);
  }

  updateGroup(id: string, change: GroupChange) {
    return this.http.patch<Group>(`/v1/groups/${encodeURIComponent(id)}`, change);
  }

  createPilgrim(p: NewPilgrim) {
    return this.http.post<PilgrimDetail>("/v1/pilgrims", p);
  }

  updatePilgrim(id: string, change: PilgrimChange) {
    return this.http.patch<PilgrimDetail>(`/v1/pilgrims/${encodeURIComponent(id)}`, change);
  }

  importPilgrims(groupId: string, rows: Record<string, string>[], dryRun: boolean) {
    return this.http.post<ImportResult>(`/v1/groups/${encodeURIComponent(groupId)}/pilgrims/import`, {
      rows,
      dry_run: dryRun,
    });
  }

  incidents(f: IncidentFilter) {
    return this.http.get<IncidentList>("/v1/incidents", { ...f });
  }

  incident(id: string) {
    return this.http.get<IncidentDetail>(`/v1/incidents/${encodeURIComponent(id)}`);
  }

  raiseIncident(i: NewIncident) {
    return this.http.post<IncidentDetail>("/v1/incidents", i);
  }

  assignIncident(id: string, team: string, note?: string) {
    return this.http.post<IncidentDetail>(`/v1/incidents/${encodeURIComponent(id)}/assign`, { team, note });
  }

  resolveIncident(id: string, resolution: string) {
    return this.http.post<IncidentDetail>(`/v1/incidents/${encodeURIComponent(id)}/resolve`, { resolution });
  }

  reopenIncident(id: string, note: string) {
    return this.http.post<IncidentDetail>(`/v1/incidents/${encodeURIComponent(id)}/reopen`, { note });
  }

  noteIncident(id: string, note: string) {
    return this.http.post<IncidentDetail>(`/v1/incidents/${encodeURIComponent(id)}/notes`, { note });
  }

  analystStatus() {
    return this.http.get<AnalystStatus>("/v1/analyst/status");
  }

  /* a question runs several rounds with the model: allow three minutes, not the usual fifteen seconds */
  ask(question: string, history: { question: string; answer: string }[]) {
    return this.http.post<AnalystAnswer>("/v1/analyst/ask", { question, history }, 180_000);
  }

  async analystRecent() {
    return (await this.http.get<{ items: AnalystAnswer[] }>("/v1/analyst/recent")).items;
  }

  signIn(email: string, password: string) {
    return this.http.post<Me>("/v1/auth/sign-in", { email, password });
  }

  signOut() {
    return this.http.post<void>("/v1/auth/sign-out");
  }

  changePassword(current: string, next: string) {
    return this.http.post<Me>("/v1/auth/password", { current, new: next });
  }

  async rafeeqCard(pilgrimId: string) {
    return (await this.http.get<{ card: RafeeqCardInfo | null }>(`/v1/pilgrims/${encodeURIComponent(pilgrimId)}/rafeeq`)).card;
  }

  issueRafeeqCard(pilgrimId: string, language?: RafeeqLang) {
    return this.http.post<IssuedCard>(`/v1/pilgrims/${encodeURIComponent(pilgrimId)}/rafeeq`, language ? { language } : {});
  }

  stopRafeeqCard(pilgrimId: string) {
    return this.http.delete(`/v1/pilgrims/${encodeURIComponent(pilgrimId)}/rafeeq`);
  }

  issueGroupRafeeqCards(groupId: string, replace: boolean) {
    return this.http.post<GroupCards>(`/v1/groups/${encodeURIComponent(groupId)}/rafeeq`, { replace });
  }

  async staff() {
    return (await this.http.get<{ items: StaffMember[] }>("/v1/staff")).items;
  }

  addStaff(s: NewStaff) {
    return this.http.post<StaffMember>("/v1/staff", s);
  }

  updateStaff(id: string, change: StaffChange) {
    return this.http.patch<StaffMember>(`/v1/staff/${encodeURIComponent(id)}`, change);
  }
}
