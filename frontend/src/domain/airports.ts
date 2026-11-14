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

/** The terminals pilgrims come through, offered as suggestions; any other name can be typed. */
export const TERMINALS: Record<string, string[]> = {
  JED: ["Hajj Terminal", "Terminal 1", "North Terminal", "South Terminal"],
  MED: ["Main Terminal", "Hajj Terminal"],
  TIF: ["Main Terminal"],
  YNB: ["Main Terminal"],
};

export const TERMINAL_NAMES_EN = [...new Set(Object.values(TERMINALS).flat())];

/** A terminal in the reader's language when it is one we know, else as entered. */
export const terminalName = (name: string) => (TERMINAL_NAMES_EN.includes(name) ? t(name) : name);

/** The same rules as the platform: blank is "not given yet"; a gate is letters and digits. */
export const cleanTerminal = (v: string | null | undefined) => (v ?? "").split(/\s+/).filter(Boolean).join(" ") || null;
export const cleanGate = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, "").toUpperCase() || null;
export const GATE_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,7}$/;

/** The wave chart colours by airport: Jeddah, Madinah, then everything else folded together. */
export const WAVE_SERIES = ["JED", "MED", "other"] as const;
export const waveSeries = (code: string): (typeof WAVE_SERIES)[number] =>
  code === "JED" || code === "MED" ? code : "other";
