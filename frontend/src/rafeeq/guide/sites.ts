import type { RafeeqLang } from "../help";

/**
 * The places a pilgrim can plan to visit in Makkah and Madinah: the holy sites
 * and the main historic places and museums. Visiting them is optional and is
 * not part of Hajj or Umrah; the page says so.
 *
 * Coordinates come from Wikidata or Wikipedia and are good to a building or a
 * hillside, not to a gate. Two are NOT checked: hira_district (placed at the
 * foot of Jabal al-Nour) and dar_madinah (from a photo's GPS). `minutes` is time on site, `effort` how hard the visit is on foot,
 * `indoor` whether it is a good choice in the hot hours. All of these are
 * DRAFT figures for a licensed guide to correct.
 */
export type SiteId =
  | "haram"
  | "hira"
  | "hira_district"
  | "thawr"
  | "mina"
  | "khayf"
  | "jamarat"
  | "muzdalifah"
  | "arafat"
  | "rahmah"
  | "mualla"
  | "jinn"
  | "aisha"
  | "architecture"
  | "kiswa"
  | "nabawi"
  | "quba"
  | "baqi"
  | "uhud"
  | "qiblatayn"
  | "sabaa"
  | "ghamamah"
  | "jumuah"
  | "dar_madinah"
  | "hejaz_railway"
  | "seerah"
  | "quran_complex";

export type City = "makkah" | "madinah";
/** mosque, a place of Hajj rites, a mountain or landmark, a cemetery, a museum */
export type SiteKind = "mosque" | "hajj" | "landmark" | "cemetery" | "museum";
export type Effort = "easy" | "walk" | "climb";

export interface TripSite {
  id: SiteId;
  city: City;
  kind: SiteKind;
  lat: number;
  lon: number;
  minutes: number;
  effort: Effort;
  indoor: boolean;
  /** by appointment or permit: the plan says to ask the group leader */
  booking?: boolean;
  /** the first choices when a pilgrim asks Rafeeq to suggest a plan */
  top?: boolean;
}

/** One site's guide in one language. `see` and `tips` match English item for item. */
export interface SiteText {
  name: string;
  summary: string;
  story: string;
  see: string[];
  tips: string[];
}

export type Guide = Record<SiteId, SiteText>;
export type Guides = Record<RafeeqLang, Guide>;

export const TRIP_SITES: TripSite[] = [
  { id: "haram", city: "makkah", kind: "mosque", lat: 21.4225, lon: 39.8261, minutes: 90, effort: "walk", indoor: true, top: true },
  { id: "hira", city: "makkah", kind: "landmark", lat: 21.4576, lon: 39.8594, minutes: 150, effort: "climb", indoor: false, top: true },
  { id: "hira_district", city: "makkah", kind: "museum", lat: 21.4548, lon: 39.8597, minutes: 75, effort: "easy", indoor: true, top: true },
  { id: "thawr", city: "makkah", kind: "landmark", lat: 21.3775, lon: 39.8508, minutes: 45, effort: "easy", indoor: false },
  { id: "mina", city: "makkah", kind: "hajj", lat: 21.4133, lon: 39.8933, minutes: 30, effort: "easy", indoor: false, top: true },
  { id: "khayf", city: "makkah", kind: "mosque", lat: 21.4153, lon: 39.8778, minutes: 30, effort: "easy", indoor: true },
  { id: "jamarat", city: "makkah", kind: "hajj", lat: 21.4214, lon: 39.8728, minutes: 30, effort: "walk", indoor: false },
  { id: "muzdalifah", city: "makkah", kind: "hajj", lat: 21.3862, lon: 39.9125, minutes: 20, effort: "easy", indoor: false },
  { id: "arafat", city: "makkah", kind: "hajj", lat: 21.3530, lon: 39.9668, minutes: 45, effort: "easy", indoor: false, top: true },
  { id: "rahmah", city: "makkah", kind: "landmark", lat: 21.3548, lon: 39.9839, minutes: 40, effort: "walk", indoor: false, top: true },
  { id: "mualla", city: "makkah", kind: "cemetery", lat: 21.4370, lon: 39.8292, minutes: 25, effort: "easy", indoor: false },
  { id: "jinn", city: "makkah", kind: "mosque", lat: 21.4334, lon: 39.8289, minutes: 20, effort: "easy", indoor: true },
  { id: "aisha", city: "makkah", kind: "mosque", lat: 21.4676, lon: 39.8013, minutes: 40, effort: "easy", indoor: true },
  { id: "architecture", city: "makkah", kind: "museum", lat: 21.4346, lon: 39.7547, minutes: 60, effort: "easy", indoor: true },
  { id: "kiswa", city: "makkah", kind: "museum", lat: 21.4348, lon: 39.7564, minutes: 60, effort: "easy", indoor: true, booking: true },
  { id: "nabawi", city: "madinah", kind: "mosque", lat: 24.4683, lon: 39.6108, minutes: 90, effort: "walk", indoor: true, top: true },
  { id: "quba", city: "madinah", kind: "mosque", lat: 24.4392, lon: 39.6172, minutes: 45, effort: "easy", indoor: true, top: true },
  { id: "baqi", city: "madinah", kind: "cemetery", lat: 24.4669, lon: 39.6164, minutes: 25, effort: "easy", indoor: false },
  { id: "uhud", city: "madinah", kind: "landmark", lat: 24.5035, lon: 39.6127, minutes: 60, effort: "walk", indoor: false, top: true },
  { id: "qiblatayn", city: "madinah", kind: "mosque", lat: 24.4841, lon: 39.5789, minutes: 30, effort: "easy", indoor: true, top: true },
  { id: "sabaa", city: "madinah", kind: "landmark", lat: 24.4768, lon: 39.5958, minutes: 40, effort: "walk", indoor: false },
  { id: "ghamamah", city: "madinah", kind: "mosque", lat: 24.4658, lon: 39.6069, minutes: 15, effort: "easy", indoor: true },
  { id: "jumuah", city: "madinah", kind: "mosque", lat: 24.4455, lon: 39.6152, minutes: 20, effort: "easy", indoor: true },
  { id: "dar_madinah", city: "madinah", kind: "museum", lat: 24.4766, lon: 39.6876, minutes: 60, effort: "easy", indoor: true, top: true },
  { id: "hejaz_railway", city: "madinah", kind: "museum", lat: 24.4617, lon: 39.6002, minutes: 45, effort: "easy", indoor: false },
  { id: "seerah", city: "madinah", kind: "museum", lat: 24.4658, lon: 39.6094, minutes: 60, effort: "easy", indoor: true },
  { id: "quran_complex", city: "madinah", kind: "museum", lat: 24.5164, lon: 39.5414, minutes: 60, effort: "easy", indoor: true, booking: true },
];

export const siteById = (id: string): TripSite | undefined => TRIP_SITES.find((s) => s.id === id);

/** The guide in each language, loaded only when the pilgrim opens the trips page (cheap phones). */
export const GUIDE_LOADERS: Record<RafeeqLang, () => Promise<Guide>> = {
  en: () => import("./en").then((m) => m.GUIDE_EN),
  ar: () => import("./ar").then((m) => m.GUIDE_AR),
  id: () => import("./id").then((m) => m.GUIDE_ID),
  ur: () => import("./ur").then((m) => m.GUIDE_UR),
  tr: () => import("./tr").then((m) => m.GUIDE_TR),
  fr: () => import("./fr").then((m) => m.GUIDE_FR),
};
