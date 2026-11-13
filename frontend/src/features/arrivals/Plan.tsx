import { useState } from "react";
import { u } from "../../design/ui";
import { ARRIVAL_AIRPORTS, airportName } from "../../domain/airports";
import { INTERPRETER_LANGUAGES } from "../../domain/languages";
import type { Arrivals, ExtraResource, LoadRow, ResourceKind, Shortfall, WhatIf } from "../../domain/types";
import { fmtNum, getLang, languageName, ltr, sep, t } from "../../i18n";
import { ksaTime } from "../../lib/dates";
import a from "./arrivals.module.css";

const KIND: Record<ResourceKind, string> = { wheelchair: "Wheelchairs", bus: "Buses", interpreter: "Interpreters" };

export const kindName = (k: ResourceKind, language?: string | null) =>
  k === "interpreter" && language ? `${t("Interpreters")} (${languageName(language)})` : t(KIND[k]);

/** "Wheelchairs 1, Interpreters (Indonesian) 2" */
export const shortText = (s: Shortfall[]) => s.map((x) => `${kindName(x.kind, x.language)} ${fmtNum(x.short)}`).join(sep());

export const gapCount = (d: Arrivals) => d.load.reduce((n, r) => n + r.short.length, 0);

/** "Sat 14, 09:00–12:00" on the Saudi clock. */
export function blockName(start: string, hours: number): string {
  const day = new Intl.DateTimeFormat(getLang() === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    weekday: "short",
    day: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(new Date(start));
  const from = new Date(start);
  return `${day}${sep()}${ltr(`${ksaTime(from)}–${ksaTime(new Date(from.getTime() + hours * 3_600_000))}`)}`;
}

function Cell({ need, have }: { need: number; have: number }) {
  if (!need) return <span className={u.muted}>—</span>;
  const short = need > have;
  return (
    <span className={short ? a.short : undefined}>
      {fmtNum(need)} / {fmtNum(have)}
      {short && <span className={a.shortNote}>{t("short {n}", { n: need - have })}</span>}
    </span>
  );
}

/** Need against what is on shift, one row per airport and block with a flight landing. */
export function LoadTable({ rows, slotHours }: { rows: LoadRow[]; slotHours: number }) {
  if (rows.length === 0) return <p className={u.muted}>{t("No flights in this window.")}</p>;
  return (
    <div className={u.tableWrap}>
      <table className={u.table}>
        <thead>
          <tr>
            <th>{t("Block")}</th>
            <th>{t("Airport")}</th>
            <th>{t("Flights")}</th>
            <th>{t("Wheelchairs")}</th>
            <th>{t("Buses")}</th>
            <th>{t("Interpreters")}</th>
          </tr>
        </thead>
        <tbody className={a.still}>
          {rows.map((r) => {
            const langs = Object.keys(r.need.interpreter).sort();
            return (
              <tr key={`${r.start}-${r.airport}`} className={r.short.length ? a.gapRow : undefined}>
                <td>{blockName(r.start, slotHours)}</td>
                <td>{airportName(r.airport)}</td>
                <td className={u.mono} dir="ltr" style={{ textAlign: "end" }}>
                  {r.flights.join(", ")}
                </td>
                <td>
                  <Cell need={r.need.wheelchair} have={r.have.wheelchair} />
                </td>
                <td>
                  <Cell need={r.need.bus} have={r.have.bus} />
                </td>
                <td>
                  {langs.length === 0 ? (
                    <span className={u.muted}>—</span>
                  ) : (
                    langs.map((l) => (
                      <span key={l} className={a.langNeed}>
                        {languageName(l)} <Cell need={r.need.interpreter[l]} have={r.have.interpreter[l] ?? 0} />
                      </span>
                    ))
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={u.hint} style={{ marginTop: 8 }}>
        {t("Need / on shift. A flight holds them for its whole block.")}
      </p>
    </div>
  );
}

interface Draft {
  delays: { flight_id: string; minutes: number }[];
  extra: ExtraResource[];
}

/** Try delays and extra resources against the board. Shows the result; saves nothing. */
export function WhatIfPanel({
  live,
  onShow,
  onClose,
}: {
  live: Arrivals;
  onShow: (w: Omit<WhatIf, "hours">) => void;
  onClose: () => void;
}) {
  const coming = live.flights.filter((f) => f.state !== "landed");
  const [d, setD] = useState<Draft>({ delays: [], extra: [] });
  const set = (next: Partial<Draft>) => setD({ ...d, ...next });
  const empty = d.delays.length === 0 && d.extra.length === 0;

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("What if…")}</h2>
      <p className={u.hint}>{t("Try a change. Nothing is saved.")}</p>

      {d.delays.map((x, i) => (
        <div key={`d${i}`} className={a.row}>
          <select
            aria-label={t("Flight")}
            value={x.flight_id}
            onChange={(e) => set({ delays: d.delays.map((y, j) => (j === i ? { ...y, flight_id: e.target.value } : y)) })}
          >
            {coming.map((f) => (
              <option key={f.id} value={f.id}>
                {f.number} · {airportName(f.arrival_airport)}
              </option>
            ))}
          </select>
          <label className={a.inline}>
            {t("later by")}
            <input
              type="number"
              min={0}
              max={1440}
              step={15}
              value={x.minutes}
              aria-label={t("Minutes later")}
              onChange={(e) =>
                set({ delays: d.delays.map((y, j) => (j === i ? { ...y, minutes: Number(e.target.value) } : y)) })
              }
            />
            {t("min")}
          </label>
          <button
            type="button"
            className={`${u.button} ${u.quiet}`}
            aria-label={t("Remove")}
            onClick={() => set({ delays: d.delays.filter((_, j) => j !== i) })}
          >
            ×
          </button>
        </div>
      ))}

      {d.extra.map((x, i) => {
        const put = (y: Partial<ExtraResource>) => set({ extra: d.extra.map((z, j) => (j === i ? { ...z, ...y } : z)) });
        return (
          <div key={`x${i}`} className={a.row}>
            <span>{t("Add")}</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={x.quantity}
              aria-label={t("How many")}
              style={{ width: 80 }}
              onChange={(e) => put({ quantity: Number(e.target.value) })}
            />
            <select
              aria-label={t("Kind")}
              value={x.kind}
              onChange={(e) => {
                const kind = e.target.value as ResourceKind;
                put({ kind, language: kind === "interpreter" ? (x.language ?? INTERPRETER_LANGUAGES[0]) : null });
              }}
            >
              {(Object.keys(KIND) as ResourceKind[]).map((k) => (
                <option key={k} value={k}>
                  {t(KIND[k])}
                </option>
              ))}
            </select>
            {x.kind === "interpreter" && (
              <select aria-label={t("Language")} value={x.language ?? ""} onChange={(e) => put({ language: e.target.value })}>
                {INTERPRETER_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {languageName(l)}
                  </option>
                ))}
              </select>
            )}
            <span>{t("at")}</span>
            <select aria-label={t("Airport")} value={x.airport} onChange={(e) => put({ airport: e.target.value })}>
              {ARRIVAL_AIRPORTS.map((c) => (
                <option key={c} value={c}>
                  {airportName(c)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${u.button} ${u.quiet}`}
              aria-label={t("Remove")}
              onClick={() => set({ extra: d.extra.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </div>
        );
      })}

      <div className={a.row}>
        <button
          type="button"
          className={`${u.button} ${u.quiet}`}
          disabled={coming.length === 0}
          onClick={() => set({ delays: [...d.delays, { flight_id: coming[0].id, minutes: 60 }] })}
        >
          {t("+ A flight is late")}
        </button>
        <button
          type="button"
          className={`${u.button} ${u.quiet}`}
          onClick={() =>
            set({ extra: [...d.extra, { airport: ARRIVAL_AIRPORTS[0], kind: "wheelchair", language: null, quantity: 1 }] })
          }
        >
          {t("+ More resources")}
        </button>
      </div>
      <div className={a.row}>
        <button type="button" className={u.button} disabled={empty} onClick={() => onShow(d)}>
          {t("Show what-if")}
        </button>
        <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
          {t("Back to live")}
        </button>
      </div>
    </section>
  );
}
