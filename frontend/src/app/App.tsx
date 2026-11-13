import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DataSourceError } from "../api/dataSource";
import { startDataSource, type StartedSource } from "../api/createDataSource";
import { AccountPage, StaffPage } from "../features/account/StaffPage";
import { ChangePassword } from "../features/account/ChangePassword";
import { SignInPage } from "../features/account/SignInPage";
import accountStyles from "../features/account/account.module.css";
import { AnalystPage } from "../features/analyst/AnalystPage";
import { ArrivalsPage } from "../features/arrivals/ArrivalsPage";
import { FlightPage } from "../features/arrivals/FlightPage";
import { ResourcesPage } from "../features/arrivals/ResourcesPage";
import { GroupPage } from "../features/groups/GroupPage";
import { GroupsPage } from "../features/groups/GroupsPage";
import { IncidentsPage } from "../features/incidents/IncidentsPage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { PilgrimsPage } from "../features/pilgrims/PilgrimsPage";
import { u } from "../design/ui";
import type { Me } from "../domain/types";
import { LangProvider, t } from "../i18n";
import { Shell } from "../layout/Shell";
import { SessionProvider, type Session } from "./SessionContext";

type Start = () => Promise<StartedSource>;

export function App({ start = startDataSource }: { start?: Start }) {
  const [started, setStarted] = useState<StartedSource | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  /* the platform said the session is over (it expired, or an administrator switched it off) */
  const ended = useRef<() => void>(() => {});
  const [queryClient] = useState(() => {
    const onError = (err: unknown) => {
      if (err instanceof DataSourceError && err.status === 401) ended.current();
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
    });
  });

  useEffect(() => {
    start().then(setStarted, (err: unknown) => setFailure(err instanceof Error ? err.message : String(err)));
  }, [start]);

  const signedOut = () => {
    queryClient.clear();
    setStarted((s) => (s ? { ...s, me: null } : s));
  };
  ended.current = () => {
    /* only a signed-in session can end; a key or the sample never does */
    if (started?.me?.via === "session") signedOut();
  };
  const setMe = (me: Me) => setStarted((s) => (s ? { ...s, me } : s));

  let body;
  if (failure) body = <p className="boot">{t("Could not load: {reason}", { reason: failure })}</p>;
  else if (!started) body = <p className="boot">{t("Loading…")}</p>;
  else if (!started.me) body = <SignInPage source={started.source} onSignedIn={setMe} />;
  else if (started.me.principal.must_change_password)
    body = (
      <main className={accountStyles.door}>
        <section className={`${u.card} ${accountStyles.box}`}>
          <h1>{t("Choose a password")}</h1>
          <ChangePassword source={started.source} onChanged={setMe} forced />
          <button
            type="button"
            className={`${u.button} ${u.quiet}`}
            onClick={() => void started.source.signOut().finally(signedOut)}
          >
            {t("Sign out")}
          </button>
        </section>
      </main>
    );
  else {
    const session: Session = { ...started, me: started.me, signedOut, updateMe: setMe };
    body = (
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
                <Route path="staff" element={<StaffPage />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </QueryClientProvider>
    );
  }
  return <LangProvider>{body}</LangProvider>;
}
