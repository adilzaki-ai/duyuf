import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { RafeeqLang } from "./help";
import type { RafeeqAlert, RafeeqPage, RafeeqSource } from "./source";
import { RULES, series, type Assessment, type Heat } from "./vitals";
import { say } from "./words";
import r from "./rafeeq.module.css";

/*
 * The health half of Rafeeq, for older pilgrims first: one idea per row, big
 * words and numbers, a picture and a word for every state (never colour
 * alone), and at most two buttons on any question.
 */

type Tone = "ok" | "warn" | "bad" | "none";

/* The pictures keep their real colours whatever the state: a red heart, a red
 * thermometer column, a blue drop, a yellow sun. The state is the row's edge
 * and its word. */

const Heart = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={r.heartSvg}>
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
  </svg>
);

/** A glass thermometer whose red column rises with the temperature (35–41 °C). */
const Thermometer = ({ c }: { c: number | null }) => {
  const share = c == null ? 0.35 : Math.min(1, Math.max(0, (c - 35) / 6));
  const top = 15.5 - share * 12;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9.5" y="1.5" width="5" height="16" rx="2.5" fill="#fff" stroke="#6b7a85" strokeWidth="1" />
      <circle cx="12" cy="18.5" r="4.2" fill="#fff" stroke="#6b7a85" strokeWidth="1" />
      <rect x="11" y={top} width="2" height={18.5 - top} rx="1" fill="#d32f2f" />
      <circle cx="12" cy="18.5" r="3.1" fill="#d32f2f" />
      {[4.5, 7.5, 10.5, 13.5].map((y) => (
        <line key={y} x1="14.5" x2="16.3" y1={y} y2={y} stroke="#6b7a85" strokeWidth="0.8" />
      ))}
    </svg>
  );
};

const Drop = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.5S5 10.3 5 15a7 7 0 0 0 14 0c0-4.7-7-12.5-7-12.5z" fill="#1e88e5" />
    <path d="M9 15.5a3 3 0 0 0 3 3" stroke="#bbdefb" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>
);

const Sun = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.6" fill="#f9a825" />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return (
        <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 10} y2={12 + Math.sin(a) * 10}
          stroke="#f57c00" strokeWidth="2" strokeLinecap="round" />
      );
    })}
  </svg>
);

const Pin = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
  </svg>
);

/** The heart beats at the pulse it shows; still when there is no reading. */
function BeatingHeart({ bpm }: { bpm: number | null }) {
  const seconds = bpm ? Math.min(1.5, Math.max(0.33, 60 / bpm)) : null;
  return (
    <span className={`${r.beat} ${seconds ? r.beating : ""}`} style={seconds ? ({ "--beat": `${seconds}s` } as CSSProperties) : undefined}>
      <Heart />
    </span>
  );
}

/* the pulse gauge: 30 to 180 beats a minute, in the same zones as the words
 * (thresholds from vitals.ts), so the colour under the needle and the word agree */
const GAUGE_MIN = 30;
const GAUGE_MAX = 180;
const ZONES: { to: number; tone: Tone }[] = [
  { to: RULES.HEART_DANGER_LOW, tone: "bad" },
  { to: RULES.HEART_HIGH, tone: "ok" },
  { to: RULES.HEART_DANGER_HIGH, tone: "warn" },
  { to: GAUGE_MAX, tone: "bad" },
];
const at = (bpm: number) => ((Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, bpm)) - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100;

function HeartGauge({ bpm, word, lang }: { bpm: number | null; word: string; lang: RafeeqLang }) {
  let from = GAUGE_MIN;
  return (
    <div
      className={r.gauge}
      dir="ltr"
      role="meter"
      aria-label={say("Heart", lang)}
      aria-valuemin={GAUGE_MIN}
      aria-valuemax={GAUGE_MAX}
      aria-valuenow={bpm ?? undefined}
      aria-valuetext={bpm != null ? `${bpm} bpm, ${word}` : word}
    >
      <div className={r.gaugeBar}>
        <span className={r.gaugeTrack}>
          {ZONES.map((z) => {
            const left = at(from);
            from = z.to;
            return <span key={z.to} className={`${r.gaugeZone} ${toneClass(z.tone)}`} style={{ left: `${left}%`, width: `${at(z.to) - left}%` }} />;
          })}
        </span>
        {bpm != null && <span className={r.gaugeNeedle} style={{ left: `${at(bpm)}%` }} />}
      </div>
      {/* each word under the middle of its zone */}
      <div className={r.gaugeLabels}>
        <span style={{ left: `${at(38)}%` }}>{say("Slow", lang)}</span>
        <span style={{ left: `${at(80)}%` }}>{say("Normal", lang)}</span>
        <span style={{ left: `${at(135)}%` }}>{say("Fast", lang)}</span>
        <span style={{ left: `${at(166)}%` }}>{say("Very fast", lang)}</span>
      </div>
    </div>
  );
}

function heartWord(h: Assessment["heart"], lang: RafeeqLang): [string, Tone] {
  switch (h.state) {
    case "ok":
      return [say("Normal", lang), "ok"];
    case "high":
      return [say("Fast", lang), "warn"];
    case "unstable":
      return [say("Unsteady", lang), "warn"];
    case "danger_high":
      return [say("Very fast", lang), "bad"];
    case "danger_low":
      return [say("Very slow", lang), "bad"];
    default:
      return [say("No reading", lang), "none"];
  }
}

function tempWord(t: Assessment["temperature"], lang: RafeeqLang): [string, Tone] {
  switch (t.state) {
    case "ok":
      return [say("Normal", lang), "ok"];
    case "raised":
      return [say("A little high", lang), "warn"];
    case "fever":
      return [say("Fever", lang), "warn"];
    case "high_fever":
      return [say("High fever", lang), "bad"];
    default:
      return [say("No reading", lang), "none"];
  }
}

function waterWord(h: Assessment["hydration"], lang: RafeeqLang): [string, Tone] {
  if (h === "ok") return [say("Drank recently", lang), "ok"];
  if (h === "due") return [say("Time to drink", lang), "warn"];
  return [say("Drink water now", lang), "bad"];
}

function heatWord(h: Heat, lang: RafeeqLang): [string, Tone] {
  switch (h) {
    case "ok":
      return [say("Normal", lang), "ok"];
    case "stress":
      return [say("Heat stress", lang), "warn"];
    case "exhaustion":
      return [say("Heat exhaustion signs", lang), "bad"];
    case "stroke_risk":
      return [say("Heat stroke risk", lang), "bad"];
    default:
      return [say("No reading", lang), "none"];
  }
}

const toneClass = (t: Tone) => (t === "ok" ? r.toneOk : t === "warn" ? r.toneWarn : t === "bad" ? r.toneBad : r.toneNone);

type RowId = "heart" | "temp" | "heat" | "water";

/** One row: tap it to open what it means and what to do. */
function Row({ id, open, onToggle, icon, label, value, word, tone, children, more }: {
  id: RowId; open: boolean; onToggle: (id: RowId) => void; icon: ReactNode; label: string; value: string | null;
  word: string; tone: Tone; children?: ReactNode; more: ReactNode;
}) {
  return (
    <li className={`${r.vital} ${toneClass(tone)} ${open ? r.vitalOpen : ""}`}>
      <button type="button" className={r.vitalButton} aria-expanded={open} aria-controls={`rafeeq-more-${id}`} onClick={() => onToggle(id)}>
        <span className={r.vitalIcon}>{icon}</span>
        <span className={r.vitalLabel}>{label}</span>
        {value && (
          <bdi dir="ltr" className={r.vitalValue}>
            {value}
          </bdi>
        )}
        <span className={r.vitalWord}>{word}</span>
        <span className={r.vitalChevron} aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {children && <span className={r.vitalExtra}>{children}</span>}
      {open && (
        <div id={`rafeeq-more-${id}`} className={r.vitalMore}>
          {more}
        </div>
      )}
    </li>
  );
}

function Recent({ rows, pick, unit, lang }: { rows: RafeeqPage["recent"]; pick: "heart_rate" | "temperature"; unit: string; lang: RafeeqLang }) {
  const shown = rows.filter((x) => x[pick] != null).slice(0, 6);
  if (!shown.length) return null;
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Riyadh" }).format(new Date(iso));
  return (
    <>
      <p className={r.moreHead}>{say("Recent readings", lang)}</p>
      <ul className={r.recent} dir="ltr">
        {shown.map((x) => (
          <li key={x.at}>
            <span>{time(x.at)}</span>
            <b>
              {pick === "temperature" ? x.temperature!.toFixed(1) : x.heart_rate} {unit}
            </b>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Heart, temperature, heat and water: a picture, a number and a word each; tap a row for more. */
export function HealthPanel({ health, recent, lang, onWater, busy, now = new Date() }: {
  health: Assessment; recent: RafeeqPage["recent"]; lang: RafeeqLang; onWater: () => void; busy: boolean; now?: Date;
}) {
  const [hw, ht] = heartWord(health.heart, lang);
  const [tw, tt] = tempWord(health.temperature, lang);
  const [xw, xt] = heatWord(health.heat, lang);
  const [ww, wt] = waterWord(health.hydration, lang);
  const quiet = health.heart.state === "unknown" && health.temperature.state === "unknown";
  const hot = health.heat === "exhaustion" || health.heat === "stroke_risk";
  /* too hot: the heat row opens by itself, so the warning sits with the reading */
  const [open, setOpen] = useState<RowId | null>(hot ? "heat" : null);
  const toggle = (id: RowId) => setOpen((o) => (o === id ? null : id));
  useEffect(() => {
    if (hot) setOpen("heat");
  }, [hot]);
  const worried = !hot && (health.level === "warning" || health.level === "danger");
  const sinceWater = health.water_at ? Math.max(0, Math.round((now.getTime() - Date.parse(health.water_at)) / 60_000)) : null;
  const hours = hotHours(now);
  return (
    <section className={r.health} aria-label={say("Your health", lang)}>
      <h2>{say("Your health", lang)}</h2>
      <p className={r.quiet}>{say("Tap a row to learn more.", lang)}</p>
      <ul className={r.vitals}>
        <Row
          id="heart" open={open === "heart"} onToggle={toggle} icon={<BeatingHeart bpm={health.heart.bpm} />}
          label={say("Heart", lang)} value={health.heart.bpm != null ? `${health.heart.bpm} bpm` : null} word={hw} tone={ht}
          more={
            <>
              {health.heart.bpm != null && <p>{say("Your heart beats {n} times a minute.", lang, { n: health.heart.bpm })}</p>}
              <p>{say("At rest, 60 to 100 is normal.", lang)}</p>
              <p>{say("Fast or unsteady: sit in the shade, breathe slowly, and drink water.", lang)}</p>
              <p>{say("If it stays very fast or very slow, Rafeeq calls medical help.", lang)}</p>
              <Recent rows={recent} pick="heart_rate" unit="bpm" lang={lang} />
            </>
          }
        >
          <HeartGauge bpm={health.heart.bpm} word={hw} lang={lang} />
        </Row>
        <Row
          id="temp" open={open === "temp"} onToggle={toggle} icon={<Thermometer c={health.temperature.c} />}
          label={say("Temperature", lang)} value={health.temperature.c != null ? `${health.temperature.c.toFixed(1)} °C` : null}
          word={tw} tone={tt}
          more={
            <>
              {health.temperature.c != null && <p>{say("Your temperature is {c} °C.", lang, { c: health.temperature.c.toFixed(1) })}</p>}
              <p>{say("About 36.5 to 37.5 °C is normal.", lang)}</p>
              <p>{say("Above 38 °C for half an hour is a fever. Rest, drink, and tell your group leader.", lang)}</p>
              <Recent rows={recent} pick="temperature" unit="°C" lang={lang} />
            </>
          }
        />
        <Row
          id="heat" open={open === "heat"} onToggle={toggle} icon={<Sun />} label={say("Heat", lang)} value={null}
          word={xw} tone={xt}
          more={
            <>
              {hot && <p className={r.moreAlarm}>{say("Your body is getting too hot. Stop, rest in the shade, drink water, and wet your skin.", lang)}</p>}
              {hours && <p><b>{say("Hottest hours now. Stay in the shade until 4 pm.", lang)}</b></p>}
              <p>{say("Heat makes your heart work harder and your body hotter.", lang)}</p>
              <p>{say("Stay in the shade, use an umbrella, and wet your skin and head.", lang)}</p>
            </>
          }
        >
          {hours && !hot && <span className={r.hoursNote}>{say("Hottest hours now. Stay in the shade until 4 pm.", lang)}</span>}
        </Row>
        <Row
          id="water" open={open === "water"} onToggle={toggle} icon={<Drop />} label={say("Water", lang)} value={null}
          word={ww} tone={wt}
          more={
            <>
              <p>
                {sinceWater != null
                  ? say("You last drank {n} minutes ago.", lang, { n: sinceWater })
                  : say("You have not told Rafeeq you drank yet.", lang)}
              </p>
              <p>{say("Drink a cup of water every hour, more in the sun.", lang)}</p>
            </>
          }
        />
      </ul>
      {quiet && <p className={r.quiet}>{say("Your watch has not sent readings lately.", lang)}</p>}
      {worried && <p className={r.warning}>{say("Rest in the shade and drink water. Tell your group leader.", lang)}</p>}
      <button type="button" className={`${r.big} ${r.water}`} disabled={busy} onClick={onWater}>
        <Drop />
        {say("I drank water", lang)}
      </button>
    </section>
  );
}

/** The hottest hours on the Saudi clock (11:00 to 16:00), when outdoor rites are hardest. */
export function hotHours(now = new Date()): boolean {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Riyadh" }).format(now));
  return h >= 11 && h < 16;
}

/** For pilgrims who do not share readings: a heat warning in the hottest hours. Those who share
 * see heat in their health panel's Heat row instead, so it is said in one place. */
export function HeatWarning({ lang, now }: { lang: RafeeqLang; now?: Date }) {
  if (!hotHours(now)) return null;
  return (
    <section className={r.heatWarning} role="status">
      <span className={r.heatIcon}>
        <Sun />
      </span>
      <span>
        <b>{say("Heat warning", lang)}</b>
        <br />
        {say("Hottest hours now. Stay in the shade until 4 pm.", lang)}
      </span>
    </section>
  );
}

const ASKED_KEY = "rafeeq.asked";

function asked(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ASKED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** One question at a time: health first, then place. "Not now" is remembered on this phone. */
export function ConsentCard({ page, lang, onAnswer }: { page: RafeeqPage; lang: RafeeqLang; onAnswer: (c: { health?: boolean; location?: boolean }) => void }) {
  const [skipped, setSkipped] = useState<string[]>(asked);
  const which = !page.consent.health && !skipped.includes("health") ? "health" : !page.consent.location && !skipped.includes("location") ? "location" : null;
  if (!which) return null;
  const notNow = () => {
    const next = [...skipped, which];
    setSkipped(next);
    try {
      localStorage.setItem(ASKED_KEY, JSON.stringify(next));
    } catch {
      /* forgets on reload; asks again then */
    }
  };
  return (
    <section className={r.consent} role="region" aria-label={say("Your health", lang)}>
      <span className={r.consentIcon}>{which === "health" ? <Heart /> : <Pin />}</span>
      <p className={r.lead}>
        {which === "health"
          ? say("Share your heart rate and temperature with the medical team?", lang)
          : say("Share where you are with your group's team, all the time?", lang)}
      </p>
      <p className={r.quiet}>
        {which === "health"
          ? say("If they look dangerous, Rafeeq calls medical help for you.", lang)
          : say("So they can find you quickly if you need help.", lang)}{" "}
        {say("You can stop at any time.", lang)}
      </p>
      <div className={r.twoButtons}>
        <button type="button" className={`${r.big} ${r.yes}`} onClick={() => onAnswer({ [which]: true })}>
          {say("Yes, share", lang)}
        </button>
        <button type="button" className={r.plain} onClick={notNow}>
          {say("Not now", lang)}
        </button>
      </div>
    </section>
  );
}

/** Whether the phone can share its place from this link: browsers allow it only on https (or this computer). */
export const canSharePlace = () => !!globalThis.isSecureContext && !!globalThis.navigator?.geolocation;

/**
 * While the pilgrim shares their place: the phone's position goes to the
 * platform when they have moved, or every so often, more often during a call
 * for help. Only while this page is open: background tracking needs the phone
 * app.
 */
export function useSharePlace(source: RafeeqSource | null, on: boolean, urgent: boolean): string | null {
  const [sentAt, setSentAt] = useState<string | null>(null);
  const last = useRef<{ t: number; lat: number; lon: number } | null>(null);
  const urgentRef = useRef(urgent);
  urgentRef.current = urgent;
  useEffect(() => {
    if (!source || !on || !canSharePlace()) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lon, accuracy } = p.coords;
        const prev = last.current;
        const moved = prev ? Math.hypot((lat - prev.lat) * 111_000, (lon - prev.lon) * 101_000) : Infinity;
        const wait = urgentRef.current ? 10_000 : 30_000;
        if (prev && moved < 25 && Date.now() - prev.t < wait) return;
        last.current = { t: Date.now(), lat, lon };
        source.location(lat, lon, Math.round(accuracy), "phone").then(
          () => setSentAt(new Date().toISOString()),
          () => {},
        );
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [source, on]);
  return sentAt;
}

/** "Sharing where you are", with a switch. */
export function PlaceLine({ page, lang, onTurn }: { page: RafeeqPage; lang: RafeeqLang; onTurn: (on: boolean) => void }) {
  const on = page.consent.location;
  return (
    <section className={`${r.place} ${on ? r.placeOn : ""}`}>
      <span className={r.placeIcon}>
        <Pin />
      </span>
      <span className={r.placeText}>
        {on ? say("Sharing where you are", lang) : say("Not sharing where you are", lang)}
        {on && !canSharePlace() && <small className={r.quiet}>{say("This phone cannot share where you are on this link.", lang)}</small>}
      </span>
      <button type="button" className={r.plain} onClick={() => onTurn(!on)}>
        {on ? say("Stop sharing", lang) : say("Turn on", lang)}
      </button>
    </section>
  );
}

/**
 * Dangerous readings: the whole screen counts down, the phone buzzes, and one
 * big green button stops it. When the count runs out the platform calls the
 * medics, whether or not this page is still open.
 */
export function Countdown({ alert, lang, onOk, speak }: { alert: RafeeqAlert; lang: RafeeqLang; onOk: () => void; speak: ((t: string) => void) | null }) {
  const deadline = useRef<{ id: string; at: number } | null>(null);
  if (deadline.current?.id !== alert.id) deadline.current = { id: alert.id, at: Date.now() + alert.seconds_left * 1000 };
  const [now, setNow] = useState(Date.now());
  const left = Math.max(0, Math.ceil((deadline.current.at - now) / 1000));
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (left > 0 && left % 2 === 0) globalThis.navigator?.vibrate?.([300, 150, 300]);
  }, [left]);
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (spoken.current === alert.id || !speak) return;
    spoken.current = alert.id;
    speak(`${say("Your readings look dangerous.", lang)} ${say("If you are well, press the green button.", lang)}`);
  }, [alert.id, lang, speak]);
  return (
    <section className={r.countdown} role="alertdialog" aria-labelledby="rafeeq-count">
      <span className={r.countIcon}>
        <Heart />
      </span>
      <p className={r.countTitle}>{say("Your readings look dangerous.", lang)}</p>
      <p className={r.countNumber} aria-hidden="true">
        {left}
      </p>
      <p id="rafeeq-count" className={r.lead}>
        {left > 0 ? say("Calling medical help in {n} seconds.", lang, { n: left }) : say("Calling medical help…", lang)}
      </p>
      {left > 0 && (
        <>
          <p>{say("If you are well, press the green button.", lang)}</p>
          <button type="button" className={`${r.big} ${r.ok}`} onClick={onOk}>
            {say("I AM OK", lang)}
          </button>
        </>
      )}
    </section>
  );
}

/** The demonstration's buttons: pretend readings from a watch, and a pretend place. Demonstration operators only. */
export function DemoTry({ lang, page, send, place }: { lang: RafeeqLang; page: RafeeqPage; send: (r: ReturnType<typeof series>) => void; place: () => void }) {
  return (
    <details className={r.demo}>
      <summary>{say("Try it (demonstration)", lang)}</summary>
      {page.consent.health && (
        <div className={r.demoButtons}>
          <button type="button" className={r.plain} onClick={() => send(series(35, 5, 80, 36.8))}>
            {say("Normal readings", lang)}
          </button>
          <button type="button" className={r.plain} onClick={() => send(series(35, 5, 98, 38.5))}>
            {say("Fever", lang)}
          </button>
          <button type="button" className={r.plain} onClick={() => send(series(15, 5, 114, 37.9))}>
            {say("Heat exhaustion signs", lang)}
          </button>
          <button type="button" className={r.plain} onClick={() => send(series(6, 1, 160, 37.0))}>
            {say("Very fast heart", lang)}
          </button>
          <button type="button" className={r.plain} onClick={() => send(series(35, 5, 132, 38.7))}>
            {say("Fever and fast heart", lang)}
          </button>
        </div>
      )}
      {page.consent.location && (
        <div className={r.demoButtons}>
          <button type="button" className={r.plain} onClick={place}>
            {say("Send a demo place", lang)}
          </button>
        </div>
      )}
    </details>
  );
}
