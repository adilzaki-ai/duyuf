import { Link } from "react-router-dom";
import { useAiBrief, useAiStatus, useRefreshAiBrief } from "../../api/queries";
import { u } from "../../design/ui";
import type { AiScreen } from "../../domain/types";
import { getLang, t } from "../../i18n";
import ai from "./ai.module.css";

const SCREEN_PATH: Record<AiScreen, string> = {
  overview: "/",
  arrivals: "/arrivals",
  resources: "/arrivals/resources",
  incidents: "/incidents",
  health: "/health",
  groups: "/groups",
  pilgrims: "/pilgrims",
};
const TONE_EN = { act: "Act now", watch: "Watch", ok: "Good" } as const;

/** Labels the table above passes to t(), for the Arabic coverage test. */
export const BRIEF_LABELS_EN = Object.values(TONE_EN);

export const Spark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={ai.spark}>
    <path d="M12 2.5l2 5.6 5.6 2-5.6 2-2 5.6-2-5.6-5.6-2 5.6-2zM19 15l.9 2.3 2.3.9-2.3.9L19 21.4l-.9-2.3-2.3-.9 2.3-.9z" fill="currentColor" />
  </svg>
);

/**
 * The shift briefing at the top of the Overview: Claude reads today's totals
 * (never a person) and says what matters, most urgent first, with where to go
 * to act. Reused for ten minutes; Refresh asks again.
 */
export function BriefCard() {
  const status = useAiStatus();
  const lang = getLang();
  const q = useAiBrief(lang, !!status.data?.ready);
  const refresh = useRefreshAiBrief(lang);
  if (status.isPending || !status.data) return null;
  if (!status.data.ready)
    return (
      <section className={`${ai.card} ${ai.off}`}>
        <span className={ai.badge}>
          <Spark /> {t("AI briefing")}
        </span>
        <p className={u.muted} style={{ margin: 0 }}>
          {t("The AI helpers are not set up on this server yet. An administrator adds the Claude API key.")}
        </p>
      </section>
    );
  const b = refresh.data ?? q.data;
  const busy = q.isFetching || refresh.isPending;
  return (
    <section className={ai.card} aria-busy={busy}>
      <div className={ai.cardHead}>
        <span className={ai.badge}>
          <Spark /> {t("AI briefing")}
        </span>
        <button type="button" className={`${u.button} ${u.quiet} ${ai.small}`} disabled={busy} onClick={() => refresh.mutate()}>
          {busy ? t("Reading today's totals…") : t("Refresh")}
        </button>
      </div>
      {!b ? (
        q.isError ? (
          <p className={u.error}>{(q.error as Error).message}</p>
        ) : (
          <div className={ai.skeleton} aria-label={t("Reading today's totals…")}>
            <i />
            <i />
            <i />
          </div>
        )
      ) : (
        <>
          <h2 className={ai.headline}>{b.headline}</h2>
          <ul className={ai.points}>
            {b.points.map((p, i) => (
              <li key={i}>
                <span className={`${ai.tone} ${ai[p.tone]}`}>{t(TONE_EN[p.tone])}</span>
                <span className={ai.pointText}>{p.text}</span>
                <Link to={SCREEN_PATH[p.screen]} className={ai.go}>
                  {t("Open")}
                </Link>
              </li>
            ))}
          </ul>
          <Link to={SCREEN_PATH[b.first_action.screen]} className={ai.first}>
            <b>{t("Do first:")}</b> {b.first_action.text}
          </Link>
          {refresh.isError && <p className={u.error}>{(refresh.error as Error).message}</p>}
          <p className={ai.foot}>{t("Advice from Claude, read from today's totals only. A person decides.")}</p>
        </>
      )}
    </section>
  );
}
