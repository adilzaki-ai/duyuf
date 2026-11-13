import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAddShift, useRemoveShift, useShifts } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { Failed, Loading, PageHead, u } from "../../design/ui";
import { ARRIVAL_AIRPORTS, airportName } from "../../domain/airports";
import { INTERPRETER_LANGUAGES } from "../../domain/languages";
import type { ResourceKind } from "../../domain/types";
import { fmtDateTime, fmtNum, getLang, languageName, t } from "../../i18n";
import { addDays, ksaDate } from "../../lib/dates";
import a from "./arrivals.module.css";
import { kindName } from "./Plan";

const KINDS: ResourceKind[] = ["wheelchair", "bus", "interpreter"];

function AddShift() {
  const add = useAddShift();
  const today = ksaDate();
  const [airport, setAirport] = useState<string>(ARRIVAL_AIRPORTS[0]);
  const [kind, setKind] = useState<ResourceKind>("wheelchair");
  const [language, setLanguage] = useState<string>(INTERPRETER_LANGUAGES[0]);
  const [quantity, setQuantity] = useState(1);
  const [fromDay, setFromDay] = useState(today);
  const [fromTime, setFromTime] = useState("00:00");
  const [toDay, setToDay] = useState(addDays(today, 1));
  const [toTime, setToTime] = useState("00:00");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate({
      airport,
      kind,
      language: kind === "interpreter" ? language : null,
      quantity,
      starts_at: `${fromDay}T${fromTime}:00+03:00`,
      ends_at: `${toDay}T${toTime}:00+03:00`,
    });
  };

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("Add a shift")}</h2>
      <p className={u.hint}>{t("Times are Saudi time.")}</p>
      <form className={a.form} onSubmit={submit}>
        <label>
          {t("Airport")}
          <select value={airport} onChange={(e) => setAirport(e.target.value)}>
            {ARRIVAL_AIRPORTS.map((c) => (
              <option key={c} value={c}>
                {airportName(c)} ({c})
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("What")}
          <select value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {kindName(k)}
              </option>
            ))}
          </select>
        </label>
        {kind === "interpreter" && (
          <label>
            {t("Language")}
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {INTERPRETER_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t("How many")}
          <input
            type="number"
            min={1}
            max={1000}
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <label>
          {t("From")}
          <input type="date" required value={fromDay} onChange={(e) => setFromDay(e.target.value)} />
        </label>
        <label>
          &nbsp;
          <input type="time" required aria-label={t("From time")} value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
        </label>
        <label>
          {t("Until")}
          <input type="date" required value={toDay} onChange={(e) => setToDay(e.target.value)} />
        </label>
        <label>
          &nbsp;
          <input type="time" required aria-label={t("Until time")} value={toTime} onChange={(e) => setToTime(e.target.value)} />
        </label>
        <div className={a.row} style={{ marginTop: 0 }}>
          <button type="submit" className={u.button} disabled={add.isPending}>
            {t("Add shift")}
          </button>
        </div>
      </form>
      {add.isSuccess && <p className={a.ok}>{t("Shift added.")}</p>}
      {add.isError && <p className={u.error}>{add.error.message}</p>}
    </section>
  );
}

export function ResourcesPage() {
  const q = useShifts();
  const remove = useRemoveShift();
  const canPlan = useCan("flight:write");
  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link to="/arrivals">
          {getLang() === "ar" ? "→" : "←"} {t("Back to arrivals")}
        </Link>
      </p>
      <PageHead title={t("Resources")} sub={t("What is on shift at each airport.")} />
      {canPlan && <AddShift />}
      <section className={u.card}>
        <h2>{t("On shift")}</h2>
        <p className={u.hint}>{t("A shift counts for each block it covers whole.")}</p>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <Failed error={q.error} />
        ) : q.data.length === 0 ? (
          <p className={u.muted}>{t("Nothing on shift yet.")}</p>
        ) : (
          <div className={u.tableWrap}>
            <table className={u.table}>
              <thead>
                <tr>
                  <th>{t("Airport")}</th>
                  <th>{t("What")}</th>
                  <th className={a.num}>{t("How many")}</th>
                  <th>{t("From")}</th>
                  <th>{t("Until")}</th>
                  <th>{t("Added by")}</th>
                  {canPlan && <th />}
                </tr>
              </thead>
              <tbody className={a.still}>
                {q.data.map((s) => (
                  <tr key={s.id}>
                    <td>{airportName(s.airport)}</td>
                    <td>{kindName(s.kind, s.language)}</td>
                    <td className={a.num}>{fmtNum(s.quantity)}</td>
                    <td>{fmtDateTime(s.starts_at)}</td>
                    <td>{fmtDateTime(s.ends_at)}</td>
                    <td>{s.created_by}</td>
                    {canPlan && (
                      <td>
                        <button
                          type="button"
                          className={`${u.button} ${u.quiet}`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(s.id)}
                        >
                          {t("Remove")}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {remove.isError && <p className={u.error}>{remove.error.message}</p>}
      </section>
    </>
  );
}
