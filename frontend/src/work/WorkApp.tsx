import { useEffect, useState } from "react";
import { DataSourceError } from "../api/dataSource";
import { HttpClient } from "../api/http";
import { config, resolvedDataSource } from "../config/env";
import { DuyufMark } from "../design/DuyufMark";
import { airportName } from "../domain/airports";
import { roleLabel, type RequestStatus, type Role } from "../domain/dispatch";
import { fmtDateTime, languageName, LangProvider, t, useLang } from "../i18n";
import w from "./work.module.css";

/**
 * The page a person opens from the request they were sent (/w#wk_…): who is
 * asking, what, where and when; Accept or Decline; and on the day, "I'm here"
 * at the airport. The link opens this one request and nothing else.
 */

export interface MyRequest {
  operator: string;
  operator_ar: string | null;
  first_name: string;
  first_name_ar: string | null;
  kind: Role;
  language: string | null;
  airport: string;
  starts_at: string;
  ends_at: string;
  status: RequestStatus;
  answer_by: string;
  can_answer: boolean;
  can_arrive: boolean;
  is_demo: boolean;
}

interface WorkSource {
  me(): Promise<MyRequest>;
  answer(accept: boolean): Promise<MyRequest>;
  arrived(): Promise<MyRequest>;
}

function token(): string | null {
  const h = (globalThis.location?.hash ?? "").slice(1);
  return h.startsWith("wk_") ? h : null;
}

class PlatformWork implements WorkSource {
  private readonly http: HttpClient;
  constructor(tok: string) {
    this.http = new HttpClient({ baseUrl: config.apiUrl, apiKey: tok, timeoutMs: 12_000 });
  }
  me() {
    return this.http.get<MyRequest>("/v1/work/me");
  }
  answer(accept: boolean) {
    return this.http.post<MyRequest>("/v1/work/answer", { accept });
  }
  arrived() {
    return this.http.post<MyRequest>("/v1/work/arrived");
  }
}

/** The sample's link carries its own request (see mockSource); answers stay on this page. */
class SampleWork implements WorkSource {
  private r: MyRequest;
  constructor(tok: string) {
    const raw = tok.replace(/^wk_sample\./, "").replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const x = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, string | null>;
    this.r = {
      operator: x.o ?? "",
      operator_ar: x.oa ?? null,
      first_name: x.n ?? "",
      first_name_ar: x.na || null,
      kind: x.k as Role,
      language: x.l,
      airport: x.a ?? "",
      starts_at: x.s ?? "",
      ends_at: x.e ?? "",
      status: "asked",
      answer_by: new Date(Date.now() + 30 * 60_000).toISOString(),
      can_answer: true,
      can_arrive: false,
      is_demo: true,
    };
  }
  async me() {
    return { ...this.r };
  }
  async answer(accept: boolean) {
    if (!this.r.can_answer) throw new DataSourceError("this request can no longer be answered; call the office", { status: 409 });
    /* in the sample "I'm here" can be tried at once; the platform allows it from two hours before */
    this.r = { ...this.r, status: accept ? "accepted" : "declined", can_answer: false, can_arrive: accept };
    return this.me();
  }
  async arrived() {
    this.r = { ...this.r, status: "arrived", can_arrive: false };
    return this.me();
  }
}

/* made once, above the language switch (which rebuilds the page), so an answer survives it */
function makeSource(): WorkSource | null {
  const tok = token();
  if (!tok) return null;
  return tok.startsWith("wk_sample.") || resolvedDataSource() === "mock" ? new SampleWork(tok) : new PlatformWork(tok);
}

export function WorkApp() {
  const [src] = useState(makeSource);
  return (
    <LangProvider>
      <WorkPage src={src} />
    </LangProvider>
  );
}

function WorkPage({ src }: { src: WorkSource | null }) {
  const { lang, setLang } = useLang();
  const [r, setR] = useState<MyRequest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = t("Duyuf: your shift");
  }, [lang]);

  useEffect(() => {
    if (!src) return;
    src.me().then(setR, (e: unknown) => setErr(e instanceof DataSourceError && e.status === 401 ? t("This link no longer works. Call the office.") : t("Cannot connect. Try again in a moment.")));
  }, [src]);

  const act = async (go: (s: WorkSource) => Promise<MyRequest>) => {
    if (!src) return;
    setBusy(true);
    setErr(null);
    try {
      setR(await go(src));
    } catch (e) {
      setErr(e instanceof DataSourceError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const ar = lang === "ar";
  const what = r ? roleLabel(r.kind) + (r.language ? ` (${languageName(r.language)})` : "") : "";
  return (
    <div className={w.page} dir={ar ? "rtl" : "ltr"} lang={lang}>
      <header className={w.top}>
        <span className={w.brand}>
          <DuyufMark size={34} />
          <b>{r ? (ar && r.operator_ar) || r.operator : t("Duyuf")}</b>
        </span>
        <button type="button" className={w.lang} onClick={() => setLang(ar ? "en" : "ar")}>
          {ar ? "English" : "العربية"}
        </button>
      </header>
      <main className={w.main}>
        {r?.is_demo && <p className={w.banner}>{t("Demonstration: nothing is sent to the office.")}</p>}
        {!src ? (
          <p className={w.lead}>{t("Open the link you were sent to see your request.")}</p>
        ) : !r ? (
          <p className={w.lead}>{err ?? "…"}</p>
        ) : (
          <>
            <h1 className={w.hello}>{t("Assalamu alaikum, {name}", { name: (ar && r.first_name_ar) || r.first_name })}</h1>
            <section className={w.card}>
              <p className={w.ask}>{t("Can you work this shift?")}</p>
              <dl className={w.facts}>
                <dt>{t("As")}</dt>
                <dd>{what}</dd>
                <dt>{t("Where")}</dt>
                <dd>{airportName(r.airport)}</dd>
                <dt>{t("From")}</dt>
                <dd>{fmtDateTime(r.starts_at)}</dd>
                <dt>{t("Until")}</dt>
                <dd>{fmtDateTime(r.ends_at)}</dd>
              </dl>
              <p className={`${w.status} ${w[`st_${r.status}`] ?? ""}`}>{statusLine(r)}</p>
              {r.can_answer && (
                <>
                  <p className={w.quiet}>{t("Please answer by {time}.", { time: fmtDateTime(r.answer_by) })}</p>
                  <div className={w.two}>
                    <button type="button" className={`${w.big} ${w.yes}`} disabled={busy} onClick={() => void act((s) => s.answer(true))}>
                      {t("Yes, I can")}
                    </button>
                    <button type="button" className={`${w.big} ${w.no}`} disabled={busy} onClick={() => void act((s) => s.answer(false))}>
                      {t("No, I can't")}
                    </button>
                  </div>
                </>
              )}
              {r.can_arrive && (
                <button type="button" className={`${w.big} ${w.here}`} disabled={busy} onClick={() => void act((s) => s.arrived())}>
                  {t("I'm here at the airport")}
                </button>
              )}
              {r.status === "accepted" && !r.can_arrive && <p className={w.quiet}>{t("On the day, open this link and press I'm here when you arrive.")}</p>}
            </section>
            {err && (
              <p className={w.err} role="alert">
                {err}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function statusLine(r: MyRequest): string {
  switch (r.status) {
    case "asked":
      return r.can_answer ? t("Waiting for your answer.") : t("The time to answer has passed. Call the office.");
    case "accepted":
      return t("Thank you. You are on this shift.");
    case "arrived":
      return t("Thank you. The office knows you are here.");
    case "declined":
      return t("You said no. Thank you for answering.");
    case "expired":
      return t("The time to answer has passed. Call the office.");
    case "cancelled":
      return t("The office no longer needs you for this shift. Thank you.");
  }
}
