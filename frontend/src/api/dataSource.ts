import type { Status } from "../domain/journey";
import type { Group, Me, Overview, Pilgrim, PilgrimDetail, PilgrimFilter } from "../domain/types";

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
