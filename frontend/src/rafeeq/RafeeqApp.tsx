import { useEffect, useRef, useState } from "react";
import { DataSourceError } from "../api/dataSource";
import { resolvedDataSource } from "../config/env";
import { AMBULANCE, EMERGENCY, isRafeeqLang, isRtl, NATIVE_NAMES, RAFEEQ_LANGUAGES, type HelpKind, type RafeeqLang } from "./help";
import { AskRafeeq } from "./AskRafeeq";
import { Cover } from "./Cover";
import { FindMyWay } from "./FindMyWay";
import { AskIcon, CompassIcon, SirenIcon, SunIcon } from "./icons";
import { RafeeqLogo } from "./Logo";
import { ConsentCard, Countdown, DemoTry, HealthPanel, HeatWarning, PlaceLine, useSharePlace } from "./HealthParts";
import { cardToken, createRafeeqSource, type AskAction, type NewReading, type RafeeqCall, type RafeeqPage, type RafeeqSource } from "./source";
import { WALK } from "./places";
import { iso, say } from "./words";
import "@fontsource/reem-kufi/500.css";
import "@fontsource/reem-kufi/600.css";
import r from "./rafeeq.module.css";

/**
 * Rafeeq: the pilgrim's own page, opened from the QR code on their card.
 *
 * Three calls for help, their group leader's number and the emergency numbers,
 * in six languages, on a cheap phone with a weak signal. With the pilgrim's
 * consent, their heart rate, temperature and water from a watch, and where
 * they are; dangerous readings count down to a call for medical help
 * (HealthParts.tsx). It never says a call
 * went out unless the platform took it: when it did not, it says so and shows
 * the numbers to call instead. The page is saved on the phone, so the numbers
 * are there even with no signal at all.
 */

const LANG_KEY = "rafeeq.lang";
const PAGE_KEY = "rafeeq.page";
const POLL_MS = 15_000;
/* readings from a watch can arrive at any time; look for them, and for a countdown, this often */
const HEALTH_POLL_MS = 20_000;
const ALERT_POLL_MS = 2_000;

type Start = () => Promise<RafeeqSource | null>;
type Problem = "no-card" | "stopped" | "offline" | null;
type View = { name: "home" } | { name: "heat" } | { name: "way" } | { name: "ask" } | { name: "confirm"; kind: HelpKind } | { name: "failed"; kind: HelpKind };

const defaultStart: Start = async () => {
  /* the sample needs no card: a demonstration opens straight on its invented pilgrim */
  const token = cardToken() ?? (resolvedDataSource() === "mock" ? "rfq_sample" : null);
  return token ? createRafeeqSource(token) : null;
};

function store<T>(key: string, value?: T | null): T | null {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window or storage off: the page still works, it just forgets */
  }
  return null;
}

function firstLang(): RafeeqLang | null {
  const chosen = store<string>(LANG_KEY);
  if (isRafeeqLang(chosen)) return chosen;
  return null;
}

/** Where the phone is, if the pilgrim allows it and it comes quickly; otherwise nothing. */
function whereAmI(): Promise<string | null> {
  if (!globalThis.isSecureContext || !globalThis.navigator?.geolocation) return Promise.resolve(null);
  return new Promise((done) => {
    const give = setTimeout(() => done(null), 8_000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(give);
        const { latitude, longitude, accuracy } = p.coords;
        done(`${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)} m)`);
      },
      () => {
        clearTimeout(give);
        done(null);
      },
      { enableHighAccuracy: true, timeout: 7_000, maximumAge: 120_000 },
    );
  });
}

/** Reads text aloud in the page's language, when the phone has a voice for it. */
function useVoice(lang: RafeeqLang): ((text: string) => void) | null {
  const [has, setHas] = useState(false);
  useEffect(() => {
    const s = globalThis.speechSynthesis;
    if (!s) return;
    const check = () => setHas(s.getVoices().some((v) => v.lang.toLowerCase().startsWith(lang)));
    check();
    s.addEventListener?.("voiceschanged", check);
    return () => s.removeEventListener?.("voiceschanged", check);
  }, [lang]);
  if (!has) return null;
  return (text) => {
    const s = globalThis.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.voice = s.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
    u.rate = 0.9;
    s.speak(u);
  };
}

/* the sample pilgrim stands near the Prophet's Mosque when the phone gives no place (the demo's viewer never does) */
const SAMPLE_STAND = { lat: 24.4705, lon: 39.6046 };

const KIND_NAME: Record<RafeeqCall["kind"], string> = {
  sos: "SOS",
  lost: "I am lost",
  heat: "Unwell in the heat",
  medical: "Medical alert",
};

const HEAT_ADVICE = [
  "Drink water often, even if you are not thirsty.",
  "Stay in the shade and use an umbrella.",
  "Avoid the midday sun when you can.",
];
const HEAT_WARNING = "Headache, dizziness, sickness or very hot skin? Stop, find shade, drink water, and press the button below.";

/** The English the page passes to say() through its tables, for the words test. */
export const RAFEEQ_TABLE_LINES = [...Object.values(KIND_NAME), ...HEAT_ADVICE, HEAT_WARNING, ...WALK];

const WELCOMED_KEY = "rafeeq.welcomed";

/** The cover shows on a card's first opening (and every time in the client demo); never in tests. */
function coverFirst(): boolean {
  if (import.meta.env.MODE === "test") return false;
  if (import.meta.env.VITE_ROUTER === "hash") return true;
  return store<boolean>(WELCOMED_KEY) !== true;
}

/** "Saturday 14 November · 23 Jumada I 1448 · 12:40": the day, the Umm al-Qura date, and Saudi time. */
function today(lang: RafeeqLang, now = new Date()): string {
  const tz = "Asia/Riyadh";
  try {
    const day = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now);
    const hijri = new Intl.DateTimeFormat(`${lang}-u-ca-islamic-umalqura-nu-latn`, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: tz,
    }).format(now);
    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(now);
    return `${day} · ${hijri} · \u2066${time}\u2069`;
  } catch {
    return "";
  }
}

export function RafeeqApp({ start = defaultStart, cover }: { start?: Start; cover?: boolean }) {
  const [lang, setLangState] = useState<RafeeqLang>(() => firstLang() ?? "en");
  const [showCover, setShowCover] = useState(() => cover ?? coverFirst());
  const chose = useRef(firstLang() !== null);
  const [source, setSource] = useState<RafeeqSource | null>(null);
  const [page, setPage] = useState<RafeeqPage | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: "home" });
  const [sending, setSending] = useState(false);
  const where = useRef<Promise<string | null> | null>(null);
  const speak = useVoice(lang);

  const setLang = (l: RafeeqLang) => {
    chose.current = true;
    store(LANG_KEY, l);
    setLangState(l);
  };

  const took = (p: RafeeqPage) => {
    setPage(p);
    setProblem(null);
    store(PAGE_KEY, p);
    if (!chose.current) setLangState(p.language);
  };

  const failed = (err: unknown) => {
    if (err instanceof DataSourceError && err.status === 401) {
      store(PAGE_KEY, null);
      setPage(null);
      setProblem("stopped");
    } else {
      /* no signal: show what was saved, and the numbers */
      setPage((p) => p ?? store<RafeeqPage>(PAGE_KEY));
      setProblem("offline");
    }
  };

  useEffect(() => {
    let live = true;
    start()
      .then(async (s) => {
        if (!live) return;
        if (!s) {
          setProblem("no-card");
          return;
        }
        setSource(s);
        try {
          const p = await s.me();
          if (live) took(p);
        } catch (err) {
          if (live) failed(err);
        }
      })
      .catch((err: unknown) => live && failed(err))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    /* once, on opening */
  }, [start]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    document.title = say("Rafeeq", lang);
  }, [lang]);

  /* while a call is open, a countdown runs or a watch may send readings, follow the page */
  const following = !!page?.calls.some((c) => c.status !== "resolved");
  const counting = !!page?.alert;
  const watching = !!page?.consent?.health;
  const every = counting ? ALERT_POLL_MS : following ? POLL_MS : watching ? HEALTH_POLL_MS : null;
  useEffect(() => {
    if (!source || !every) return;
    const timer = setInterval(() => {
      source.me().then(took, () => {});
    }, every);
    return () => clearInterval(timer);
  }, [source, every]);

  useSharePlace(source, !!page?.consent?.location, following || counting);

  const [busy, setBusy] = useState(false);
  const act = async (go: (s: RafeeqSource) => Promise<RafeeqPage>) => {
    if (!source) return;
    setBusy(true);
    try {
      took(await go(source));
    } catch (err) {
      if (err instanceof DataSourceError && err.status === 409) source.me().then(took, () => {});
      else failed(err);
    } finally {
      setBusy(false);
    }
  };
  const answer = (c: { health?: boolean; location?: boolean }) => void act((s) => s.consent(c));
  const drank = () => void act((s) => s.water());
  const imOk = (id: string) => void act((s) => s.iAmOk(id));
  const demoReadings = (r: NewReading[]) => void act((s) => s.readings(r, "simulated"));
  /* the step Ask Rafeeq suggested, pressed by the pilgrim */
  const doSuggested = (a: AskAction) => {
    if (a === "sos") ask("sos");
    else if (a === "find_my_way") setView({ name: "way" });
    else if (a === "drank_water") drank();
    else if (a === "heat_safety") setView({ name: "heat" });
  };
  const demoPlace = () =>
    void act(async (s) => {
      await s.location(24.4672 + (Math.random() - 0.5) * 0.004, 39.6112 + (Math.random() - 0.5) * 0.004, 20, "simulated");
      return s.me();
    });

  const ask = (kind: HelpKind) => {
    where.current = whereAmI();
    setView({ name: "confirm", kind });
  };

  const send = async (kind: HelpKind) => {
    if (!source) return setView({ name: "failed", kind });
    setSending(true);
    try {
      const location = await Promise.race([where.current ?? Promise.resolve(null), new Promise<null>((d) => setTimeout(() => d(null), 3_000))]);
      took(await source.help(kind, location, lang));
      setView({ name: "home" });
    } catch (err) {
      if (err instanceof DataSourceError && err.status === 401) failed(err);
      setView({ name: "failed", kind });
    } finally {
      setSending(false);
    }
  };

  const fine = async (c: RafeeqCall) => {
    if (!source) return;
    try {
      took(await source.fine(c.id));
    } catch (err) {
      failed(err);
    }
  };

  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  const name = page ? firstName(page, lang) : "";

  let body;
  let spoken = "";
  if (loading) {
    body = <p className={r.quiet}>…</p>;
  } else if (problem === "no-card" || problem === "stopped") {
    const line = problem === "no-card" ? s("Scan the QR code on your Rafeeq card to open this page.") : s("This card no longer works. Ask your group leader for a new one.");
    spoken = line;
    body = (
      <>
        <p className={r.lead}>{line}</p>
        <Numbers lang={lang} page={null} />
      </>
    );
  } else if (!page) {
    spoken = s("Cannot connect. If you need help, call:");
    body = (
      <>
        <p className={r.lead} role="alert">
          {s("Cannot connect. If you need help, call:")}
        </p>
        <Numbers lang={lang} page={null} />
      </>
    );
  } else if (page.alert && problem !== "offline") {
    spoken = s("Your readings look dangerous.");
    body = (
      <>
        <Countdown alert={page.alert} lang={lang} onOk={() => imOk(page.alert!.id)} speak={speak} />
        <Numbers lang={lang} page={page} />
      </>
    );
  } else if (view.name === "confirm") {
    spoken = `${s(KIND_NAME[view.kind])}. ${s("Send a call for help now?")}`;
    body = (
      <section className={r.confirm} role="alertdialog" aria-labelledby="rafeeq-ask">
        <h2 className={view.kind === "sos" ? r.sosText : undefined}>{s(KIND_NAME[view.kind])}</h2>
        <p id="rafeeq-ask" className={r.lead}>
          {s("Send a call for help now?")}
        </p>
        <p className={r.quiet}>{s("Your phone may ask to share where you are. Say yes so the team can find you.")}</p>
        <button type="button" className={`${r.big} ${r.sos}`} disabled={sending} onClick={() => void send(view.kind)}>
          {sending ? s("Sending…") : s("Yes, send")}
        </button>
        <button type="button" className={r.plain} disabled={sending} onClick={() => setView({ name: "home" })}>
          {s("No")}
        </button>
      </section>
    );
  } else if (view.name === "failed") {
    spoken = s("Your call was NOT sent. Call now:");
    body = (
      <section className={r.failed} role="alert">
        <p className={r.lead}>
          <b>{s("Your call was NOT sent. Call now:")}</b>
        </p>
        <Numbers lang={lang} page={page} />
        <button type="button" className={`${r.big} ${r.sos}`} disabled={sending} onClick={() => void send(view.kind)}>
          {sending ? s("Sending…") : s("Try again")}
        </button>
        <button type="button" className={r.plain} disabled={sending} onClick={() => setView({ name: "home" })}>
          {s("Back")}
        </button>
      </section>
    );
  } else if (view.name === "ask" && source) {
    spoken = s("Ask Rafeeq");
    body = (
      <>
        <AskRafeeq source={source} page={page} lang={lang} speak={speak} act={doSuggested} />
        <button type="button" className={r.plain} onClick={() => setView({ name: "home" })}>
          {s("Back")}
        </button>
        <Numbers lang={lang} page={page} />
      </>
    );
  } else if (view.name === "way") {
    spoken = `${s("Find my way")}. ${s("Where do you want to go?")}`;
    body = (
      <>
        <FindMyWay
          page={page}
          lang={lang}
          onStillLost={() => ask("lost")}
          onBack={() => setView({ name: "home" })}
          stand={source?.kind === "mock" ? SAMPLE_STAND : null}
        />
        <Numbers lang={lang} page={page} />
      </>
    );
  } else if (view.name === "heat") {
    const advice = HEAT_ADVICE;
    const warning = HEAT_WARNING;
    spoken = [...advice, warning].map((a) => s(a)).join(" ");
    body = (
      <section>
        <h2>{s("Heat safety")}</h2>
        <ul className={r.advice}>
          {advice.map((a) => (
            <li key={a}>{s(a)}</li>
          ))}
        </ul>
        <p className={r.warning}>{s(warning)}</p>
        <button type="button" className={`${r.big} ${r.lost}`} onClick={() => ask("heat")}>
          {s("I feel unwell in the heat")}
        </button>
        <button type="button" className={r.plain} onClick={() => setView({ name: "home" })}>
          {s("Back")}
        </button>
      </section>
    );
  } else {
    spoken = [s("Assalamu alaikum, {name}", { name }), s("Press a button if you need help."), ...page.calls.map((c) => callLine(c, lang))].join(" ");
    body = (
      <>
        <section className={r.hero}>
          <h1 className={r.hello}>{s("Assalamu alaikum, {name}", { name: iso(name) })}</h1>
          <p className={r.today}>{today(lang)}</p>
          <p className={r.heroLine}>{s("Press a button if you need help.")}</p>
          <p className={r.heroOperator} dir="auto">
            {(isRtl(lang) && page.operator_ar) || page.operator} · {page.group_name}
          </p>
        </section>
        {!page.consent?.health && <HeatWarning lang={lang} />}
        {page.calls.map((c) => (
          <CallCard key={c.id} call={c} lang={lang} onFine={() => void fine(c)} />
        ))}
        <button type="button" className={`${r.big} ${r.sos} ${r.sosHome}`} onClick={() => ask("sos")}>
          <span className={r.sosRing} aria-hidden="true">
            <SirenIcon />
          </span>
          <span className={r.sosWords}>
            <b>{s("SOS")}</b>
            <span>{s("Emergency: I need help now")}</span>
          </span>
        </button>
        <button type="button" className={`${r.big} ${r.askHome}`} onClick={() => setView({ name: "ask" })}>
          <span className={r.tileIcon}>
            <AskIcon />
          </span>
          <span className={r.tileWords}>
            <b>{s("Ask Rafeeq")}</b>
            <span>{s("Speak or type, in your language")}</span>
          </span>
        </button>
        <div className={r.tiles}>
          <button type="button" className={`${r.tile} ${r.lost}`} onClick={() => setView({ name: "way" })}>
            <span className={r.tileIcon}>
              <CompassIcon />
            </span>
            <b>{s("I am lost")}</b>
            <span>{s("Find my way")}</span>
          </button>
          <button type="button" className={`${r.tile} ${r.heat}`} onClick={() => setView({ name: "heat" })}>
            <span className={r.tileIcon}>
              <SunIcon />
            </span>
            <b>{s("Heat safety")}</b>
          </button>
        </div>
        {page.consent && problem !== "offline" && <ConsentCard page={page} lang={lang} onAnswer={answer} />}
        {page.consent?.health && page.health && (
          <HealthPanel health={page.health} recent={page.recent ?? []} lang={lang} onWater={drank} busy={busy} />
        )}
        {page.consent && <PlaceLine page={page} lang={lang} onTurn={(on) => answer({ location: on })} />}
        <Numbers lang={lang} page={page} />
        {(page.is_demo || source?.kind === "mock") && page.consent && (page.consent.health || page.consent.location) && (
          <DemoTry lang={lang} page={page} send={demoReadings} place={demoPlace} />
        )}
      </>
    );
  }

  if (showCover)
    return (
      <Cover
        lang={lang}
        name={page ? firstName(page, lang) : null}
        connected={loading ? null : problem === null}
        onLang={setLang}
        onStart={() => {
          store(WELCOMED_KEY, true);
          setShowCover(false);
          /* the press lets the phone speak: greet them */
          if (speak && page) speak(s("Assalamu alaikum, {name}", { name }) + " " + s("Press a button if you need help."));
        }}
      />
    );

  return (
    <div className={r.app} lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <header className={r.top}>
        <span className={r.brand}>
          <RafeeqLogo size={34} light />
        </span>
        <select className={r.lang} aria-label={s("Language")} value={lang} onChange={(e) => setLang(e.target.value as RafeeqLang)}>
          {RAFEEQ_LANGUAGES.map((l) => (
            <option key={l} value={l} lang={l}>
              {NATIVE_NAMES[l]}
            </option>
          ))}
        </select>
      </header>
      {source?.kind === "mock" ? (
        <p className={r.banner} role="status">
          {s("Sample: nothing is sent to anyone. In an emergency call 911.")}
        </p>
      ) : page?.is_demo ? (
        <p className={r.banner} role="status">
          {s("Demonstration: calls go to a practice operations room, not to real help. In an emergency call 911.")}
        </p>
      ) : null}
      {problem === "offline" && page && (
        <p className={r.banner} role="status">
          {s("No connection. This is what was saved on your phone.")}
        </p>
      )}
      <main className={r.main}>
        {speak && spoken && (
          <button type="button" className={r.listen} onClick={() => speak(spoken)}>
            {s("Listen")}
          </button>
        )}
        {body}
      </main>
      <footer className={r.foot}>{s("Rafeeq gives safety help only, not religious rulings.")}</footer>
    </div>
  );
}

function firstName(p: RafeeqPage, lang: RafeeqLang): string {
  const full = (isRtl(lang) && p.full_name_ar) || p.full_name;
  return full.trim().split(/\s+/)[0] ?? full;
}

function callLine(c: RafeeqCall, lang: RafeeqLang): string {
  if (c.status === "resolved") return say("This call is closed.", lang);
  if (c.status === "assigned") return say("A team is working on it.", lang);
  return say("Your call for help was received.", lang);
}

function CallCard({ call, lang, onFine }: { call: RafeeqCall; lang: RafeeqLang; onFine: () => void }) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  const open = call.status !== "resolved";
  return (
    <section className={`${r.call} ${open ? r.callOpen : ""}`} role="status">
      <p className={r.callHead}>
        <b>{s(KIND_NAME[call.kind])}</b> <span className={r.quiet}>{s("Number {ref}", { ref: `⁦#${call.ref}⁩` })}</span>
      </p>
      <p className={r.callLine}>{callLine(call, lang)}</p>
      {open && call.kind === "lost" && <p>{s("Stay where you are if it is safe.")}</p>}
      {call.pilgrim_ok_at ? (
        <p className={r.quiet}>{s("You said you are fine.")}</p>
      ) : (
        open && (
          <button type="button" className={r.plain} onClick={onFine}>
            {s("I am fine now")}
          </button>
        )
      )}
    </section>
  );
}

/** Who to call: their leader when known, and the Saudi emergency numbers, always. */
function Numbers({ lang, page }: { lang: RafeeqLang; page: RafeeqPage | null }) {
  const s = (en: string) => say(en, lang);
  const rows: { who: string; sub?: string | null; number: string }[] = [];
  if (page?.leader_phone) rows.push({ who: s("Your group leader"), sub: page.leader_name, number: page.leader_phone });
  rows.push({ who: s("Emergency services"), number: EMERGENCY }, { who: s("Ambulance"), number: AMBULANCE });
  return (
    <ul className={r.numbers}>
      {rows.map((x) => (
        <li key={x.number}>
          <a href={`tel:${x.number.replace(/[^\d+]/g, "")}`}>
            <span>
              {x.who}
              {x.sub && (
                <small dir="auto" className={r.quiet}>
                  {x.sub}
                </small>
              )}
            </span>
            <span className={r.dial}>
              <bdi dir="ltr">{x.number}</bdi>
              <b>{s("Call")}</b>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
