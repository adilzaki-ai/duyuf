import { useEffect, useRef, useState } from "react";
import { DataSourceError } from "../api/dataSource";
import { AMBULANCE, EMERGENCY, isRafeeqLang, isRtl, NATIVE_NAMES, RAFEEQ_LANGUAGES, type HelpKind, type RafeeqLang } from "./help";
import { cardToken, createRafeeqSource, type RafeeqCall, type RafeeqPage, type RafeeqSource } from "./source";
import { iso, say } from "./words";
import r from "./rafeeq.module.css";

/**
 * Rafeeq: the pilgrim's own page, opened from the QR code on their card.
 *
 * Three calls for help, their group leader's number and the emergency numbers,
 * in six languages, on a cheap phone with a weak signal. It never says a call
 * went out unless the platform took it: when it did not, it says so and shows
 * the numbers to call instead. The page is saved on the phone, so the numbers
 * are there even with no signal at all.
 */

const LANG_KEY = "rafeeq.lang";
const PAGE_KEY = "rafeeq.page";
const POLL_MS = 15_000;

type Start = () => Promise<RafeeqSource | null>;
type Problem = "no-card" | "stopped" | "offline" | null;
type View = { name: "home" } | { name: "heat" } | { name: "confirm"; kind: HelpKind } | { name: "failed"; kind: HelpKind };

const defaultStart: Start = async () => {
  const token = cardToken();
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

const KIND_NAME: Record<HelpKind, string> = { sos: "SOS", lost: "I am lost", heat: "Unwell in the heat" };

const HEAT_ADVICE = [
  "Drink water often, even if you are not thirsty.",
  "Stay in the shade and use an umbrella.",
  "Avoid the midday sun when you can.",
];
const HEAT_WARNING = "Headache, dizziness, sickness or very hot skin? Stop, find shade, drink water, and press the button below.";

/** The English the page passes to say() through its tables, for the words test. */
export const RAFEEQ_TABLE_LINES = [...Object.values(KIND_NAME), ...HEAT_ADVICE, HEAT_WARNING];

export function RafeeqApp({ start = defaultStart }: { start?: Start }) {
  const [lang, setLangState] = useState<RafeeqLang>(() => firstLang() ?? "en");
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

  /* while a call is still open, follow it */
  const following = !!page?.calls.some((c) => c.status !== "resolved");
  useEffect(() => {
    if (!source || !following) return;
    const every = setInterval(() => {
      source.me().then(took, () => {});
    }, POLL_MS);
    return () => clearInterval(every);
  }, [source, following]);

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
        <h1 className={r.hello}>{s("Assalamu alaikum, {name}", { name: iso(name) })}</h1>
        <p className={r.quiet}>{s("Press a button if you need help.")}</p>
        {page.calls.map((c) => (
          <CallCard key={c.id} call={c} lang={lang} onFine={() => void fine(c)} />
        ))}
        <button type="button" className={`${r.big} ${r.sos}`} onClick={() => ask("sos")}>
          <b>{s("SOS")}</b>
          <span>{s("Emergency: I need help now")}</span>
        </button>
        <button type="button" className={`${r.big} ${r.lost}`} onClick={() => ask("lost")}>
          {s("I am lost")}
        </button>
        <button type="button" className={`${r.big} ${r.heat}`} onClick={() => setView({ name: "heat" })}>
          {s("Heat safety")}
        </button>
        <Numbers lang={lang} page={page} />
      </>
    );
  }

  return (
    <div className={r.app} lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
      <header className={r.top}>
        <span className={r.brand}>{s("Rafeeq")}</span>
        {page && (
          <span className={r.operator} dir="auto">
            {(isRtl(lang) && page.operator_ar) || page.operator}
          </span>
        )}
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
