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
  });
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
        <div className={u.formActions}>
          <button type="submit" className={u.button} disabled={update.isPending}>
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
