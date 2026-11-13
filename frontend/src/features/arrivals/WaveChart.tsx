import { useState } from "react";
import { airportName, WAVE_SERIES, waveSeries } from "../../domain/airports";
import type { Wave } from "../../domain/types";
import { fmtNum, getLang, t } from "../../i18n";
import { ksaTime } from "../../lib/dates";
import a from "./arrivals.module.css";

const PLOT_PX = 160;
const COLOR: Record<(typeof WAVE_SERIES)[number], string> = {
  JED: "var(--series-1)",
  MED: "var(--series-2)",
  other: "var(--series-3)",
};

const seriesName = (s: (typeof WAVE_SERIES)[number]) => (s === "other" ? t("Other airports") : airportName(s));

function day(iso: string): string {
  return new Intl.DateTimeFormat(getLang() === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    weekday: "short",
    day: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));
}

/** A round top for the scale, so the gridlines fall on easy numbers. */
function niceMax(n: number): number {
  for (const step of [10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (n <= step * 2) return step * 2;
  return Math.ceil(n / 1000) * 1000;
}

/**
 * Pilgrims landing in each block of hours, stacked by airport. One series per
 * airport in a fixed colour (Jeddah, Madinah, then the rest folded together),
 * a legend above, and the numbers on hover and focus. The flights table below
 * it is the same data as a table.
 */
export function WaveChart({ waves, slotHours }: { waves: Wave[]; slotHours: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = waves.map((w) => {
    const by: Record<string, number> = {};
    for (const [code, n] of Object.entries(w.by_airport)) by[waveSeries(code)] = (by[waveSeries(code)] ?? 0) + n;
    return { start: w.start, by, total: Object.values(by).reduce((x, y) => x + y, 0) };
  });
  const present = WAVE_SERIES.filter((s) => rows.some((r) => r.by[s]));
  const peak = Math.max(0, ...rows.map((r) => r.total));
  if (peak === 0) return <p className={a.legend}>{t("No flights in this window.")}</p>;
  const top = niceMax(peak);
  const dense = rows.length > 20;
  const hourStep = dense ? 24 : 6;
  const end = (iso: string) => ksaTime(new Date(Date.parse(iso) + slotHours * 3_600_000));

  return (
    <div>
      <div className={a.legend}>
        {present.map((s) => (
          <span key={s}>
            <span className={a.swatch} style={{ background: COLOR[s] }} />
            {seriesName(s)}
          </span>
        ))}
      </div>
      <div className={a.chart}>
        <div className={a.yaxis} aria-hidden="true">
          {[top, top / 2, 0].map((v) => (
            <span key={v} style={{ bottom: `${(v / top) * PLOT_PX}px` }}>
              {fmtNum(v)}
            </span>
          ))}
        </div>
        <div className={a.plot}>
          {[top, top / 2].map((v) => (
            <div key={v} className={a.grid} style={{ bottom: `${(v / top) * PLOT_PX}px` }} />
          ))}
          {rows.map((r, i) => {
            const label = `${day(r.start)} ${ksaTime(new Date(r.start))}–${end(r.start)}: ${t("{n} pilgrims", { n: r.total })}`;
            return (
              <div
                key={r.start}
                className={a.col}
                tabIndex={r.total ? 0 : -1}
                aria-label={label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                {r.total > 0 && (
                  <div className={a.stack}>
                    {present
                      .filter((s) => r.by[s])
                      .map((s, k) => (
                        <span
                          key={s}
                          style={{
                            background: COLOR[s],
                            height: `${Math.max(2, (r.by[s] / top) * PLOT_PX - (k ? 2 : 0))}px`,
                          }}
                        />
                      ))}
                  </div>
                )}
                {hover === i && r.total > 0 && (
                  <div className={a.tip} role="tooltip">
                    <b>{day(r.start)}</b> {ksaTime(new Date(r.start))}–{end(r.start)}
                    <ul>
                      {present
                        .filter((s) => r.by[s])
                        .map((s) => (
                          <li key={s}>
                            <span className={a.swatch} style={{ background: COLOR[s] }} />
                            {seriesName(s)}
                            <b>{fmtNum(r.by[s])}</b>
                          </li>
                        ))}
                      {present.length > 1 && (
                        <li>
                          {t("Total")}
                          <b>{fmtNum(r.total)}</b>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className={a.xaxis} aria-hidden="true">
          {rows.map((r, i) => {
            const hour = Number(ksaTime(new Date(r.start)).slice(0, 2));
            /* times on the hour marks only; the day under midnight, and under the first block */
            const time = !dense && hour % hourStep === 0;
            const date = hour === 0 || i === 0;
            return (
              <span key={r.start}>
                {time ? ksaTime(new Date(r.start)) : "\u00a0"}
                {date && <b>{day(r.start)}</b>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
