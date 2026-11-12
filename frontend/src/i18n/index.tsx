import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AR } from "./ar";

export { AR };
export type Lang = "en" | "ar";

const KEY = "duyuf.lang";
let current: Lang = read();

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

export const getLang = () => current;

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

/** English is the key; Arabic from ar.ts when the reader chose Arabic. A missing entry shows the English. */
export function t(en: string, vars?: Record<string, string | number>): string {
  return fill(current === "ar" ? (AR[en] ?? en) : en, vars);
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    current = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* private window: the choice lasts this visit */
    }
    setLangState(l);
  };
  /* keyed on the language, so every t() below is read again */
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div key={lang} style={{ display: "contents" }}>
        {children}
      </div>
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);

/** Numbers stay in Western digits, as Saudi apps commonly show them. */
export const fmtNum = (n: number) => new Intl.NumberFormat("en").format(n);

const locale = () => (current === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");

/** "13 Nov 2026" — the Gregorian date of a YYYY-MM-DD. */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00Z`),
  );
}

/** "2 Jumada II 1448" — the Umm al-Qura (Saudi official) date, beside the Gregorian one. */
export function fmtHijri(iso: string | null): string {
  if (!iso) return "";
  const loc = current === "ar" ? "ar-SA-u-ca-islamic-umalqura-nu-latn" : "en-u-ca-islamic-umalqura";
  return new Intl.DateTimeFormat(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00Z`),
  );
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat(current === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));
}

export function countryName(cc: string): string {
  try {
    return new Intl.DisplayNames([current], { type: "region" }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}
