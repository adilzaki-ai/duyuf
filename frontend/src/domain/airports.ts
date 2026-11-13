import { t } from "../i18n";

/** The Kingdom's pilgrim gateways, by IATA code. Origins abroad show as their code. */
const KSA_AIRPORTS: Record<string, string> = {
  JED: "Jeddah",
  MED: "Madinah",
  TIF: "Taif",
  YNB: "Yanbu",
  RUH: "Riyadh",
  DMM: "Dammam",
};

/** Where pilgrims land, offered when adding a flight. */
export const ARRIVAL_AIRPORTS = ["JED", "MED", "TIF", "YNB"] as const;

export const airportName = (code: string) => (KSA_AIRPORTS[code] ? t(KSA_AIRPORTS[code]) : code);

export const AIRPORT_NAMES_EN = Object.values(KSA_AIRPORTS);

/** The wave chart colours by airport: Jeddah, Madinah, then everything else folded together. */
export const WAVE_SERIES = ["JED", "MED", "other"] as const;
export const waveSeries = (code: string): (typeof WAVE_SERIES)[number] =>
  code === "JED" || code === "MED" ? code : "other";
