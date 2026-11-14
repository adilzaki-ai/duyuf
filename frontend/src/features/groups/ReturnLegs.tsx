import { useState } from "react";
import { useReturnLegs, useSetReturnLegs } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { u } from "../../design/ui";
import type { NewReturnLeg } from "../../domain/types";
import { fmtDateTime, t } from "../../i18n";

/**
 * A group's flights home, leg by leg, as the airline gives them. Rafeeq shows
 * them to each pilgrim beside their visa date and reminds them as the day
 * comes. Times are entered in Saudi time; the platform keeps them as instants.
 */

type Row = { flight_number: string; from_airport: string; to_airport: string; date: string; time: string; arrives_date: string; arrives_time: string };

const ksa = (iso: string) => new Date(Date.parse(iso) + 3 * 3600_000).toISOString();
const toRow = (l: { flight_number: string; from_airport: string; to_airport: string; departs_at: string; arrives_at: string | null }): Row => ({
  flight_number: l.flight_number,
  from_airport: l.from_airport,
  to_airport: l.to_airport,
  date: ksa(l.departs_at).slice(0, 10),
  time: ksa(l.departs_at).slice(11, 16),
  arrives_date: l.arrives_at ? ksa(l.arrives_at).slice(0, 10) : "",
  arrives_time: l.arrives_at ? ksa(l.arrives_at).slice(11, 16) : "",
});
const blank = (from = ""): Row => ({ flight_number: "", from_airport: from, to_airport: "", date: "", time: "", arrives_date: "", arrives_time: "" });

export function ReturnLegs({ groupId, leaves }: { groupId: string; leaves: string | null }) {
  const q = useReturnLegs(groupId);
  const save = useSetReturnLegs(groupId);
  const canEdit = useCan("group:write");
  const [rows, setRows] = useState<Row[] | null>(null);
  const legs = q.data ?? [];
  const edit = (i: number, k: keyof Row, v: string) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, [k]: k.endsWith("airport") || k === "flight_number" ? v.toUpperCase() : v } : r)));
  const submit = () => {
    const out: NewReturnLeg[] = rows!.map((r) => ({
      flight_number: r.flight_number.trim().replace(/^([A-Z0-9]{2}[A-Z]?)\s*(\d)/, "$1 $2"),
      from_airport: r.from_airport.trim(),
      to_airport: r.to_airport.trim(),
      departs_at: `${r.date}T${r.time}:00+03:00`,
      arrives_at: r.arrives_date && r.arrives_time ? `${r.arrives_date}T${r.arrives_time}:00+03:00` : null,
    }));
    save.mutate(out, { onSuccess: () => setRows(null) });
  };
  return (
    <section className={u.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{t("Flights home")}</h2>
        {canEdit && !rows && (
          <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setRows(legs.length ? legs.map(toRow) : [{ ...blank(), date: leaves ?? "" }])}>
            {legs.length ? t("Edit flights") : t("Add flights")}
          </button>
        )}
      </div>
      {!rows ? (
        legs.length === 0 ? (
          <p className={u.muted}>{t("Not entered yet. Pilgrims see these on Rafeeq, beside their visa date.")}</p>
        ) : (
          <ul className={u.list}>
            {legs.map((l) => (
              <li key={l.seq}>
                <span className={u.mono} dir="ltr">
                  {l.flight_number} · {l.from_airport} → {l.to_airport}
                </span>
                <span>
                  {fmtDateTime(l.departs_at)}
                  {l.arrives_at && <span className={u.muted}> → {fmtDateTime(l.arrives_at)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className={u.form} style={{ gridTemplateColumns: "1fr" }}>
          <p className={u.muted} style={{ margin: 0 }}>
            {t("In the order they fly. Times in Saudi time.")}
          </p>
          {rows.map((r, i) => (
            <fieldset key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
              <legend>{t("Leg {n}", { n: i + 1 })}</legend>
              <label>
                {t("Flight")}
                <input required dir="ltr" placeholder="SV 818" value={r.flight_number} onChange={(e) => edit(i, "flight_number", e.target.value)} />
              </label>
              <label>
                {t("From")}
                <input required dir="ltr" maxLength={3} placeholder="JED" value={r.from_airport} onChange={(e) => edit(i, "from_airport", e.target.value)} />
              </label>
              <label>
                {t("To")}
                <input required dir="ltr" maxLength={3} placeholder="CGK" value={r.to_airport} onChange={(e) => edit(i, "to_airport", e.target.value)} />
              </label>
              <label>
                {t("Leaves on")}
                <input required type="date" value={r.date} onChange={(e) => edit(i, "date", e.target.value)} />
              </label>
              <label>
                {t("At")}
                <input required type="time" value={r.time} onChange={(e) => edit(i, "time", e.target.value)} />
              </label>
              <label>
                {t("Lands on (optional)")}
                <input type="date" value={r.arrives_date} onChange={(e) => edit(i, "arrives_date", e.target.value)} />
              </label>
              <label>
                {t("At (Saudi time)")}
                <input type="time" value={r.arrives_time} onChange={(e) => edit(i, "arrives_time", e.target.value)} />
              </label>
              <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setRows((rs) => rs!.filter((_, j) => j !== i))}>
                {t("Remove leg")}
              </button>
            </fieldset>
          ))}
          <div className={u.formActions}>
            {rows.length < 6 && (
              <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setRows((rs) => [...rs!, blank(rs!.at(-1)?.to_airport ?? "")])}>
                {t("Add a leg")}
              </button>
            )}
            <button type="button" className={u.button} disabled={save.isPending} onClick={submit}>
              {t("Save flights")}
            </button>
            <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setRows(null)}>
              {t("Cancel")}
            </button>
            {save.isError && <span className={u.error}>{save.error.message}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
