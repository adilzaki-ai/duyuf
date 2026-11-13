import { useState, type FormEvent } from "react";
import { useCreatePilgrim, useUpdatePilgrim } from "../../api/queries";
import { u } from "../../design/ui";
import { countryOptions } from "../../domain/countries";
import { NEEDS } from "../../domain/importRow";
import { needLabel } from "../../domain/labels";
import { PILGRIM_LANGUAGES } from "../../domain/languages";
import type { Need, PilgrimDetail } from "../../domain/types";
import { languageName, t } from "../../i18n";

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

function NeedChecks({ value, onChange }: { value: Need[]; onChange: (n: Need[]) => void }) {
  return (
    <fieldset className={`${u.checks} ${u.wide}`} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className={u.muted} style={{ fontSize: 13, marginBottom: 4 }}>
        {t("Needs")}
      </legend>
      {NEEDS.map((n) => (
        <label key={n}>
          <input
            type="checkbox"
            checked={value.includes(n)}
            onChange={(e) => onChange(e.target.checked ? NEEDS.filter((x) => x === n || value.includes(x)) : value.filter((x) => x !== n))}
          />
          {needLabel(n)}
        </label>
      ))}
    </fieldset>
  );
}

function LanguageSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("Not recorded")}</option>
      {PILGRIM_LANGUAGES.map((l) => (
        <option key={l} value={l}>
          {languageName(l)}
        </option>
      ))}
    </select>
  );
}

/** One pilgrim into this group, starting at "registered". */
export function AddPilgrimForm({
  groupId,
  country,
  onClose,
}: {
  groupId: string;
  country: string;
  onClose: () => void;
}) {
  const create = useCreatePilgrim();
  const blank = {
    full_name: "",
    full_name_ar: "",
    gender: "male" as "male" | "female",
    date_of_birth: "",
    nationality: country,
    passport_no: "",
    phone: "",
    language: "",
  };
  const [f, setF] = useState(blank);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        group_id: groupId,
        full_name: f.full_name.trim(),
        full_name_ar: orNull(f.full_name_ar),
        gender: f.gender,
        date_of_birth: orNull(f.date_of_birth),
        nationality: f.nationality,
        passport_no: f.passport_no.replace(/\s+/g, "").toUpperCase(),
        phone: orNull(f.phone),
        language: orNull(f.language),
        needs,
      },
      {
        /* clear for the next one: people are usually added one after another */
        onSuccess: (p) => {
          setAdded(p.full_name);
          setF({ ...blank, nationality: f.nationality, language: f.language });
          setNeeds([]);
        },
      },
    );
  };

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("Add a pilgrim")}</h2>
      <form className={u.form} onSubmit={submit}>
        <label>
          {t("Name")}
          <input required value={f.full_name} onChange={set("full_name")} />
        </label>
        <label>
          {t("Name in Arabic")}
          <input value={f.full_name_ar} dir="rtl" onChange={set("full_name_ar")} />
        </label>
        <label>
          {t("Gender")}
          <select value={f.gender} onChange={set("gender")}>
            <option value="male">{t("Male")}</option>
            <option value="female">{t("Female")}</option>
          </select>
        </label>
        <label>
          {t("Born")}
          <input type="date" value={f.date_of_birth} onChange={set("date_of_birth")} />
        </label>
        <label>
          {t("Nationality")}
          <select required value={f.nationality} onChange={set("nationality")}>
            {countryOptions().map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Passport")}
          <input required minLength={5} maxLength={20} value={f.passport_no} dir="ltr" onChange={set("passport_no")} />
        </label>
        <label>
          {t("Phone")}
          <input type="tel" value={f.phone} dir="ltr" onChange={set("phone")} />
        </label>
        <label>
          {t("Language")}
          <LanguageSelect value={f.language} onChange={(v) => setF({ ...f, language: v })} />
        </label>
        <NeedChecks value={needs} onChange={setNeeds} />
        <div className={u.formActions}>
          <button type="submit" className={u.button} disabled={create.isPending}>
            {t("Add pilgrim")}
          </button>
          <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
            {t("Done")}
          </button>
          {create.isError ? (
            <span className={u.error}>{create.error.message}</span>
          ) : (
            added && <span className={u.done}>{t("{name} added.", { name: added })}</span>
          )}
        </div>
      </form>
    </section>
  );
}

/** What changes about a pilgrim. Passport, birth date and nationality are identity: fixed once registered. */
export function EditPilgrim({ p, onClose }: { p: PilgrimDetail; onClose: () => void }) {
  const update = useUpdatePilgrim(p.id);
  const [f, setF] = useState({
    full_name: p.full_name,
    full_name_ar: p.full_name_ar ?? "",
    phone: p.phone ?? "",
    language: p.language ?? "",
  });
  const [needs, setNeeds] = useState<Need[]>(p.needs);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        full_name: f.full_name.trim(),
        full_name_ar: orNull(f.full_name_ar),
        phone: orNull(f.phone),
        language: orNull(f.language),
        needs,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form className={u.form} onSubmit={submit} style={{ gridTemplateColumns: "1fr" }}>
      <label>
        {t("Name")}
        <input required value={f.full_name} onChange={set("full_name")} />
      </label>
      <label>
        {t("Name in Arabic")}
        <input value={f.full_name_ar} dir="rtl" onChange={set("full_name_ar")} />
      </label>
      <label>
        {t("Phone")}
        <input type="tel" value={f.phone} dir="ltr" onChange={set("phone")} />
      </label>
      <label>
        {t("Language")}
        <LanguageSelect value={f.language} onChange={(v) => setF({ ...f, language: v })} />
      </label>
      <NeedChecks value={needs} onChange={setNeeds} />
      {p.arrival_flight_id && p.status !== "departed" && (
        <div className={u.formActions}>
          <span>
            {t("On flight")} <span className={u.mono}>{p.flight_number}</span>
          </span>
          <button
            type="button"
            className={`${u.button} ${u.quiet}`}
            disabled={update.isPending}
            onClick={() => update.mutate({ arrival_flight_id: null }, { onSuccess: onClose })}
          >
            {t("Take off this flight")}
          </button>
        </div>
      )}
      <div className={u.formActions}>
        <button type="submit" className={u.button} disabled={update.isPending}>
          {t("Save")}
        </button>
        <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
          {t("Cancel")}
        </button>
      </div>
      {update.isError && <p className={u.error}>{update.error.message}</p>}
    </form>
  );
}
