import { DataSourceError } from "./dataSource";

export interface HttpOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Query = Record<string, string | number | undefined>;

/**
 * The one place that speaks HTTP to the platform: credentials, a timeout, and
 * non-2xx turned into a DataSourceError carrying the platform's `detail`, so a
 * refusal ("allowed: visa_issued") reaches the screen word for word.
 */
export class HttpClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string> = { Accept: "application/json" };

  constructor(opts: HttpOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    if (opts.apiKey) this.headers.Authorization = `Bearer ${opts.apiKey}`;
  }

  get<T>(path: string, query?: Query) {
    return this.request<T>("GET", path, query);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, undefined, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, undefined, body);
  }

  delete(path: string) {
    return this.request<void>("DELETE", path);
  }

  private async request<T>(method: string, path: string, query?: Query, body?: unknown): Promise<T> {
    /* Resolved against the page, so a base of "/" means "wherever this app was loaded from". */
    const url = new URL(this.base + path, globalThis.location?.href);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null && v !== "") url.searchParams.set(k, String(v));
    const headers = { ...this.headers, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      throw new DataSourceError(timedOut ? "the platform did not answer in time" : "the platform cannot be reached");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new DataSourceError(describe(res.status, await res.text()), { status: res.status });
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

function describe(status: number, text: string): string {
  try {
    const detail = (JSON.parse(text) as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg ?? String(d)).join("; ");
  } catch {
    /* not JSON */
  }
  return `the platform answered ${status}`;
}
