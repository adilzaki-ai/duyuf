import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateGroup, useUpdateGroup } from "../../api/queries";
import { u } from "../../design/ui";
import { countryOptions } from "../../domain/countries";
import type { Group, GroupKind } from "../../domain/types";
import { t } from "../../i18n";

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

/** This year on the Umm al-Qura calendar: the season a new group most likely travels in. */
function thisSeason(): string {
  const y = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { year: "numeric", timeZone: "Asia/Riyadh" })
    .formatToParts(new Date())
    .find((p) => p.type === "year")?.value;
  return y ?? "";
}

/** A new group. Opens it once saved. */
export function NewGroupForm({ onClose }: { onClose: () => void }) {
  const create = useCreateGroup();
  const go = useNavigate();
  const [f, setF] = useState({
    code: "",
    name: "",
    kind: "umrah" as GroupKind,
    season: thisSeason(),
    origin_country: "",
    arrival_date: "",
    departure_date: "",
    leader_name: "",
    leader_phone: "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        kind: f.kind,
        season: f.season.trim(),
        origin_country: f.origin_country,
        arrival_date: orNull(f.arrival_date),
        departure_date: orNull(f.departure_date),
        leader_name: orNull(f.leader_name),
        leader_phone: orNull(f.leader_phone),
      },
      { onSuccess: (g) => go(`/groups/${g.id}`) },
    );
  };

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("New group")}</h2>
      <form className={u.form} onSubmit={submit}>
        <label>
          {t("Code")}
          <input required maxLength={32} value={f.code} placeholder="U-PK-0401" dir="ltr" onChange={set("code")} />
        </label>
        <label>
          {t("Name")}
          <input required value={f.name} placeholder={t("e.g. Lahore Umrah")} onChange={set("name")} />
        </label>
        <label>
          {t("Type")}
          <select value={f.kind} onChange={set("kind")}>
            <option value="umrah">{t("Umrah")}</option>
            <option value="hajj">{t("Hajj")}</option>
          </select>
        </label>
        <label>
          {t("Season (Hijri year)")}
          <input required minLength={4} maxLength={8} value={f.season} dir="ltr" onChange={set("season")} />
        </label>
        <label>
          {t("From")}
          <select required value={f.origin_country} onChange={set("origin_country")}>
            <option value="">{t("Choose a country")}</option>
            {countryOptions().map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Arrives")}
          <input type="date" value={f.arrival_date} onChange={set("arrival_date")} />
        </label>
        <label>
          {t("Leaves")}
          <input type="date" value={f.departure_date} min={f.arrival_date || undefined} onChange={set("departure_date")} />
        </label>
        <label>
          {t("Leader")}
          <input value={f.leader_name} onChange={set("leader_name")} />
        </label>
        <label>
          {t("Leader phone")}
          <input type="tel" value={f.leader_phone} dir="ltr" placeholder="+966 5…" onChange={set("leader_phone")} />
        </label>
        <div className={u.formActions}>
          <button type="submit" className={u.button} disabled={create.isPending}>
            {t("Save group")}
          </button>
          <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
            {t("Cancel")}
          </button>
          {create.isError && <span className={u.error}>{create.error.message}</span>}
        </div>
      </form>
    </section>
  );
}

/** The parts of a group that change: name, dates, leader. Code, type, season and country stay as created. */
export function EditGroupForm({ group, onClose }: { group: Group; onClose: () => void }) {
  const update = useUpdateGroup(group.id);
  const [f, setF] = useState({
    name: group.name,
    arrival_date: group.arrival_date ?? "",
    departure_date: group.departure_date ?? "",
    leader_name: group.leader_name ?? "",
    leader_phone: group.leader_phone ?? "",
    meeting_name: group.meeting_name ?? "",
    meeting_place: group.meeting_lat != null ? `${group.meeting_lat}, ${group.meeting_lon}` : "",
  });
  /* "24.4689, 39.6081", as copied from a map app; empty clears the meeting point */
  const place = parsePlace(f.meeting_place);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        name: f.name.trim(),
        arrival_date: orNull(f.arrival_date),
        departure_date: orNull(f.departure_date),
        leader_name: orNull(f.leader_name),
        leader_phone: orNull(f.leader_phone),
        meeting_name: place ? f.meeting_name.trim() || null : null,
        meeting_lat: place?.lat ?? null,
        meeting_lon: place?.lon ?? null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("Edit group")}</h2>
      <form className={u.form} onSubmit={submit}>
        <label>
          {t("Name")}
          <input required value={f.name} onChange={set("name")} />
        </label>
        <label>
          {t("Arrives")}
          <input type="date" value={f.arrival_date} onChange={set("arrival_date")} />
        </label>
        <label>
          {t("Leaves")}
          <input type="date" value={f.departure_date} min={f.arrival_date || undefined} onChange={set("departure_date")} />
        </label>
        <label>
          {t("Leader")}
          <input value={f.leader_name} onChange={set("leader_name")} />
        </label>
        <label>
          {t("Leader phone")}
          <input type="tel" value={f.leader_phone} dir="ltr" onChange={set("leader_phone")} />
        </label>
        <label>
          {t("Meeting point")}
          <input value={f.meeting_name} placeholder={t("e.g. Hotel lobby")} required={!!f.meeting_place.trim()} onChange={set("meeting_name")} />
        </label>
        <label>
          {t("Meeting point place")}
          <input
            value={f.meeting_place}
            dir="ltr"
            placeholder="24.4689, 39.6081"
            aria-invalid={!!f.meeting_place.trim() && !place}
            onChange={set("meeting_place")}
          />
          <span className={u.hint}>{t("Latitude, longitude: copy it from a map app.")}</span>
        </label>
        <div className={u.formActions}>
          <button type="submit" className={u.button} disabled={update.isPending || (!!f.meeting_place.trim() && !place)}>
            {t("Save")}
          </button>
          <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
            {t("Cancel")}
          </button>
          {update.isError && <span className={u.error}>{update.error.message}</span>}
        </div>
      </form>
    </section>
  );
}

/** "24.4689, 39.6081" → a place; null when empty or not a place. */
export function parsePlace(text: string): { lat: number; lon: number } | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,،\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
