import { useState } from "react";
import { Link } from "react-router-dom";
import { useIncident, useIncidentStep } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { Failed, Loading, u } from "../../design/ui";
import { incidentStatusLabel } from "../../domain/incidents";
import type { IncidentEvent } from "../../domain/types";
import { fmtDateTime, t } from "../../i18n";
import p from "../pilgrims/pilgrims.module.css";
import s from "./incidents.module.css";
import { kindText, PriorityChip, since } from "./parts";

function eventText(e: IncidentEvent): string {
  switch (e.kind) {
    case "opened":
      return t("Raised");
    case "assigned":
      return t("Given to {team}", { team: e.team ?? "" });
    case "resolved":
      return t("Resolved");
    case "reopened":
      return t("Opened again");
    default:
      return t("Note");
  }
}

/** One incident: what, who, where, the steps so far, and the next ones. */
export function IncidentPanel({ id, teams, onClose }: { id: string; teams: string[]; onClose: () => void }) {
  const q = useIncident(id);
  const step = useIncidentStep(id);
  const canWork = useCan("incident:write");
  const [team, setTeam] = useState("");
  const [text, setText] = useState("");
  const done = () => {
    setTeam("");
    setText("");
  };

  return (
    <aside className={`${u.card} ${p.panel}`} aria-label={q.data ? `#${q.data.ref}` : undefined}>
      <button type="button" className={p.close} onClick={onClose} aria-label={t("Close")}>
        ×
      </button>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failed error={q.error} />
      ) : (
        <>
          <h2>
            #{q.data.ref} · {kindText(q.data.kind)}
          </h2>
          <p style={{ margin: "8px 0" }}>
            <PriorityChip priority={q.data.priority} /> <span className={u.chip}>{incidentStatusLabel(q.data.status)}</span>
          </p>
          <p className={s.text} dir="auto">
            {q.data.description}
          </p>
          {q.data.from_rafeeq && <p className={u.hint}>{t("Sent by the pilgrim from their Rafeeq page.")}</p>}
          {q.data.pilgrim_ok_at && q.data.status !== "resolved" && (
            <p className={`${s.tag} ${s.fine}`}>{t("The pilgrim said they are fine at {time}.", { time: fmtDateTime(q.data.pilgrim_ok_at) })}</p>
          )}
          <ul className={u.list} style={{ marginTop: 10 }}>
            {q.data.pilgrim_name && (
              <li>
                <span>{t("Pilgrim")}</span>
                <span>{q.data.pilgrim_name}</span>
              </li>
            )}
            {q.data.group_id && (
              <li>
                <span>{t("Group")}</span>
                <span>
                  <Link to={`/groups/${q.data.group_id}`}>{q.data.group_name}</Link>{" "}
                  <span className={u.mono}>{q.data.group_code}</span>
                </span>
              </li>
            )}
            {q.data.leader_phone && (
              <li>
                <span>{t("Leader phone")}</span>
                <a className={u.mono} dir="ltr" href={`tel:${q.data.leader_phone.replace(/\s+/g, "")}`}>
                  {q.data.leader_phone}
                </a>
              </li>
            )}
            <li>
              <span>{t("Where")}</span>
              <span dir="auto">
                {q.data.location ?? "—"}
                {mapLink(q.data.location) && (
                  <>
                    {" "}
                    <a href={mapLink(q.data.location)!} target="_blank" rel="noreferrer">
                      {t("Open map")}
                    </a>
                  </>
                )}
              </span>
            </li>
            <li>
              <span>{t("Team")}</span>
              <span dir="auto">{q.data.team ?? "—"}</span>
            </li>
            <li>
              <span>{t("Raised")}</span>
              <span>
                {fmtDateTime(q.data.opened_at)} · {t("{ago} ago", { ago: since(q.data.opened_at) })}
              </span>
            </li>
          </ul>
          {q.data.resolution && (
            <>
              <h3 className={p.h3}>{t("How it was resolved")}</h3>
              <p className={s.text} dir="auto">
                {q.data.resolution}
              </p>
            </>
          )}

          {canWork && (
            <div className={s.panelActions}>
              <h3 className={p.h3} style={{ marginBottom: 0 }}>
                {t("Next step")}
              </h3>
              {q.data.allowed.includes("assign") && (
                <>
                  <input
                    list="duyuf-teams"
                    value={team}
                    placeholder={t("Team, e.g. Madinah field team")}
                    aria-label={t("Team")}
                    onChange={(e) => setTeam(e.target.value)}
                  />
                  <datalist id="duyuf-teams">
                    {teams.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </>
              )}
              <textarea
                rows={2}
                value={text}
                placeholder={
                  q.data.status === "resolved" ? t("Why open it again?") : t("Note, or how it was resolved")
                }
                aria-label={t("Note")}
                onChange={(e) => setText(e.target.value)}
              />
              <div className={s.buttons}>
                {q.data.allowed.includes("assign") && (
                  <button
                    type="button"
                    className={u.button}
                    disabled={!team.trim() || step.isPending}
                    onClick={() => step.mutate({ action: "assign", team, text }, { onSuccess: done })}
                  >
                    {q.data.team ? t("Give to another team") : t("Give to team")}
                  </button>
                )}
                {q.data.allowed.includes("resolve") && (
                  <button
                    type="button"
                    className={u.button}
                    disabled={!text.trim() || step.isPending}
                    onClick={() => step.mutate({ action: "resolve", text }, { onSuccess: done })}
                  >
                    {t("Resolve")}
                  </button>
                )}
                {q.data.allowed.includes("reopen") && (
                  <button
                    type="button"
                    className={u.button}
                    disabled={!text.trim() || step.isPending}
                    onClick={() => step.mutate({ action: "reopen", text }, { onSuccess: done })}
                  >
                    {t("Open again")}
                  </button>
                )}
                <button
                  type="button"
                  className={`${u.button} ${u.quiet}`}
                  disabled={!text.trim() || step.isPending}
                  onClick={() => step.mutate({ action: "note", text }, { onSuccess: done })}
                >
                  {t("Add note")}
                </button>
              </div>
              {step.isError && <p className={u.error}>{step.error.message}</p>}
            </div>
          )}

          <h3 className={p.h3}>{t("History")}</h3>
          <ol className={p.history}>
            {[...q.data.history].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <b>{eventText(e)}</b>
                <span className={u.sub}>
                  {fmtDateTime(e.at)} · {t("by {who}", { who: e.actor })}
                </span>
                {e.note && (
                  <span className={u.sub} dir="auto">
                    “{e.note}”
                  </span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
}

/** A map for a place the pilgrim's phone gave ("24.46720, 39.61120 (±25 m)"); none for words staff typed. */
export function mapLink(location: string | null): string | null {
  const m = /^\s*(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(location ?? "");
  return m ? `https://www.google.com/maps/search/?api=1&query=${m[1]},${m[2]}` : null;
}
