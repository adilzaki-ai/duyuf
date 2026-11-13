import type { Status } from "../domain/journey";
import type {
  Arrivals,
  Assignment,
  FlightChange,
  FlightDetail,
  Group,
  GroupChange,
  ImportResult,
  Me,
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
}
