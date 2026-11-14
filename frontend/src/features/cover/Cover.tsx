import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import type { ReactNode } from "react";
import { DuyufLogo } from "../../design/DuyufMark";
import { MINISTRY_LOGO, VISION_2030_LOGO } from "../../design/partners";
import { t, useLang } from "../../i18n";
import { CREDITS, photoOf } from "../../rafeeq/guide/photos";
import c from "./cover.module.css";

/**
 * Duyuf's start-up page, in the family of Rafeeq's cover: dark, a glowing
 * doorway pattern, the logo, a two-tone headline, the Two Holy Mosques, and
 * glass cards for what Duyuf does. Shown when the app opens (every time in the
 * client demo, once a browser session otherwise), never in tests.
 *
 * The two spots at the top take the Vision 2030 and Ministry of Hajj and Umrah
 * logos only when their files are added with permission (design/partners);
 * until then each shows a line of text.
 */

const CARDS: { icon: string; title: string; sub: string }[] = [
  { icon: "✈", title: "Arrivals", sub: "Every flight, and who meets it" },
  { icon: "👥", title: "Pilgrims", sub: "Each guest's journey" },
  { icon: "🚨", title: "Incidents", sub: "SOS calls in seconds" },
  { icon: "❤", title: "Health", sub: "Heat and heart, with consent" },
  { icon: "🏨", title: "Bookings", sub: "Hotels, food and visits" },
  { icon: "📱", title: "Rafeeq", sub: "The pilgrim's own app" },
];

/** The English the cover passes to t() through its table, for the Arabic coverage test. */
export const COVER_LINES_EN = CARDS.flatMap((x) => [x.title, x.sub]);

const MOSQUES = [
  { id: "haram" as const, name: "Al-Masjid al-Haram", city: "Makkah" },
  { id: "nabawi" as const, name: "The Prophet's Mosque", city: "Madinah" },
];
export const MOSQUE_LINES_EN = MOSQUES.flatMap((m) => [m.name, m.city]);

/** `mono`: a black-on-white logo, shown white on the dark page. `framed`: a logo with its own background, in a rounded frame. */
function Spot({ logo, alt, mono, framed, children }: { logo: string | null; alt: string; mono?: boolean; framed?: boolean; children: ReactNode }) {
  return logo ? <img className={`${c.partnerLogo} ${mono ? c.mono : ""} ${framed ? c.framed : ""}`} src={logo} alt={alt} /> : <span className={c.partnerText} dir="auto">
      {children}
    </span>;
}

export function Cover({ state, onEnter }: { state: "loading" | "live" | "sample" | "failed"; onEnter: () => void }) {
  const { lang, setLang } = useLang();
  const small = (globalThis.innerWidth ?? 1024) < 520;
  return (
    <div className={c.cover} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <div className={c.glow} aria-hidden="true" />
      <div className={c.frame}>
        {/* Vision 2030 at the top left and the Ministry in the centre, in Arabic too */}
        <header className={c.top} dir="ltr">
          <div className={c.topStart}>
            <Spot logo={VISION_2030_LOGO} alt="Saudi Vision 2030" framed>
              {t("In support of Saudi Vision 2030")}
            </Spot>
          </div>
          <div className={c.topCenter}>
            <Spot logo={MINISTRY_LOGO} alt="Ministry of Hajj and Umrah">
              {t("For companies serving Hajj and Umrah pilgrims")}
            </Spot>
          </div>
          <div className={c.topEnd}>
            <span className={`${c.status} ${c[`st_${state}`]}`} role="img" aria-label={t(STATE[state])} title={t(STATE[state])}>
              <i />
            </span>
            <div className={c.langs} role="group" aria-label={t("Language")}>
              <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
                English
              </button>
              <button type="button" lang="ar" aria-pressed={lang === "ar"} onClick={() => setLang("ar")}>
                العربية
              </button>
            </div>
          </div>
        </header>

        <section className={c.hero}>
          <div className={c.brand}>
            <DuyufLogo size={small ? 52 : 76} light tagline={t("Hajj and Umrah operations")} />
            <p className={c.motto} lang="ar" dir="rtl">
              في خدمة ضيوف الرحمن
            </p>
          </div>
          <h1 className={c.headline}>
            <span className={c.line1}>{t("Every guest,")}</span> <span className={c.accent}>{t("looked after.")}</span>
          </h1>
          <p className={c.body}>{t("Arrivals, pilgrims, health, incidents and bookings for Hajj and Umrah companies, in one place.")}</p>
        </section>

        <div className={c.mosques}>
          {MOSQUES.map((m, i) => {
            const credit = CREDITS[m.id];
            return (
              <figure key={m.id} className={c.mosque} style={{ animationDelay: `${0.6 + i * 0.15}s` }}>
                <img src={photoOf(m.id) ?? ""} alt={t(m.name)} />
                <figcaption>
                  <b>{t(m.name)}</b>
                  <span>{t(m.city)}</span>
                </figcaption>
                {credit && (
                  <small className={c.credit} dir="ltr">
                    {credit.author} · {credit.license}, resized
                  </small>
                )}
              </figure>
            );
          })}
        </div>

        <div className={c.cards}>
          {CARDS.map((x, i) => (
            <div key={x.title} className={c.card} style={{ animationDelay: `${1 + i * 0.08}s` }}>
              <span className={c.cardIcon} aria-hidden="true">
                {x.icon}
              </span>
              <span>
                <b>{t(x.title)}</b>
                <small>{t(x.sub)}</small>
              </span>
            </div>
          ))}
        </div>

        <div className={c.startBar}>
          <button type="button" className={c.start} onClick={onEnter} disabled={state === "loading"}>
            {state === "loading" ? t("Loading…") : t("Enter Duyuf")}
          </button>
          {state === "sample" && <p className={c.note}>{t("Sample data: invented pilgrims, nothing is saved.")}</p>}
        </div>
      </div>
    </div>
  );
}

const STATE = { loading: "Connecting…", live: "Connected", sample: "Sample data", failed: "Cannot connect" } as const;
export const STATE_LINES_EN = Object.values(STATE);

const SEEN_KEY = "duyuf.cover";

/** Every time in the client demo; once a browser session otherwise; never in tests. */
export function coverFirst(): boolean {
  if (import.meta.env.MODE === "test") return false;
  if (import.meta.env.VITE_ROUTER === "hash") return true;
  try {
    return sessionStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    return false;
  }
}

export function coverSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private window: it shows again next time */
  }
}
