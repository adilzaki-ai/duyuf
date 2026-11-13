import type { Need, NewPilgrim } from "./types";

/**
 * One spreadsheet row, checked as the platform checks it
 * (backend/api/duyuf/routers/imports.py), in its words. Only the sample mode
 * uses this; against the platform, the platform decides.
 */

export const IMPORT_COLUMNS = [
  "full_name",
  "full_name_ar",
  "gender",
  "date_of_birth",
  "nationality",
  "passport_no",
  "phone",
  "language",
  "needs",
] as const;

export const NEEDS: readonly Need[] = ["wheelchair", "medical", "elderly", "dietary", "unaccompanied_minor"];

const GENDER: Record<string, "male" | "female"> = {
  male: "male",
  m: "male",
  ذكر: "male",
  female: "female",
  f: "female",
  أنثى: "female",
};

function birthDate(v: string): string | null {
  let y: number, m: number, d: number;
  let hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (hit) [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  else if ((hit = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v))) [d, m, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  else return null;
  const at = new Date(Date.UTC(y, m - 1, d));
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== m - 1 || at.getUTCDate() !== d) return null;
  return at.toISOString().slice(0, 10);
}

export function checkRow(raw: Record<string, string>): {
  value?: Omit<NewPilgrim, "group_id">;
  problems: { field: string; message: string }[];
} {
  const get = (k: string) => {
    const v = Object.entries(raw).find(([key]) => key.trim().toLowerCase() === k)?.[1];
    return v == null || v.trim() === "" ? null : v.trim();
  };
  const problems: { field: string; message: string }[] = [];
  const full_name = get("full_name");
  if (!full_name) problems.push({ field: "full_name", message: "required" });
  const gender = GENDER[(get("gender") ?? "").toLowerCase()];
  if (!gender) problems.push({ field: "gender", message: "male or female (M or F)" });
  let date_of_birth: string | null = null;
  const born = get("date_of_birth");
  if (born) {
    date_of_birth = birthDate(born);
    if (!date_of_birth) problems.push({ field: "date_of_birth", message: "a date like 1960-03-02 or 02/03/1960" });
    else if (date_of_birth > new Date().toISOString().slice(0, 10) || date_of_birth < "1900-01-01") {
      problems.push({ field: "date_of_birth", message: "not a likely birth date" });
    }
  }
  const nationality = (get("nationality") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(nationality)) problems.push({ field: "nationality", message: "two letters, like PK" });
  const passport_no = (get("passport_no") ?? "").replace(/\s+/g, "").toUpperCase();
  if (passport_no.length < 5 || passport_no.length > 20)
    problems.push({ field: "passport_no", message: "5 to 20 letters and digits" });
  const language = get("language")?.toLowerCase() ?? null;
  if (language && !/^[a-z]{2}$/.test(language)) problems.push({ field: "language", message: "two letters, like ur" });
  const needList = (get("needs") ?? "")
    .split(/[;,|]/)
    .map((n) => n.trim().toLowerCase().replace(/ /g, "_"))
    .filter(Boolean);
  const unknown = needList.filter((n) => !NEEDS.includes(n as Need));
  if (unknown.length)
    problems.push({ field: "needs", message: `unknown need ${unknown.join(", ")}; use ${NEEDS.join(", ")}` });
  if (problems.length) return { problems };
  return {
    problems,
    value: {
      full_name: full_name!,
      full_name_ar: get("full_name_ar"),
      gender,
      date_of_birth,
      nationality,
      passport_no,
      phone: get("phone"),
      language,
      needs: NEEDS.filter((n) => needList.includes(n)),
    },
  };
}
