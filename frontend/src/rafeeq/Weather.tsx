import { useEffect, useState } from "react";
import type { City } from "./guide/sites";
import type { RafeeqLang } from "./help";
import type { RafeeqSource } from "./source";
import { adviceFor, DAY_FROM_HOUR, DAY_TO_HOUR, REFRESH_MIN, skyKind, skyWord, STALE_MIN, type CityWeather, type HeatBand, type Sky, type UvBand, type WeatherReport } from "./weatherRules";
import { say } from "./words";
import r from "./rafeeq.module.css";

/**
 * The daily weather report for Makkah and Madinah: now, the hours ahead, the
 * next days, and when it is good to walk. Fetched again every REFRESH_MIN
 * minutes while the page is open; the last report is kept on the phone so it
 * shows with no signal, marked with its age.
 */

const SAVED_KEY = "rafeeq.weather";

function saved(): WeatherReport | null {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null") as WeatherReport | null;
  } catch {
    return null;
  }
}

export function useWeather(source: RafeeqSource | null): { report: WeatherReport | null; failed: boolean } {
  const [report, setReport] = useState<WeatherReport | null>(saved);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!source) return;
    let live = true;
    const get = () =>
      source.weather().then(
        (w) => {
          if (!live) return;
          setReport(w);
          setFailed(false);
          try {
            localStorage.setItem(SAVED_KEY, JSON.stringify(w));
          } catch {
            /* no storage: it is fetched again next time */
          }
        },
        () => live && setFailed(true),
      );
    void get();
    const timer = setInterval(get, REFRESH_MIN * 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [source]);
  return { report, failed };
}

/** Which city to show first: where they are in the journey, else Makkah. */
export const cityOf = (status: string | undefined): City => (status === "in_madinah" ? "madinah" : "makkah");

const HEAT_WORD: Record<HeatBand, string> = {
  unknown: "—",
  comfortable: "Comfortable",
  caution: "Warm",
  extreme_caution: "Hot",
  danger: "Very hot",
  extreme_danger: "Dangerous heat",
};
const UV_WORD: Record<UvBand, string> = {
  unknown: "—",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  very_high: "Very high",
  extreme: "Extreme",
};
/** The English the weather passes to say() through its tables, for the words test. */
export const WEATHER_TABLE_LINES = [
  ...Object.values(HEAT_WORD),
  ...Object.values(UV_WORD),
  "Clear sky",
  "Mostly clear",
  "Partly cloudy",
  "Cloudy",
  "Fog",
  "Drizzle",
  "Rain",
  "Thunderstorm",
  "A pleasant day. Enjoy your visits.",
  "Warm today. Drink water and rest in the shade.",
  "Hot today. Stay out of the sun at midday.",
  "Very hot today. Avoid walking outside at midday.",
  "Dangerous heat today. Stay indoors at midday.",
  "Strong sun from {from} to {to}. Use an umbrella.",
  "Rain is possible. Stay away from valleys and flood channels.",
  "Strong wind: dust is likely. Cover your nose and mouth.",
  "Weather in Makkah",
  "Weather in Madinah",
  "Best times to walk: {times}",
  "Fine to walk all day. Rest in the shade at midday.",
].filter((x) => x !== "—");

const heatTone = (b: HeatBand) =>
  b === "danger" || b === "extreme_danger" ? r.wxBad : b === "extreme_caution" ? r.wxHot : b === "caution" ? r.wxWarm : r.wxCool;

/* temperatures stay left to right, so Arabic and Urdu show 28° and not °28 */
const deg = (n: number | null | undefined) => (n == null ? "—" : ltr(`${Math.round(n)}°`));
const range = (hi: number | null | undefined, lo: number | null | undefined) =>
  ltr(`${hi == null ? "—" : `${Math.round(hi)}°`} / ${lo == null ? "—" : `${Math.round(lo)}°`}`);
const ltr = (s: string) => `⁦${s}⁩`;

function ageMinutes(at: string): number {
  return Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60_000));
}

function Updated({ report, lang, failed }: { report: WeatherReport; lang: RafeeqLang; failed: boolean }) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  if (report.sample) return <p className={r.wxUpdated}>{s("Sample: typical weather for this month, not a forecast.")}</p>;
  const age = ageMinutes(report.updated_at);
  const when = age < 2 ? s("Updated just now") : age < 90 ? s("Updated {n} min ago", { n: age }) : s("Updated {n} hours ago", { n: Math.round(age / 60) });
  return (
    <p className={r.wxUpdated}>
      {when} · {report.source}
      {(age > STALE_MIN || failed) && <b> · {s("May be out of date")}</b>}
    </p>
  );
}

/** The weather on the home page: one line for today and the best time to walk. */
export function WeatherCard({ report, city, lang, onOpen, failed }: { report: WeatherReport | null; city: City; lang: RafeeqLang; onOpen: () => void; failed: boolean }) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  if (!report) return null;
  const w = report.cities[city];
  const today = w.days[0];
  return (
    <button type="button" className={`${r.wxCard} ${heatTone(w.now.heat)}`} onClick={onOpen}>
      <span className={r.wxCardIcon}>
        <SkyIcon kind={skyKind(w.now.code)} />
      </span>
      <span className={r.wxCardWords}>
        <small>{s(city === "makkah" ? "Weather in Makkah" : "Weather in Madinah")}</small>
        <b>
          {deg(w.now.temp)} · {s("Feels like {t}", { t: deg(w.now.feels) })}
        </b>
        <span>
          {s(HEAT_WORD[today?.heat ?? "unknown"])} · {range(today?.max, today?.min)}
        </span>
        {today && today.good.length > 0 && <span className={r.wxBest}>{bestLine(today.good, lang)}</span>}
        <Updated report={report} lang={lang} failed={failed} />
      </span>
    </button>
  );
}

const isRtl = (l: RafeeqLang) => l === "ar" || l === "ur";

/** "Best times to walk: 05:00–10:00, 16:00–23:00", or "Fine to walk all day" when no hour is too hot. */
function bestLine(good: { from: string; to: string }[], lang: RafeeqLang): string {
  if (good.length === 1 && good[0].from === `${String(DAY_FROM_HOUR).padStart(2, "0")}:00` && good[0].to === `${DAY_TO_HOUR}:00`)
    return say("Fine to walk all day. Rest in the shade at midday.", lang);
  return say("Best times to walk: {times}", lang, { times: good.map((g) => ltr(`${g.from}–${g.to}`)).join(isRtl(lang) ? "، " : ", ") });
}

/** The full report: both cities, now, the next hours, four days, and the advice. */
export function WeatherView({ report, lang, first, onBack, failed }: { report: WeatherReport | null; lang: RafeeqLang; first: City; onBack: () => void; failed: boolean }) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  const [city, setCity] = useState<City>(first);
  if (!report)
    return (
      <section className={r.wx}>
        <h2>{s("Daily weather")}</h2>
        <p className={r.lead}>{failed ? s("The weather is not available just now.") : "…"}</p>
        <button type="button" className={r.plain} onClick={onBack}>
          {s("Back")}
        </button>
      </section>
    );
  const w: CityWeather = report.cities[city];
  const today = w.days[0];
  const advice = today ? adviceFor(today, w.hours) : [];
  const dayName = (iso: string, i: number) =>
    i === 0
      ? s("Today")
      : i === 1
        ? s("Tomorrow")
        : new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { weekday: "long", timeZone: "Asia/Riyadh" }).format(new Date(`${iso}T12:00:00+03:00`));
  return (
    <section className={r.wx}>
      <h2>{s("Daily weather")}</h2>
      <div className={r.seg} role="group" aria-label={s("City")}>
        {(["makkah", "madinah"] as City[]).map((c) => (
          <button key={c} type="button" aria-pressed={city === c} onClick={() => setCity(c)}>
            {s(c === "makkah" ? "Makkah" : "Madinah")}
          </button>
        ))}
      </div>
      <div className={`${r.wxNow} ${heatTone(w.now.heat)}`}>
        <span className={r.wxNowIcon}>
          <SkyIcon kind={skyKind(w.now.code)} />
        </span>
        <span>
          <b className={r.wxTemp}>{deg(w.now.temp)}</b>
          <span className={r.wxNowLine}>
            {s(skyWord(w.now.code))} · {s("Feels like {t}", { t: deg(w.now.feels) })}
          </span>
          <span className={r.wxNowLine}>{s(HEAT_WORD[w.now.heat])}</span>
        </span>
      </div>
      <ul className={r.wxFacts}>
        <li>
          <small>{s("High / low")}</small>
          <b>
            {range(today?.max, today?.min)}
          </b>
        </li>
        <li>
          <small>{s("Sun (UV)")}</small>
          <b>{s(UV_WORD[today?.uv ?? "unknown"])}</b>
        </li>
        <li>
          <small>{s("Humidity")}</small>
          <b>{w.now.humidity == null ? "—" : ltr(`${w.now.humidity}%`)}</b>
        </li>
        <li>
          <small>{s("Wind")}</small>
          <b>{w.now.wind == null ? "—" : ltr(`${Math.round(w.now.wind)} km/h`)}</b>
        </li>
        <li>
          <small>{s("Sunrise")}</small>
          <b>{today ? ltr(today.sunrise) : "—"}</b>
        </li>
        <li>
          <small>{s("Sunset")}</small>
          <b>{today ? ltr(today.sunset) : "—"}</b>
        </li>
      </ul>
      {today && today.good.length > 0 && (
        <p className={r.wxBestBig}>
          {bestLine(today.good, lang)}
        </p>
      )}
      {advice.length > 0 && (
        <ul className={r.advice}>
          {advice.map((a) => (
            <li key={a.line}>{s(a.line, a.vars && Object.fromEntries(Object.entries(a.vars).map(([k, v]) => [k, ltr(v)])))}</li>
          ))}
        </ul>
      )}
      <h3 className={r.wxHead}>{s("Next hours")}</h3>
      <ol className={r.wxHours}>
        {w.hours.slice(0, 24).map((h) => (
          <li key={h.at} className={heatTone(h.heat)}>
            <small>{ltr(h.at.slice(11, 16))}</small>
            <SkyIcon kind={skyKind(h.code)} />
            <b>{deg(h.temp)}</b>
            <small>{deg(h.feels)}</small>
          </li>
        ))}
      </ol>
      <p className={r.quiet}>{s("Top: temperature. Bottom: feels like.")}</p>
      <h3 className={r.wxHead}>{s("Next days")}</h3>
      <ul className={r.wxDays}>
        {w.days.map((d, i) => (
          <li key={d.date}>
            <span className={r.wxDayName}>{dayName(d.date, i)}</span>
            <SkyIcon kind={skyKind(d.code)} />
            <span className={r.wxDayWord}>{s(HEAT_WORD[d.heat])}</span>
            <b>
              {range(d.max, d.min)}
            </b>
          </li>
        ))}
      </ul>
      <Updated report={report} lang={lang} failed={failed} />
      <button type="button" className={r.plain} onClick={onBack}>
        {s("Back")}
      </button>
    </section>
  );
}

/** A small picture of the sky. */
export function SkyIcon({ kind }: { kind: Sky }) {
  const sun = (
    <g>
      <circle cx="16" cy="16" r="6" fill="#f9a825" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={16 + Math.cos(a) * 9} y1={16 + Math.sin(a) * 9} x2={16 + Math.cos(a) * 12.5} y2={16 + Math.sin(a) * 12.5} stroke="#f57c00" strokeWidth="2.2" strokeLinecap="round" />;
      })}
    </g>
  );
  const cloud = (x = 0, y = 0, fill = "#cfe3e6") => <path transform={`translate(${x} ${y})`} d="M9 25h15a5 5 0 0 0 0-10 7 7 0 0 0-13.4 2A4 4 0 0 0 9 25z" fill={fill} stroke="#7aa3a8" strokeWidth="1.2" />;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={r.sky}>
      {kind === "sun" && sun}
      {kind === "partly" && (
        <>
          <g transform="translate(-4 -4) scale(0.85)">{sun}</g>
          {cloud(2, 2)}
        </>
      )}
      {kind === "cloud" && cloud(0, -2)}
      {kind === "fog" && (
        <>
          {cloud(0, -4)}
          <path d="M6 26h20M9 29h14" stroke="#7aa3a8" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {(kind === "rain" || kind === "storm") && (
        <>
          {cloud(0, -5, kind === "storm" ? "#9fb6bb" : "#cfe3e6")}
          {kind === "rain" ? (
            <path d="M11 24l-1.5 4M17 24l-1.5 4M23 24l-1.5 4" stroke="#1e88e5" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M17 21l-4 6h4l-2 4" stroke="#f9a825" strokeWidth="2" fill="none" strokeLinejoin="round" />
          )}
        </>
      )}
    </svg>
  );
}
