import { useAiAdvice, useAiStatus } from "../../api/queries";
import { u } from "../../design/ui";
import type { AiGap, ExtraResource } from "../../domain/types";
import { getLang, languageName, t } from "../../i18n";
import ai from "./ai.module.css";
import { Spark } from "./BriefCard";

const KIND_EN = { wheelchair: "Wheelchairs", bus: "Buses", interpreter: "Interpreters" } as const;

function gapText(g: AiGap): string {
  const what = g.kind === "interpreter" && g.language ? `${t(KIND_EN[g.kind])} (${languageName(g.language)})` : t(KIND_EN[g.kind]);
  return t("{airport} · {from} · short {n} {what}", { airport: g.airport, from: g.from, n: g.short, what });
}

/**
 * The arrival plan advisor: Claude explains each gap on the board in plain
 * words and proposes the cheapest fix. A fix that adds resources can be
 * previewed on the board (the what-if view): nothing is saved; the planner
 * decides and adds the shifts.
 */
export function Advisor({ hours, onPreview }: { hours: number; onPreview: (extra: ExtraResource[]) => void }) {
  const status = useAiStatus();
  const advice = useAiAdvice();
  if (!status.data?.ready) return null;
  const a = advice.data;
  const fixes = (a?.items ?? []).map((i) => i.extra).filter((x): x is ExtraResource => !!x);
  return (
    <section className={ai.card} style={{ marginBottom: 16 }}>
      <div className={ai.cardHead}>
        <span className={ai.badge}>
          <Spark /> {t("AI plan advisor")}
        </span>
        <button type="button" className={`${u.button} ${a ? u.quiet : ""} ${ai.small}`} disabled={advice.isPending} onClick={() => advice.mutate({ language: getLang(), hours })}>
          {advice.isPending ? t("Reading the board…") : a ? t("Ask again") : t("Explain the gaps")}
        </button>
      </div>
      {advice.isError && <p className={u.error}>{(advice.error as Error).message}</p>}
      {!a && !advice.isPending && !advice.isError && <p className={ai.foot}>{t("Explains each gap in plain words, with a fix you can preview on the board.")}</p>}
      {advice.isPending && (
        <div className={ai.skeleton}>
          <i />
          <i />
          <i />
        </div>
      )}
      {a && !advice.isPending && (
        <>
          {a.gaps.length === 0 ? (
            <p className={ai.lead}>{t("No gaps on the board. Nothing to fix.")}</p>
          ) : (
            <>
              {a.summary && <p className={ai.lead}>{a.summary}</p>}
              <ol className={ai.gaps}>
                {a.items.map((it) => (
                  <li key={it.gap}>
                    <span className={`${ai.tone} ${ai.act}`}>{gapText(it.of)}</span>
                    <p>{it.explain}</p>
                    <p>
                      <b>{t("Fix:")}</b> {it.fix}
                    </p>
                    {it.extra && (
                      <button type="button" className={`${u.button} ${u.quiet} ${ai.small}`} onClick={() => onPreview([it.extra!])}>
                        {t("Preview this fix")}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
              {fixes.length > 1 && (
                <button type="button" className={u.button} onClick={() => onPreview(fixes)}>
                  {t("Preview all fixes")}
                </button>
              )}
            </>
          )}
          <p className={ai.foot}>{t("Advice from Claude. Preview it on the board; nothing is saved until you add the shifts.")}</p>
        </>
      )}
    </section>
  );
}

/** Labels the table above passes to t(), for the Arabic coverage test. */
export const ADVISOR_LABELS_EN = Object.values(KIND_EN);
