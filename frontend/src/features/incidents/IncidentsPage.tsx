import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useGroups, useIncidents, usePilgrim, usePilgrims, useRaiseIncident } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { Failed, Loading, PageHead, Tile, u } from "../../design/ui";
import {
  INCIDENT_KINDS,
  incidentKindLabel,
  incidentStatusLabel,
  PRIORITIES,
  priorityLabel,
  type IncidentKind,
  type Priority,
} from "../../domain/incidents";
import type { IncidentFilter } from "../../domain/types";
import { t } from "../../i18n";
import pl from "../pilgrims/pilgrims.module.css";
import { IncidentPanel } from "./IncidentPanel";
import s from "./incidents.module.css";
import { kindText, minutesText, PriorityChip, since } from "./parts";

const WAIT_TOO_LONG_MIN = 15;

function Report({ pilgrimId, onDone }: { pilgrimId: string | null; onDone: (id: string) => void }) {
  const raise = useRaiseIncident();
  const groups = useGroups();
  const [kind, setKind] = useState<IncidentKind>("lost");
  const [priority, setPriority] = useState<Priority>("high");
  const [who, setWho] = useState<string | null>(pilgrimId);
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const chosen = usePilgrim(who ?? undefined);
  const found = usePilgrims({ q: search.trim() || undefined, limit: 6 });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    raise.mutate(
      {
        kind,
        priority,
        pilgrim_id: who,
        group_id: who ? null : group || null,
        location: location.trim() || null,
        description: description.trim(),
      },
      { onSuccess: (i) => onDone(i.id) },
    );
  };

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("Report an incident")}</h2>
      <form className={u.form} onSubmit={submit}>
        <label>
          {t("What")}
          <select value={kind} onChange={(e) => setKind(e.target.value as IncidentKind)}>
            {INCIDENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {incidentKindLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Priority")}
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Where")}
          <input value={location} placeholder={t("e.g. Prophet's Mosque, door 21")} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <div className={`${u.field} ${u.wide}`}>
          <span>{t("Who")}</span>
          {who ? (
            <span style={{ color: "var(--ink)" }}>
              {chosen.data ? `${chosen.data.full_name} · ${chosen.data.group_code}` : t("Loading…")}{" "}
              <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setWho(null)}>
                {t("Change")}
              </button>
            </span>
          ) : (
            <div className={u.filters} style={{ marginBottom: 0 }}>
              <input
                type="search"
                value={search}
                placeholder={t("Find a pilgrim by name")}
                aria-label={t("Find a pilgrim by name")}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select aria-label={t("Or a whole group")} value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">{t("Or a whole group")}</option>
                {groups.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} · {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!who && search.trim() && (
            <div className={s.buttons}>
              {found.data?.items.map((p) => (
                <button key={p.id} type="button" className={`${u.button} ${u.quiet}`} onClick={() => setWho(p.id)}>
                  {p.full_name} · {p.group_code}
                </button>
              ))}
              {found.data?.items.length === 0 && <span className={u.muted}>{t("No pilgrims match.")}</span>}
            </div>
          )}
        </div>
        <label className={u.wide}>
          {t("What happened")}
          <input required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className={u.formActions}>
          <button type="submit" className={u.button} disabled={raise.isPending || !description.trim()}>
            {t("Raise incident")}
          </button>
          {raise.isError && <span className={u.error}>{raise.error.message}</span>}
        </div>
      </form>
    </section>
  );
}

export function IncidentsPage() {
  const [params, setParams] = useSearchParams();
  const forPilgrim = params.get("pilgrim");
  const [status, setStatus] = useState<NonNullable<IncidentFilter["status"]>>("active");
  const [kind, setKind] = useState<IncidentKind | "">("");
  const [reporting, setReporting] = useState(!!forPilgrim);
  const [open, setOpen] = useState<string | null>(null);
  const canWork = useCan("incident:write");
  const q = useIncidents({ status, kind: kind || undefined });
  const now = Date.now();

  return (
    <>
      <PageHead title={t("Incidents")} sub={t("What is happening, and who is on it.")}>
        {canWork && !reporting && (
          <button type="button" className={u.button} onClick={() => setReporting(true)}>
            {t("Report incident")}
          </button>
        )}
      </PageHead>
      {reporting && (
        <Report
          key={forPilgrim ?? "-"}
          pilgrimId={forPilgrim}
          onDone={(id) => {
            setReporting(false);
            setParams({});
            setStatus("active");
            setOpen(id);
          }}
        />
      )}
      {q.data && (
        <div className={u.tiles}>
          <Tile label={t("Waiting for a team")} value={q.data.stats.open} attention={q.data.stats.open > 0} />
          <Tile label={t("Urgent, not resolved")} value={q.data.stats.urgent} attention={q.data.stats.urgent > 0} />
          <Tile label={t("With a team")} value={q.data.stats.assigned} />
          <Tile label={t("Resolved today")} value={q.data.stats.resolved_today} />
          <div className={u.tile}>
            <div className={u.tileLabel}>{t("Time to a team")}</div>
            <div className={u.tileValue}>{minutesText(q.data.stats.minutes_to_assign)}</div>
            <div className={u.tileNote}>
              {t("Median, last 7 days. To resolve: {m}", { m: minutesText(q.data.stats.minutes_to_resolve) })}
            </div>
          </div>
        </div>
      )}
      <div className={`${pl.layout} ${open ? pl.withPanel : ""}`}>
        <section className={u.card}>
          <div className={u.filters}>
            <div className={s.tabs} role="group" aria-label={t("Show")}>
              {(["active", "resolved", "all"] as const).map((x) => (
                <button key={x} type="button" aria-pressed={status === x} onClick={() => setStatus(x)}>
                  {t({ active: "Not resolved", resolved: "Resolved", all: "All" }[x])}
                </button>
              ))}
            </div>
            <select aria-label={t("Kind")} value={kind} onChange={(e) => setKind(e.target.value as IncidentKind | "")}>
              <option value="">{t("Every kind")}</option>
              {INCIDENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {incidentKindLabel(k)}
                </option>
              ))}
            </select>
          </div>
          {q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <Failed error={q.error} />
          ) : q.data.items.length === 0 ? (
            <p className={u.muted}>{status === "active" ? t("Nothing waiting. All quiet.") : t("No incidents match.")}</p>
          ) : (
            <div className={u.tableWrap}>
              <table className={u.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("Priority")}</th>
                    <th>{t("What")}</th>
                    <th>{t("Who")}</th>
                    <th>{t("Where")}</th>
                    <th>{t("Waiting")}</th>
                    <th>{t("Team")}</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.items.map((i) => {
                    const waiting = i.status === "open" && now - Date.parse(i.opened_at) > WAIT_TOO_LONG_MIN * 60_000;
                    return (
                      <tr key={i.id} className={open === i.id ? u.selected : undefined} onClick={() => setOpen(i.id)}>
                        <td className={u.mono}>{i.ref}</td>
                        <td>
                          <PriorityChip priority={i.priority} />
                        </td>
                        <td>
                          <b>{kindText(i.kind)}</b>
                          <span className={`${u.sub} ${s.desc}`}>{i.description}</span>
                        </td>
                        <td>
                          {i.pilgrim_name ?? (i.group_name ? t("Whole group") : "—")}
                          {i.group_code && <span className={`${u.sub} ${u.mono}`}>{i.group_code}</span>}
                        </td>
                        <td style={{ whiteSpace: "normal" }}>{i.location ?? "—"}</td>
                        <td className={s.waiting}>
                          {i.status === "resolved" ? (
                            <span className={u.muted}>{incidentStatusLabel("resolved")}</span>
                          ) : (
                            <span className={waiting ? s.late : undefined}>{since(i.opened_at, now)}</span>
                          )}
                        </td>
                        <td>{i.team ?? <span className={u.muted}>{t("No one yet")}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {open && <IncidentPanel id={open} teams={q.data?.teams ?? []} onClose={() => setOpen(null)} />}
      </div>
    </>
  );
}
