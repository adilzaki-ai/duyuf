import type { RafeeqLang } from "./help";

/**
 * The holy sites Rafeeq can guide to, with their names in its six languages.
 * Places are APPROXIMATE (to within a few hundred metres) and must be checked
 * on the ground before a real season: a gate or a camp number is better than a
 * whole mosque for meeting a group.
 */
export interface Site {
  id: string;
  city: "makkah" | "madinah";
  lat: number;
  lon: number;
  name: Record<RafeeqLang, string>;
}

export const SITES: Site[] = [
  {
    id: "haram",
    city: "makkah",
    lat: 21.4225,
    lon: 39.8262,
    name: { en: "Al-Masjid al-Haram", ar: "المسجد الحرام", id: "Masjidil Haram", ur: "مسجد الحرام", tr: "Mescid-i Haram", fr: "Mosquée al-Haram" },
  },
  {
    id: "jamarat",
    city: "makkah",
    lat: 21.4226,
    lon: 39.8726,
    name: { en: "Jamarat", ar: "الجمرات", id: "Jamarat", ur: "جمرات", tr: "Cemerat", fr: "Jamarat" },
  },
  {
    id: "mina",
    city: "makkah",
    lat: 21.4133,
    lon: 39.8933,
    name: { en: "Mina", ar: "منى", id: "Mina", ur: "منیٰ", tr: "Mina", fr: "Mina" },
  },
  {
    id: "muzdalifah",
    city: "makkah",
    lat: 21.3836,
    lon: 39.9378,
    name: { en: "Muzdalifah", ar: "مزدلفة", id: "Muzdalifah", ur: "مزدلفہ", tr: "Müzdelife", fr: "Muzdalifa" },
  },
  {
    id: "arafat",
    city: "makkah",
    lat: 21.3525,
    lon: 39.9663,
    name: {
      en: "Arafat (Namirah Mosque)",
      ar: "عرفات (مسجد نمرة)",
      id: "Arafah (Masjid Namirah)",
      ur: "عرفات (مسجد نمرہ)",
      tr: "Arafat (Nemire Mescidi)",
      fr: "Arafat (mosquée Namira)",
    },
  },
  {
    id: "nabawi",
    city: "madinah",
    lat: 24.4672,
    lon: 39.6111,
    name: { en: "The Prophet's Mosque", ar: "المسجد النبوي", id: "Masjid Nabawi", ur: "مسجد نبوی", tr: "Mescid-i Nebevi", fr: "Mosquée du Prophète" },
  },
  {
    id: "quba",
    city: "madinah",
    lat: 24.4393,
    lon: 39.6173,
    name: { en: "Quba Mosque", ar: "مسجد قباء", id: "Masjid Quba", ur: "مسجد قبا", tr: "Kuba Mescidi", fr: "Mosquée de Quba" },
  },
];

export interface Point {
  lat: number;
  lon: number;
}

/** Metres between two points (haversine). */
export function metres(a: Point, b: Point): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Which way to walk, as one of eight words' English keys. */
export function heading(a: Point, b: Point): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return WALK[Math.round(deg / 45) % 8];
}

export const WALK = [
  "Walk north.",
  "Walk north-east.",
  "Walk east.",
  "Walk south-east.",
  "Walk south.",
  "Walk south-west.",
  "Walk west.",
  "Walk north-west.",
];

/** "350 m", "1.2 km" */
export const distanceText = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);

/** Walking directions in the phone's maps app. */
export const walkingLink = (to: Point, from?: Point | null) =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}&travelmode=walking${from ? `&origin=${from.lat},${from.lon}` : ""}`;
