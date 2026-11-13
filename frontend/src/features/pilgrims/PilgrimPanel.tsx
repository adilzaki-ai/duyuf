import { useState } from "react";
import { Link } from "react-router-dom";
import { useMovePilgrim, usePilgrim } from "../../api/queries";
import { EditPilgrim } from "./PilgrimForm";
import { useCan } from "../../app/SessionContext";
import { Failed, Loading, StatusChip, u } from "../../design/ui";
import { needLabel, statusLabel } from "../../domain/labels";
import { countryName, fmtDate, fmtDateTime, languageName, t } from "../../i18n";
import p from "./pilgrims.module.css";

/** One pilgrim: who they are, the journey so far, and the next steps allowed. */
export function PilgrimPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const q = usePilgrim(id);
  const move = useMovePilgrim();
  const canMove = useCan("pilgrim:status");
  const canEdit = useCan("pilgrim:write");
  const canReport = useCan("incident:write");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <aside className={`${u.card} ${p.panel}`} aria-label={q.data?.full_name}>
      <button type="button" className={p.close} onClick={onClose} aria-label={t("Close")}>
        ×
      </button>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failed error={q.error} />
      ) : (
        <>
          <h2>{q.data.full_name}</h2>
          {canEdit && editing !== id && (
            <button type="button" className={`${u.button} ${u.quiet}`} style={{ marginTop: 6 }} onClick={() => setEditing(id)}>
              {t("Edit")}
            </button>
          )}
          {editing === id && <EditPilgrim key={id} p={q.data} onClose={() => setEditing(null)} />}
          {canReport && editing !== id && (
            <Link
              to={`/incidents?pilgrim=${encodeURIComponent(id)}`}
              className={`${u.button} ${u.quiet}`}
              style={{ marginTop: 6, marginInlineStart: 6 }}
            >
              {t("Report an incident")}
            </Link>
          )}
          {q.data.full_name_ar && (
            <p className={u.muted} dir="rtl" style={{ margin: 0 }}>
              {q.data.full_name_ar}
            </p>
          )}
          <p style={{ margin: "8px 0 12px" }}>
            <StatusChip status={q.data.status} />{" "}
            {q.data.needs.map((n) => (
              <span key={n} className={u.need}>
                {needLabel(n)}
              </span>
            ))}
          </p>
          <ul className={u.list}>
            <li>
              <span>{t("Group")}</span>
              <span>
                {q.data.group_name} <span className={u.mono}>{q.data.group_code}</span>
              </span>
            </li>
            <li>
              <span>{t("Arrival flight")}</span>
              <span>
                {q.data.arrival_flight_id ? (
                  <Link to={`/arrivals/${q.data.arrival_flight_id}`} className={u.mono}>
                    {q.data.flight_number}
                  </Link>
                ) : (
                  "—"
                )}
              </span>
            </li>
            <li>
              <span>{t("Language")}</span>
              <span>{q.data.language ? languageName(q.data.language) : "—"}</span>
            </li>
            <li>
              <span>{t("Nationality")}</span>
              <span>{countryName(q.data.nationality)}</span>
            </li>
            <li>
              <span>{t("Passport")}</span>
              <span className={u.mono} dir="ltr">
                {q.data.passport_no}
              </span>
            </li>
            <li>
              <span>{t("Born")}</span>
              <span>{q.data.date_of_birth ? fmtDate(q.data.date_of_birth) : <i className={u.muted}>{t("Hidden for your role")}</i>}</span>
            </li>
            <li>
              <span>{t("Gender")}</span>
              <span>{t(q.data.gender === "male" ? "Male" : "Female")}</span>
            </li>
            <li>
              <span>{t("Phone")}</span>
              <span className={u.mono} dir="ltr">
                {q.data.phone ?? "—"}
              </span>
            </li>
          </ul>

          <h3 className={p.h3}>{t("Move to")}</h3>
          {!canMove ? (
            <p className={u.muted}>{t("Your role cannot change stages.")}</p>
          ) : q.data.allowed.length === 0 ? (
            <p className={u.muted}>{t("The journey is over.")}</p>
          ) : (
            <>
              <div className={p.moves}>
                {q.data.allowed.map((to) => (
                  <button
                    key={to}
                    type="button"
                    className={u.button}
                    disabled={move.isPending}
                    onClick={() =>
                      move.mutate({ id, to, note: note.trim() || undefined }, { onSuccess: () => setNote("") })
                    }
                  >
                    {statusLabel(to)}
                  </button>
                ))}
              </div>
              <input
                className={p.note}
                value={note}
                placeholder={t("Note (optional)")}
                onChange={(e) => setNote(e.target.value)}
              />
              {move.isError && <p className={u.error}>{move.error.message}</p>}
            </>
          )}

          <h3 className={p.h3}>{t("Journey")}</h3>
          <ol className={p.history}>
            {[...q.data.history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <StatusChip status={h.to_status} />
                <span className={u.sub}>
                  {fmtDateTime(h.at)} · {t("by {who}", { who: h.actor })}
                </span>
                {h.note && (
                  <span className={u.sub} dir="auto">
                    “{h.note}”
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
