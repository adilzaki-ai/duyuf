import { HttpClient } from "../api/http";
import { config, resolvedDataSource, type AppConfig } from "../config/env";
import type { IncidentStatus } from "../domain/incidents";
import type { HelpKind, RafeeqLang } from "./help";

export interface RafeeqCall {
  id: string;
  ref: number;
  kind: HelpKind;
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
}

export interface RafeeqSource {
  readonly kind: "mock" | "platform";
  me(): Promise<RafeeqPage>;
  /** An urgent incident in the feed; the same call pressed again adds to it. */
  help(kind: HelpKind, location: string | null, language: RafeeqLang): Promise<RafeeqPage & { call: string; repeated: boolean }>;
  fine(callId: string): Promise<RafeeqPage>;
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
