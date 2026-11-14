import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/500.css";
import type { ComponentType } from "react";
import { Globe } from "./Globe";
import { NATIVE_NAMES, RAFEEQ_LANGUAGES, isRtl, type RafeeqLang } from "./help";
import { AskIcon, CompassIcon, SirenIcon } from "./icons";
import { RafeeqMark } from "./Logo";
import { iso, say } from "./words";
import r from "./rafeeq.module.css";

/*
 * The cover, in the Sky Logics manner: dark, a glowing dotted globe turning
 * over Arabia with pilgrims' routes flying in to Jeddah and Madinah, a bold
 * headline with its accent in turquoise, and four glass cards for what
 * Rafeeq does. The status dot is real: turquoise when the platform answered,
 * amber with no signal. Large type and a Start button that stays in view,
 * for older pilgrims. Shown on a card's first opening only: an SOS must
 * never wait behind it. With reduced motion on, everything shows at once.
 */

const HeartIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 27s-10-6.1-12.8-12.3C1.3 10.2 4 5 8.9 5c2.8 0 4.8 1.6 5.7 3.2C15.6 6.6 17.6 5 20.4 5c4.9 0 7.6 5.2 5.7 9.7C23.3 20.9 16 27 16 27z" fill="currentColor" />
    <path d="M6 16h5l2-4 3 8 2-4h8" stroke="#06191c" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

const CARDS: { icon: ComponentType; title: string; sub: string }[] = [
  { icon: SirenIcon, title: "SOS", sub: "Help in one press" },
  { icon: CompassIcon, title: "Find my way", sub: "Back to your group" },
  { icon: AskIcon, title: "Ask Rafeeq", sub: "Answers in your language" },
  { icon: HeartIcon, title: "Your health", sub: "Heart, heat and water" },
];

/** The English the cover passes to say() through its table, for the words test. */
export const COVER_LINES = CARDS.flatMap((c) => [c.title, c.sub]);

export function Cover({
  lang,
  name,
  connected,
  onLang,
  onStart,
}: {
  lang: RafeeqLang;
  /** the pilgrim's first name, once their page has loaded */
  name: string | null;
  /** null while still asking */
  connected: boolean | null;
  onLang: (l: RafeeqLang) => void;
  onStart: () => void;
}) {
  const rtl = isRtl(lang);
  return (
    <div className={r.cover} dir={rtl ? "rtl" : "ltr"} lang={lang}>
      <div className={r.cvFrame}>
        <header className={r.cvTop}>
          <span className={r.cvTile}>
            <RafeeqMark size={40} />
          </span>
          <span className={r.cvBrand}>
            <span className={r.cvWordmark} dir="ltr">
              <b>Rafeeq</b>
              <span lang="ar">رفيق</span>
              <em>{say("Pilot", lang)}</em>
            </span>
            <span className={r.cvLabel}>{say("Hajj and Umrah companion", lang)}</span>
          </span>
          <span
            className={`${r.cvStatus} ${connected === false ? r.cvStatusOff : ""}`}
            role="img"
            aria-label={connected === false ? say("No connection", lang) : say("Connected", lang)}
          >
            <i />
          </span>
        </header>

        <section className={r.cvHero}>
          <Globe className={r.cvGlobe} />
          <div className={r.cvHeadline}>
            {name && <p className={r.cvWelcome}>{say("Welcome, {name}", lang, { name: iso(name) })}</p>}
            <h1>
              <span className={r.cvLine1}>{say("Your companion", lang)}</span>{" "}
              <span className={r.cvAccent}>{say("for Hajj and Umrah.", lang)}</span>
            </h1>
          </div>
        </section>

        <p className={r.cvBody}>{say("Help in one press, the way back to your group, and answers in your language, day and night.", lang)}</p>

        <div className={r.cvCards}>
          {CARDS.map((c, i) => (
            <div key={c.title} className={r.cvCardItem} style={{ animationDelay: `${1.5 + i * 0.12}s` }}>
              <span className={r.cvCardIcon}>
                <c.icon />
              </span>
              <span>
                <b>{say(c.title, lang)}</b>
                <small>{say(c.sub, lang)}</small>
              </span>
            </div>
          ))}
        </div>

        <div className={r.cvLangs} role="group" aria-label={say("Language", lang)}>
          {RAFEEQ_LANGUAGES.map((l) => (
            <button key={l} type="button" lang={l} aria-pressed={l === lang} onClick={() => onLang(l)}>
              {NATIVE_NAMES[l]}
            </button>
          ))}
        </div>

        <div className={r.cvStartBar}>
          <button type="button" className={r.cvStart} onClick={onStart}>
            {say("Start", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
