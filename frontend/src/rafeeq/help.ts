/**
 * What a pilgrim can ask for on Rafeeq, and in which languages.
 *
 * The platform's tables are backend/api/duyuf/rafeeq/help.py; help.test.ts
 * reads that file and fails if the two ever differ.
 */
export const RAFEEQ_LANGUAGES = ["en", "ar", "id", "ur", "tr", "fr"] as const;
export type RafeeqLang = (typeof RAFEEQ_LANGUAGES)[number];

export const HELP_KINDS = ["sos", "lost", "heat"] as const;
export type HelpKind = (typeof HELP_KINDS)[number];

/** Each language in its own words, for the chooser. */
export const NATIVE_NAMES: Record<RafeeqLang, string> = {
  en: "English",
  ar: "العربية",
  id: "Bahasa Indonesia",
  ur: "اردو",
  tr: "Türkçe",
  fr: "Français",
};

export const isRtl = (l: RafeeqLang) => l === "ar" || l === "ur";

export const isRafeeqLang = (s: string | null | undefined): s is RafeeqLang =>
  (RAFEEQ_LANGUAGES as readonly string[]).includes(s ?? "");

/** Saudi numbers a pilgrim can call whatever happens to the network. */
export const EMERGENCY = "911";
export const AMBULANCE = "997";
