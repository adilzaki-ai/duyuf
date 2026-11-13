import { useState, type FormEvent, type ReactNode } from "react";
import { useAnalystRecent, useAnalystStatus, useAsk } from "../../api/queries";
import { useSession } from "../../app/SessionContext";
import { Failed, Loading, PageHead, u } from "../../design/ui";
import type { AnalystAnswer, AnalystChart } from "../../domain/types";
import { fmtDateTime, fmtNum, getLang, t } from "../../i18n";
import s from "./analyst.module.css";

const EXAMPLES: Record<"en" | "ar", string[]> = {
  en: [
    "How many pilgrims over 70 land in Madinah tomorrow?",
    "Which flights are short of wheelchairs or interpreters?",
    "How many urgent incidents are open, and how long have they waited?",
    "Which groups land this week with pilgrims still on no flight?",
  ],
  ar: [
    "كم عدد الحجاج فوق السبعين الذين يصلون المدينة غدًا؟",
    "أي الرحلات ينقصها كراسي متحركة أو مترجمون؟",
    "كم بلاغًا عاجلًا مفتوحًا الآن، وكم انتظر؟",
    "ما المجموعات التي تصل هذا الأسبوع وفيها ضيوف بلا رحلة؟",
  ],
};

const SOURCE_EN: Record<string, string> = {
  count_pilgrims: "Counted pilgrims",
  arrivals_board: "Read the arrivals board",
  incidents: "Read the incidents",
  list_groups: "Listed the groups",
  resources_on_shift: "Read the resources on shift",
};

/** **bold** inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part,
  );
}

/** The answer as written: paragraphs, and "- " lines as a list. Each block finds its own direction. */
function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={s.prose}>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l)))
          return (
            <ul key={i} dir="auto">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} dir="auto">
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** One series: horizontal bars, the value at each bar's end. The title names it, so no legend. */
function Chart({ c }: { c: AnalystChart }) {
  const top = Math.max(...c.values, 0) || 1;
  return (
    <figure className={s.chart}>
      <figcaption dir="auto">
        {c.title}
        {c.unit && <span className={u.muted}> · {c.unit}</span>}
      </figcaption>
      <div className={s.bars} role="table" aria-label={c.title}>
        {c.labels.map((label, i) => (
          <div key={`${label}-${i}`} className={s.barRow} role="row">
            <span className={s.barLabel} role="rowheader" dir="auto">
              {label}
            </span>
            <span className={s.barTrack} role="cell">
              <span className={s.bar} style={{ width: `${Math.max(0.5, (100 * (c.values[i] ?? 0)) / top)}%` }} />
              <span className={s.barValue}>{fmtNum(c.values[i] ?? 0)}</span>
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

function AnswerCard({ a }: { a: AnalystAnswer }) {
  return (
    <article className={`${u.card} ${s.answer}`}>
      <p className={s.question} dir="auto">
        {a.question}
      </p>
      {a.outcome === "failed" ? (
        <p className={u.error}>{t("This question did not get an answer.")}</p>
      ) : (
        <Prose text={a.answer ?? ""} />
      )}
      {a.charts.map((c, i) => (
        <Chart key={i} c={c} />
      ))}
      <p className={s.meta}>
        {t("Asked by {who}", { who: a.asked_by })} · {fmtDateTime(a.asked_at)}
        {a.seconds != null && <> · {t("{n} s", { n: Math.round(a.seconds) })}</>} · {t("From totals only. Advice; you decide.")}
      </p>
      {a.sources.length > 0 && (
        <details className={s.sources}>
          <summary>{t("How this was worked out ({n} looks at the data)", { n: a.sources.length })}</summary>
          <ol>
            {a.sources.map((src, i) => (
              <li key={i}>
                <b>{t(SOURCE_EN[src.tool] ?? src.tool)}</b>
                {Object.keys(src.input).length > 0 && (
                  <code className={s.input} dir="ltr">
                    {JSON.stringify(src.input)}
                  </code>
                )}
                <pre className={s.result} dir="ltr">
                  {JSON.stringify(src.result, null, 1).slice(0, 4000)}
                </pre>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

export function AnalystPage() {
  const { source } = useSession();
  const status = useAnalystStatus();
  const recent = useAnalystRecent();
  const ask = useAsk();
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<AnalystAnswer[]>([]);
  const lang = getLang() === "ar" ? "ar" : "en";
  const ready = status.data?.ready === true;

  const send = (q: string) => {
    const text = q.trim();
    if (!text || ask.isPending) return;
    const history = thread
      .filter((x) => x.outcome === "answered" && x.answer)
      .slice(-4)
      .map((x) => ({ question: x.question, answer: x.answer! }));
    ask.mutate(
      { question: text, history },
      {
        onSuccess: (a) => {
          setThread((th) => [...th, a]);
          setQuestion("");
        },
      },
    );
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(question);
  };

  return (
    <>
      <PageHead title={t("Analyst")} sub={t("Ask about your pilgrims, flights and incidents.")}>
        {thread.length > 0 && (
          <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setThread([])}>
            {t("New conversation")}
          </button>
        )}
      </PageHead>

      {status.isPending ? (
        <Loading />
      ) : !ready ? (
        <section className={`${u.card} ${s.notice}`}>
          <h2>{t("The analyst is not available here")}</h2>
          <p>
            {source.kind === "mock"
              ? t("It needs the platform. Sample mode does not send questions out.")
              : t("The server has no key for the analyst yet. Set ANTHROPIC_API_KEY in backend/.env.local and restart it.")}
          </p>
        </section>
      ) : null}

      <div className={s.layout}>
        <div>
          {thread.map((a) => (
            <AnswerCard key={a.id} a={a} />
          ))}
          {ask.isPending && (
            <article className={`${u.card} ${s.answer}`} aria-busy="true">
              <p className={s.question} dir="auto">
                {ask.variables?.question}
              </p>
              <p className={u.muted}>{t("Working it out. This can take up to a minute.")}</p>
            </article>
          )}

          <form className={`${u.card} ${s.ask}`} onSubmit={submit}>
            <label htmlFor="duyuf-ask" className={s.askLabel}>
              {thread.length ? t("Ask a follow-up") : t("Your question")}
            </label>
            <textarea
              id="duyuf-ask"
              rows={2}
              dir="auto"
              maxLength={2000}
              value={question}
              disabled={!ready}
              placeholder={EXAMPLES[lang][0]}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(question);
                }
              }}
            />
            <div className={s.askRow}>
              <button type="submit" className={u.button} disabled={!ready || !question.trim() || ask.isPending}>
                {t("Ask")}
              </button>
              <span className={u.muted}>{t("The analyst sees totals, never names or passports.")}</span>
            </div>
            {ask.isError && <p className={u.error}>{ask.error.message}</p>}
            {thread.length === 0 && (
              <div className={s.examples}>
                {EXAMPLES[lang].map((x) => (
                  <button key={x} type="button" className={s.example} disabled={!ready || ask.isPending} onClick={() => send(x)}>
                    {x}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        <aside className={u.card}>
          <h2>{t("Asked lately")}</h2>
          <p className={u.hint}>{t("Every question is kept, with its answer.")}</p>
          {recent.isPending ? (
            <Loading />
          ) : recent.isError ? (
            <Failed error={recent.error} />
          ) : recent.data.length === 0 ? (
            <p className={u.muted}>{t("No questions yet.")}</p>
          ) : (
            <ul className={s.recent}>
              {recent.data.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setThread((th) => (th.some((x) => x.id === r.id) ? th : [...th, r]))}>
                    <span dir="auto">{r.question}</span>
                    <span className={u.sub}>
                      {r.asked_by} · {fmtDateTime(r.asked_at)}
                      {r.outcome !== "answered" && ` · ${t("no answer")}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}

/** For the Arabic coverage test: English passed to t() through a table. */
export const ANALYST_LABELS_EN = Object.values(SOURCE_EN);
