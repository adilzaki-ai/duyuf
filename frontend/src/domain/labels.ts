import { t } from "../i18n";
import type { Status } from "./journey";
import type { GroupKind, Need } from "./types";

const STATUS_EN: Record<Status, string> = {
  registered: "Registered",
  visa_issued: "Visa issued",
  arrived: "Arrived",
  in_makkah: "In Makkah",
  in_madinah: "In Madinah",
  departed: "Departed",
};

const NEED_EN: Record<Need, string> = {
  wheelchair: "Wheelchair",
  medical: "Medical care",
  elderly: "Elderly",
  dietary: "Special diet",
  unaccompanied_minor: "Minor alone",
};

export const statusLabel = (s: Status) => t(STATUS_EN[s]);
export const needLabel = (n: Need) => t(NEED_EN[n] ?? n);
export const kindLabel = (k: GroupKind) => t(k === "hajj" ? "Hajj" : "Umrah");
