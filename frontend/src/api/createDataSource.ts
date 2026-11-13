import { config, resolvedDataSource, type AppConfig } from "../config/env";
import type { Me } from "../domain/types";
import { DataSourceError, type DataSource } from "./dataSource";
import { PlatformSource } from "./platformSource";

export interface StartedSource {
  source: DataSource;
  /** null: the platform is there, but nobody is signed in yet */
  me: Me | null;
  /** Set when the platform was configured but unreachable and the sample took over. */
  fallbackReason?: string;
}

/* The sample is a few hundred invented pilgrims; a build talking to the platform loads it only if it falls back. */
async function sample(): Promise<StartedSource> {
  const { MockSource } = await import("./mockSource");
  const mock = new MockSource();
  return { source: mock, me: await mock.me() };
}

/**
 * Chooses the adapter and asks who we are, once. When allowed to, falls back
 * to the sample if the platform cannot be reached — and says so: the shell
 * shows a SAMPLE banner naming the reason for as long as it lasts.
 */
export async function startDataSource(c: AppConfig = config): Promise<StartedSource> {
  if (resolvedDataSource(c) === "platform") {
    const platform = new PlatformSource({ baseUrl: c.apiUrl, apiKey: c.apiKey });
    try {
      return { source: platform, me: await platform.me() };
    } catch (err) {
      /* the platform answered, and wants a sign in: that is not a reason to show the sample */
      if (err instanceof DataSourceError && err.status === 401 && !c.apiKey) return { source: platform, me: null };
      if (!c.mockFallback) throw err;
      return { ...(await sample()), fallbackReason: err instanceof Error ? err.message : String(err) };
    }
  }
  return sample();
}
