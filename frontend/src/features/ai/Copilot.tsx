import { useState } from "react";
import { useAiCopilot, useAiStatus, useIncidentStep } from "../../api/queries";
import { u } from "../../design/ui";
import { priorityLabel } from "../../domain/incidents";
import type { AiMessage, IncidentDetail } from "../../domain/types";
import { getLang, languageName, t } from "../../i18n";
import ai from "./ai.module.css";
import { Spark } from "./BriefCard";

/**
 * The incident co-pilot: Claude reads this one incident and says whether the
 * priority is right, who should take it and what they do first, and drafts a
 * message to the group leader and one to the pilgrim, in the pilgrim's
 * language with an English version to check. Nothing is sent: the desk copies
 * a message, or gives the incident to the suggested team with one press.
 */
export function Copilot({ incident }: { incident: IncidentDetail }) {
  const status = useAiStatus();
  const help = useAiCopilot();
  const step = useIncidentStep(incident.id);
  if (!status.data?.ready || incident.status === "resolved") return null;
  const c = help.data;
  const canGive = c && incident.allowed.includes("assign") && c.team.trim() && c.team !== incident.team;
  return (
    <section className={`${ai.card} ${ai.inPanel}`}>
      <div className={ai.cardHead}>
        <span className={ai.badge}>
          <Spark /> {t("Co-pilot")}
        </span>
        {!help.isPending && (
          <button type="button" className={`${u.button} ${c ? u.quiet : ""} ${ai.small}`} onClick={() => help.mutate({ id: incident.id, language: getLang() })}>
            {c ? t("Ask again") : t("Ask the co-pilot")}
          </button>
        )}
      </div>
      {help.isPending && (
        <div className={ai.skeleton} aria-label={t("Reading the incident…")}>
          <i />
          <i />
        </div>
      )}
      {help.isError && <p className={u.error}>{(help.error as Error).message}</p>}
      {!c && !help.isPending && !help.isError && <p className={ai.foot}>{t("Suggests the team and next step, and drafts messages in the pilgrim's language.")}</p>}
      {c && !help.isPending && (
        <>
          <p className={ai.lead}>{c.summary}</p>
          <ul className={ai.facts}>
            <li>
              <span>{t("Priority")}</span>
              <b className={c.priority_ok ? ai.okText : ai.actText}>
                {c.priority_ok ? t("Looks right") : t("Suggest: {p}", { p: priorityLabel(c.suggested_priority) })}
              </b>
            </li>
            <li>
              <span>{t("Team")}</span>
              <b dir="auto">{c.team}</b>
            </li>
            <li>
              <span>{t("Next step")}</span>
              <span dir="auto">{c.next_step}</span>
            </li>
          </ul>
          {canGive && (
            <button
              type="button"
              className={u.button}
              disabled={step.isPending}
              onClick={() => step.mutate({ action: "assign", team: c.team, text: t("Suggested by the co-pilot: {s}", { s: c.next_step }) })}
            >
              {t("Give to {team}", { team: c.team })}
            </button>
          )}
          <Message title={t("To the group leader")} m={c.message_to_leader} />
          <Message title={t("To the pilgrim")} m={c.message_to_pilgrim} />
          <p className={ai.foot}>{t("Drafted by Claude. Check it before you send it.")}</p>
        </>
      )}
    </section>
  );
}

function Message({ title, m }: { title: string; m: AiMessage }) {
  const [english, setEnglish] = useState(false);
  const [copied, setCopied] = useState(false);
  const isEnglish = m.language === "en";
  return (
    <div className={ai.message}>
      <div className={ai.messageHead}>
        <b>{title}</b>
        <span className={u.muted}>{languageName(m.language)}</span>
      </div>
      <p dir="auto" lang={english ? "en" : m.language}>
        {english ? m.english : m.text}
      </p>
      <div className={ai.messageTools}>
        <button
          type="button"
          className={`${u.button} ${u.quiet} ${ai.small}`}
          onClick={() =>
            void navigator.clipboard?.writeText(m.text).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? t("Copied") : t("Copy")}
        </button>
        {!isEnglish && (
          <button type="button" className={`${u.button} ${u.quiet} ${ai.small}`} onClick={() => setEnglish((e) => !e)}>
            {english ? t("Show the original") : t("Show in English")}
          </button>
        )}
      </div>
    </div>
  );
}
