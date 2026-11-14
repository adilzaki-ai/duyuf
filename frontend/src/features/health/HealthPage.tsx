import { useState } from "react";
import { Link } from "react-router-dom";
import { useHealth, usePilgrimHealth } from "../../api/queries";
import { Failed, Loading, PageHead, Tile, u } from "../../design/ui";
import { heartLabel, levelLabel, reasonLabel, tempLabel, waterLabel } from "../../domain/healthLabels";
import type { HealthRow, IncidentDetail, Place } from "../../domain/types";
import { fmtDateTime, fmtTime, t } from "../../i18n";
import type { Assessment, Level } from "../../rafeeq/vitals";
import { mapLink } from "../incidents/IncidentPanel";
import { since } from "../incidents/parts";
import pl from "../pilgrims/pilgrims.module.css";
import h from "./health.module.css";

type Show = "all" | "attention" | "fever" | "heart" | "water";

const SHOW: Record<Show, (x: HealthRow) => boolean> = {
  all: () => true,
  attention: (x) => !!x.alert || x.health?.level === "danger" || x.health?.level === "warning",
  fever: (x) => !!x.health && ["fever", "high_fever"].includes(x.health.temperature.state),
  heart: (x) => !!x.health && ["high", "unstable", "danger_high", "danger_low"].includes(x.health.heart.state),
  water: (x) => x.health?.hydration === "risk",
};
export const SHOW_EN: Record<Show, string> = {
  all: "All",
  attention: "Needs attention",
  fever: "Fever",
  heart: "Heart",
  water: "Dehydration risk",
};

/** A level as a word with a mark, never colour alone. */
export function LevelChip({ level }: { level: Level }) {
  return <span className={`${h.level} ${h[level]}`}>{levelLabel(level)}</span>;
}

/** "24.46720, 39.61120 · 3 min ago", with a map. */
export function PlaceText({ place }: { place: Place }) {
  const text = `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}${place.accuracy_m != null ? ` (±${Math.round(place.accuracy_m)} m)` : ""}`;
  return (
    <span>
      <bdi dir="ltr" className={u.mono}>
        {text}
      </bdi>{" "}
      <span className={u.muted}>· {t("{ago} ago", { ago: since(place.at) })}</span>{" "}
      <a href={mapLink(text)!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        {t("Open map")}
      </a>
    </span>
  );
}

function Vitals({ health }: { health: Assessment }) {
  return (
    <>
      <td>
        {health.heart.bpm != null && <b dir="ltr">{health.heart.bpm} bpm</b>}
        <span className={u.sub}>{heartLabel(health.heart.state)}</span>
      </td>
      <td>
        {health.temperature.c != null && <b dir="ltr">{health.temperature.c.toFixed(1)} °C</b>}
        <span className={u.sub}>{tempLabel(health.temperature.state)}</span>
      </td>
      <td>{waterLabel(health.hydration)}</td>
    </>
  );
}

/** Pilgrims who agreed to share readings or their place. Medics and administrators. */
export function HealthPage() {
  const q = useHealth();
  const [show, setShow] = useState<Show>("all");
  const [open, setOpen] = useState<string | null>(null);
  const items = q.data?.items.filter(SHOW[show]) ?? [];
  const simulated = q.data?.items.some((x) => x.health?.simulated);
  return (
    <>
      <PageHead title={t("Health")} sub={t("Pilgrims who agreed to share readings.")} />
      <p className={u.hint}>
        {t("Danger levels are proposed. A doctor has not agreed them yet.")}
        {simulated && <> {t("Readings marked demonstration are not from real watches.")}</>}
      </p>
      {q.data && (
        <div className={u.tiles}>
          <Tile label={t("Medical alerts")} value={q.data.stats.alerts} attention={q.data.stats.alerts > 0} />
          <Tile label={t("In danger")} value={q.data.stats.danger} attention={q.data.stats.danger > 0} />
          <Tile label={t("Fever")} value={q.data.stats.fever} attention={q.data.stats.fever > 0} />
          <Tile label={t("Heart")} value={q.data.stats.heart} attention={q.data.stats.heart > 0} />
          <Tile label={t("Dehydration risk")} value={q.data.stats.dehydration} attention={q.data.stats.dehydration > 0} />
          <Tile
            label={t("Watch gone quiet")}
            value={q.data.stats.no_readings}
            note={t("{n} share readings, {m} share their place", { n: q.data.stats.sharing_health, m: q.data.stats.sharing_location })}
          />
        </div>
      )}
      <div className={`${pl.layout} ${open ? pl.withPanel : ""}`}>
        <section className={u.card}>
          <div className={u.filters}>
            <div className={h.tabs} role="group" aria-label={t("Show")}>
              {(Object.keys(SHOW) as Show[]).map((x) => (
                <button key={x} type="button" aria-pressed={show === x} onClick={() => setShow(x)}>
                  {t(SHOW_EN[x])}
                </button>
              ))}
            </div>
          </div>
          {q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <Failed error={q.error} />
          ) : items.length === 0 ? (
            <p className={u.muted}>{q.data.items.length ? t("No one matches.") : t("No pilgrim shares readings yet.")}</p>
          ) : (
            <div className={u.tableWrap}>
              <table className={u.table}>
                <thead>
                  <tr>
                    <th>{t("Pilgrim")}</th>
                    <th>{t("State")}</th>
                    <th>{t("Heart")}</th>
                    <th>{t("Temperature")}</th>
                    <th>{t("Water")}</th>
                    <th>{t("Where")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => (
                    <tr key={x.pilgrim_id} className={open === x.pilgrim_id ? u.selected : undefined} onClick={() => setOpen(x.pilgrim_id)}>
                      <td>
                        {x.full_name}
                        <span className={`${u.sub} ${u.mono}`}>{x.group_code}</span>
                      </td>
                      <td>
                        {x.alert?.state === "counting" ? (
                          <span className={`${h.level} ${h.danger}`}>{t("Counting down")}</span>
                        ) : x.alert?.incident_id ? (
                          <Link to={`/incidents?open=${x.alert.incident_id}`} onClick={(e) => e.stopPropagation()}>
                            {t("Medical alert #{ref}", { ref: x.alert.incident_ref ?? "" })}
                          </Link>
                        ) : x.health ? (
                          <LevelChip level={x.health.level} />
                        ) : (
                          <span className={u.muted}>{t("Place only")}</span>
                        )}
                        {x.health?.simulated && <span className={u.sub}>{t("Demonstration")}</span>}
                      </td>
                      {x.health ? (
                        <Vitals health={x.health} />
                      ) : (
                        <td colSpan={3} className={u.muted}>
                          {t("Does not share readings")}
                        </td>
                      )}
                      <td style={{ whiteSpace: "normal" }}>{x.place ? <PlaceText place={x.place} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {open && <PilgrimHealthPanel id={open} row={q.data?.items.find((x) => x.pilgrim_id === open)} onClose={() => setOpen(null)} />}
      </div>
    </>
  );
}

function PilgrimHealthPanel({ id, row, onClose }: { id: string; row: HealthRow | undefined; onClose: () => void }) {
  const q = usePilgrimHealth(id);
  return (
    <aside className={`${u.card} ${pl.panel}`} aria-label={row?.full_name}>
      <button type="button" className={pl.close} onClick={onClose} aria-label={t("Close")}>
        ×
      </button>
      <h2>{row?.full_name}</h2>
      {row && (
        <p className={u.muted} style={{ margin: "2px 0 10px" }}>
          <Link to={`/groups/${row.group_id}`}>{row.group_name}</Link> <span className={u.mono}>{row.group_code}</span>
        </p>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failed error={q.error} />
      ) : (
        <>
          {q.data.health && (
            <>
              <p style={{ margin: "0 0 8px" }}>
                <LevelChip level={q.data.health.level} />
              </p>
              {q.data.health.reasons.length > 0 && (
                <ul className={h.reasons}>
                  {q.data.health.reasons.map((r) => (
                    <li key={r}>{reasonLabel(r)}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {q.data.places[0] && (
            <>
              <h3 className={pl.h3}>{t("Where")}</h3>
              <PlaceText place={q.data.places[0]} />
            </>
          )}
          {q.data.alerts.length > 0 && (
            <>
              <h3 className={pl.h3}>{t("Alerts")}</h3>
              <ul className={u.list}>
                {q.data.alerts.map((a) => (
                  <li key={a.id}>
                    <span>
                      {a.reasons.map(reasonLabel).join(", ")}
                      <span className={u.sub}>{fmtDateTime(a.started_at)}</span>
                    </span>
                    <span>
                      {a.state === "sent" && a.incident_id ? (
                        <Link to={`/incidents?open=${a.incident_id}`}>#{a.incident_ref}</Link>
                      ) : a.state === "cancelled" ? (
                        t("Pilgrim said OK")
                      ) : (
                        t("Counting down")
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {q.data.readings.length > 0 && (
            <>
              <h3 className={pl.h3}>{t("Latest readings")}</h3>
              <div className={u.tableWrap}>
                <table className={u.table}>
                  <thead>
                    <tr>
                      <th>{t("Time")}</th>
                      <th>{t("Heart")}</th>
                      <th>{t("Temperature")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...q.data.readings]
                      .reverse()
                      .slice(0, 12)
                      .map((r, i) => (
                        <tr key={`${r.at}-${i}`}>
                          <td>{fmtTime(r.at)}</td>
                          <td dir="ltr">{r.heart_rate != null ? `${r.heart_rate} bpm` : "—"}</td>
                          <td dir="ltr">{r.temperature != null ? `${r.temperature.toFixed(1)} °C` : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </aside>
  );
}

/** On a medical incident: the readings behind it and now. Only medics and administrators get this. */
export function IncidentHealth({ health }: { health: NonNullable<IncidentDetail["health"]> }) {
  const vitals = (bpm: number | null, c: number | null) =>
    [bpm != null ? `${bpm} bpm` : null, c != null ? `${c.toFixed(1)} °C` : null].filter(Boolean).join(" · ");
  return (
    <div className={h.incident}>
      <h3>{t("Readings")}</h3>
      {health.alert && (
        <p>
          {t("When the alert started:")} <bdi dir="ltr">{vitals(health.alert.heart_rate, health.alert.temperature)}</bdi>
          <span className={u.sub}>{health.alert.reasons.map(reasonLabel).join(", ")}</span>
        </p>
      )}
      {health.now && (
        <p>
          {t("Now:")} <LevelChip level={health.now.level} />{" "}
          <bdi dir="ltr">{vitals(health.now.heart.bpm, health.now.temperature.c)}</bdi>
        </p>
      )}
      <p className={u.hint}>{t("Only medics and administrators see readings.")}</p>
    </div>
  );
}
