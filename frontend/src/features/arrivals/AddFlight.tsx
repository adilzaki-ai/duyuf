import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateFlight } from "../../api/queries";
import { u } from "../../design/ui";
import { ARRIVAL_AIRPORTS, airportName } from "../../domain/airports";
import { t } from "../../i18n";
import { ksaDate } from "../../lib/dates";
import a from "./arrivals.module.css";

/** A new flight, its time read on the Saudi clock. Opens the flight once it is saved. */
export function AddFlight({ onClose }: { onClose: () => void }) {
  const create = useCreateFlight();
  const go = useNavigate();
  const [number, setNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState<string>(ARRIVAL_AIRPORTS[0]);
  const [date, setDate] = useState(ksaDate());
  const [time, setTime] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { number, origin_airport: from, arrival_airport: to, scheduled_at: `${date}T${time}:00+03:00` },
      { onSuccess: (f) => go(`/arrivals/${f.id}`) },
    );
  };

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("Add a flight")}</h2>
      <form className={a.form} onSubmit={submit}>
        <label>
          {t("Flight number")}
          <input required value={number} placeholder="SV 3102" dir="ltr" onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label>
          {t("From airport")}
          <input
            required
            value={from}
            placeholder="KHI"
            maxLength={3}
            dir="ltr"
            onChange={(e) => setFrom(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          {t("Lands at")}
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {ARRIVAL_AIRPORTS.map((c) => (
              <option key={c} value={c}>
                {airportName(c)} ({c})
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Date")}
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          {t("Saudi time")}
          <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <div className={a.row} style={{ marginTop: 0 }}>
          <button type="submit" className={u.button} disabled={create.isPending}>
            {t("Add flight")}
          </button>
          <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
            {t("Cancel")}
          </button>
        </div>
      </form>
      {create.isError && <p className={u.error}>{create.error.message}</p>}
    </section>
  );
}
