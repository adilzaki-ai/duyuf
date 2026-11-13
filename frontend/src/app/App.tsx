import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { startDataSource, type StartedSource } from "../api/createDataSource";
import { AnalystPage } from "../features/analyst/AnalystPage";
import { ArrivalsPage } from "../features/arrivals/ArrivalsPage";
import { FlightPage } from "../features/arrivals/FlightPage";
import { ResourcesPage } from "../features/arrivals/ResourcesPage";
import { GroupPage } from "../features/groups/GroupPage";
import { IncidentsPage } from "../features/incidents/IncidentsPage";
import { GroupsPage } from "../features/groups/GroupsPage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { PilgrimsPage } from "../features/pilgrims/PilgrimsPage";
import { LangProvider, t } from "../i18n";
import { Shell } from "../layout/Shell";
import { SessionProvider } from "./SessionContext";

type Start = () => Promise<StartedSource>;

export function App({ start = startDataSource }: { start?: Start }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } } }),
  );
  const [session, setSession] = useState<StartedSource | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    start().then(setSession, (err: unknown) => setFailure(err instanceof Error ? err.message : String(err)));
  }, [start]);

  return (
    <LangProvider>
      {failure ? (
        <p className="boot">{t("Could not load: {reason}", { reason: failure })}</p>
      ) : !session ? (
        <p className="boot">{t("Loading…")}</p>
      ) : (
        <QueryClientProvider client={queryClient}>
          <SessionProvider value={session}>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="arrivals" element={<ArrivalsPage />} />
                  <Route path="arrivals/resources" element={<ResourcesPage />} />
                  <Route path="arrivals/:id" element={<FlightPage />} />
                  <Route path="groups" element={<GroupsPage />} />
                  <Route path="groups/:id" element={<GroupPage />} />
                  <Route path="pilgrims" element={<PilgrimsPage />} />
                  <Route path="incidents" element={<IncidentsPage />} />
                  <Route path="analyst" element={<AnalystPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SessionProvider>
        </QueryClientProvider>
      )}
    </LangProvider>
  );
}
