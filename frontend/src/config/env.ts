export type DataSourceKind = "auto" | "mock" | "platform";

export interface AppConfig {
  dataSource: DataSourceKind;
  apiUrl: string;
  apiKey?: string;
  mockFallback: boolean;
}

const env = import.meta.env;

export const config: AppConfig = {
  dataSource: (env.VITE_DATA_SOURCE as DataSourceKind) || "auto",
  apiUrl: env.VITE_DUYUF_API_URL ?? "",
  apiKey: env.VITE_DUYUF_API_KEY || undefined,
  mockFallback: env.VITE_MOCK_FALLBACK !== "false",
};

/** "auto" means the platform when one is named, else the sample. */
export function resolvedDataSource(c: AppConfig = config): "mock" | "platform" {
  if (c.dataSource === "auto") return c.apiUrl ? "platform" : "mock";
  return c.dataSource;
}
