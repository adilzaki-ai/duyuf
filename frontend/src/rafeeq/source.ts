import { HttpClient } from "../api/http";
import { config, resolvedDataSource, type AppConfig } from "../config/env";
import type { IncidentStatus } from "../domain/incidents";
import type { HelpKind, RafeeqLang } from "./help";
import type { Assessment, Reason } from "./vitals";

export interface RafeeqCall {
  id: string;
  ref: number;
  /** medical: sent by the platform when a countdown ran out */
  kind: HelpKind | "medical";
  status: IncidentStatus;
  opened_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  /** when the pilgrim pressed "I am fine now" */
  pilgrim_ok_at: string | null;
}

/** The pilgrim's page: who they are, who to call, and their calls for help. Nothing more. */
export interface RafeeqPage {
  full_name: string;
  full_name_ar: string | null;
  group_code: string;
  group_name: string;
  leader_name: string | null;
  leader_phone: string | null;
  operator: string;
  operator_ar: string | null;
  /** the language the card was made in */
  language: RafeeqLang;
  is_demo: boolean;
  calls: RafeeqCall[];
  /** what the pilgrim agreed to share */
  consent: { health: boolean; location: boolean };
  /** their readings judged now; null when they do not share health */
  health: Assessment | null;
  /** dangerous readings, counting down to a call for medical help */
  alert: RafeeqAlert | null;
  /** when their place last reached the platform */
  location_at: string | null;
  /** where their group gathers, when staff set it */
  meeting: { name: string; lat: number; lon: number } | null;
  /** the middle of where the rest of their group is now; only when enough of them share their place */
  group_now: { lat: number; lon: number; count: number; at: string } | null;
  /** their last readings, newest first, for the health rows' details */
  recent: { at: string; heart_rate: number | null; temperature: number | null }[];
}

export interface RafeeqAlert {
  id: string;
  reasons: Reason[];
  heart_rate: number | null;
  temperature: number | null;
  started_at: string;
  fires_at: string;
  seconds_left: number;
}

/** What a pilgrim's question can lead to: the one button Rafeeq suggests. */
export const ASK_ACTIONS = ["none", "sos", "find_my_way", "call_leader", "drank_water", "heat_safety"] as const;
export type AskAction = (typeof ASK_ACTIONS)[number];

export interface AskAnswer {
  /** declined: the model would not answer; failed: nothing usable came back */
  outcome: "answered" | "declined" | "failed";
  answer: string | null;
  action: AskAction;
}

export interface NewReading {
  at?: string;
  heart_rate?: number;
  temperature?: number;
}

export interface RafeeqSource {
  readonly kind: "mock" | "platform";
  me(): Promise<RafeeqPage>;
  /** An urgent incident in the feed; the same call pressed again adds to it. */
  help(kind: HelpKind, location: string | null, language: RafeeqLang): Promise<RafeeqPage & { call: string; repeated: boolean }>;
  fine(callId: string): Promise<RafeeqPage>;
  /** Leave one out to keep it; false withdraws it and removes what was shared. */
  consent(c: { health?: boolean; location?: boolean }): Promise<RafeeqPage>;
  /** From a watch, or the demonstration's buttons (`simulated`, demonstration operators only). */
  readings(r: NewReading[], source: "device" | "simulated"): Promise<RafeeqPage>;
  water(): Promise<RafeeqPage>;
  location(lat: number, lon: number, accuracy_m: number | null, source: "phone" | "simulated"): Promise<void>;
  /** "I am OK": stops the countdown. Refused (409) once help has been called. */
  iAmOk(alertId: string): Promise<RafeeqPage>;
  /** A question by voice or text; an answer in their language and one suggested button. */
  ask(question: string, language: RafeeqLang, history: { question: string; answer: string }[]): Promise<AskAnswer>;
}

/** The platform, with the card's secret in place of a key. */
export class PlatformRafeeq implements RafeeqSource {
  readonly kind = "platform" as const;
  private readonly http: HttpClient;

  constructor(token: string, baseUrl: string) {
    this.http = new HttpClient({ baseUrl, apiKey: token, timeoutMs: 12_000 });
  }

  me() {
    return this.http.get<RafeeqPage>("/v1/rafeeq/me");
  }

  help(kind: HelpKind, location: string | null, language: RafeeqLang) {
    return this.http.post<RafeeqPage & { call: string; repeated: boolean }>("/v1/rafeeq/help", { kind, location, language });
  }

  fine(callId: string) {
    return this.http.post<RafeeqPage>(`/v1/rafeeq/help/${encodeURIComponent(callId)}/fine`);
  }

  consent(c: { health?: boolean; location?: boolean }) {
    return this.http.post<RafeeqPage>("/v1/rafeeq/consent", c);
  }

  readings(r: NewReading[], source: "device" | "simulated") {
    return this.http.post<RafeeqPage>("/v1/rafeeq/readings", { readings: r, source });
  }

  water() {
    return this.http.post<RafeeqPage>("/v1/rafeeq/water");
  }

  location(lat: number, lon: number, accuracy_m: number | null, source: "phone" | "simulated") {
    return this.http.post<void>("/v1/rafeeq/location", { lat, lon, accuracy_m, source });
  }

  iAmOk(alertId: string) {
    return this.http.post<RafeeqPage>(`/v1/rafeeq/alert/${encodeURIComponent(alertId)}/ok`);
  }

  ask(question: string, language: RafeeqLang, history: { question: string; answer: string }[]) {
    return this.http.post<AskAnswer>("/v1/rafeeq/ask", { question, language, history }, 40_000);
  }
}

/**
 * The sample only when the build is set to it. Never as a fallback: a call for
 * help that cannot reach the platform must say it was not sent, not land in a
 * sample nobody watches.
 */
export async function createRafeeqSource(token: string, c: AppConfig = config): Promise<RafeeqSource> {
  if (resolvedDataSource(c) === "mock") {
    const { MockRafeeq } = await import("./mockRafeeq");
    return new MockRafeeq(token);
  }
  return new PlatformRafeeq(token, c.apiUrl);
}

const CARD_KEY = "rafeeq.card";

/**
 * The card's secret: from the link (/r#rfq_…), remembered on this phone so the
 * page opens again without the card. The secret stays in the link, after the
 * #, which browsers never send to a server, so a saved link keeps working.
 */
export function cardToken(): string | null {
  const fromLink = (globalThis.location?.hash ?? "").slice(1);
  try {
    if (fromLink.startsWith("rfq_")) {
      localStorage.setItem(CARD_KEY, fromLink);
      return fromLink;
    }
    return localStorage.getItem(CARD_KEY);
  } catch {
    return fromLink.startsWith("rfq_") ? fromLink : null;
  }
}
