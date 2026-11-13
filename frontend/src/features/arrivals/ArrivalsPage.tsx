import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useArrivals, useWhatIf } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { Failed, Loading, PageHead, Tile, u } from "../../design/ui";
import { airportName } from "../../domain/airports";
import { BUS_SEATS, INTERPRETER_EVERY } from "../../domain/brief";
import type { Arrivals, Flight, WhatIf } from "../../domain/types";
import { fmtDate, fmtHijri, fmtNum, fmtTime, route, sep, t } from "../../i18n";
import { ksaDate } from "../../lib/dates";
import { AddFlight } from "./AddFlight";
import a from "./arrivals.module.css";
import { dayWord, FlightStateChip, Languages } from "./parts";
import { blockName, gapCount, LoadTable, shortText, WhatIfPanel } from "./Plan";
import { WaveChart } from "./WaveChart";

const WINDOWS = [
  { hours: 48, label: "48 hours" },
  { hours: 168, label: "7 days" },
];

const sum = (fs: Flight[], k: "pilgrims" | "wheelchair" | "over_75" | "buses" | "interpreters" | "no_visa") =>
  fs.reduce((n, f) => n + f.brief[k], 0);

interface Item {
  key: string;
  urgent: boolean;
  text: ReactNode;
}

/** What to do next, most pressing first. */
function attention(d: Arrivals): Item[] {
  const items: Item[] = [];
  /* <bdi>: a Latin flight number inside an Arabic sentence keeps its neighbours in place */
  const link = (f: Flight) => (
    <bdi>
      <Link to={`/arrivals/${f.id}`}>{f.number}</Link>
    </bdi>
  );
  for (const f of d.flights.filter((f) => f.state === "due"))
    items.push({ key: `due-${f.id}`, urgent: true, text: <>{link(f)} {t("should have landed. Confirm it.")}</> });
  for (const r of d.load.filter((r) => r.short.length))
    items.push({
      key: `gap-${r.airport}-${r.start}`,
      urgent: true,
      text: (
        <>
          <b>
            {airportName(r.airport)}
            {sep()}
            {blockName(r.start, d.slot_hours)}
          </b>
          : {t("short of {what}.", { what: shortText(r.short) })}
        </>
      ),
    });
  for (const f of d.flights.filter((f) => f.state !== "landed" && f.brief.no_visa))
    items.push({
      key: `visa-${f.id}`,
      urgent: true,
      text: (
        <>
          {link(f)}: {t("{n} with no visa yet.", { n: f.brief.no_visa })}
        </>
      ),
    });
  for (const g of d.unplanned)
    items.push({
      key: `group-${g.id}`,
      urgent: false,
      text: (
        <>
          <bdi>
            <Link to={`/groups/${g.id}`}>{g.name}</Link>
          </bdi>
          : {t("{n} with no flight.", { n: g.without_flight })}{" "}
          <span className={u.muted}>
            {t("Lands")} {fmtDate(g.arrival_date)}
          </span>
        </>
      ),
    });
  for (const f of d.flights.filter((f) => f.state === "delayed"))
    items.push({
      key: `late-${f.id}`,
      urgent: false,
      text: (
        <>
          {link(f)} {t("is {n} min late. Tell the bus company.", { n: f.delay_minutes })}
        </>
      ),
    });
  return items;
}

function FlightsTable({ data }: { data: Arrivals }) {
  const go = useNavigate();
  if (data.flights.length === 0) return <p className={u.muted}>{t("No flights in this window.")}</p>;
  return (
    <div className={u.tableWrap}>
      <table className={u.table}>
        <thead>
          <tr>
            <th>{t("Lands")}</th>
            <th>{t("Flight")}</th>
            <th>{t("Status")}</th>
            <th className={a.num}>{t("Pilgrims")}</th>
            <th className={a.num}>{t("Wheelchairs")}</th>
            <th className={a.num}>{t("Over 75")}</th>
            <th className={a.num}>{t("Buses")}</th>
            <th className={a.num}>{t("Interpreters")}</th>
            <th>{t("Languages")}</th>
          </tr>
        </thead>
        <tbody>
          {data.flights.map((f) => {
            const day = ksaDate(new Date(f.expected_at));
            return (
              <tr key={f.id} onClick={() => go(`/arrivals/${f.id}`)}>
                <td>
                  <b dir="ltr">{fmtTime(f.expected_at)}</b> {dayWord(f.expected_at, data.now)}
                  <span className={u.sub}>
                    {fmtDate(day)} · {fmtHijri(day)}
                  </span>
                </td>
                <td>
                  <Link to={`/arrivals/${f.id}`} className={u.mono} onClick={(e) => e.stopPropagation()}>
                    {f.number}
                  </Link>
                  <span className={u.sub}>
                    {route(f.origin_airport, airportName(f.arrival_airport))}
                  </span>
                </td>
                <td>
                  <FlightStateChip flight={f} />
                  {f.brief.no_visa > 0 && f.state !== "landed" && (
                    <span className={a.warn}>{t("{n} with no visa yet.", { n: f.brief.no_visa })}</span>
                  )}
                  {f.short && <span className={a.warn}>{t("Short of resources")}</span>}
                </td>
                <td className={a.num}>{fmtNum(f.brief.pilgrims)}</td>
                <td className={a.num}>{fmtNum(f.brief.wheelchair)}</td>
                <td className={a.num}>{fmtNum(f.brief.over_75)}</td>
                <td className={a.num}>{fmtNum(f.brief.buses)}</td>
                <td className={a.num}>{fmtNum(f.brief.interpreters)}</td>
                <td>
                  <Languages items={f.brief.languages} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ArrivalsPage() {
  const [hours, setHours] = useState(48);
  const [adding, setAdding] = useState(false);
  const [trying, setTrying] = useState(false);
  const [scenario, setScenario] = useState<Omit<WhatIf, "hours"> | null>(null);
  const canPlan = useCan("flight:write");
  const q = useArrivals(hours);
  const wi = useWhatIf(scenario ? { ...scenario, hours } : null);
  const backToLive = () => {
    setTrying(false);
    setScenario(null);
  };

  return (
    <>
      <PageHead title={t("Arrivals")} sub={t("Who lands next, and what they need.")}>
        <div className={a.headTools}>
          <div className={a.toggle} role="group" aria-label={t("Window")}>
            {WINDOWS.map((w) => (
              <button key={w.hours} type="button" aria-pressed={hours === w.hours} onClick={() => setHours(w.hours)}>
                {t(w.label)}
              </button>
            ))}
          </div>
          <Link to="/arrivals/resources" className={`${u.button} ${u.quiet}`}>
            {t("Resources")}
          </Link>
          {!trying && (
            <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setTrying(true)}>
              {t("What if…")}
            </button>
          )}
          {canPlan && !adding && (
            <button type="button" className={u.button} onClick={() => setAdding(true)}>
              {t("Add flight")}
            </button>
          )}
        </div>
      </PageHead>
      {adding && <AddFlight onClose={() => setAdding(false)} />}
      {trying && q.data && <WhatIfPanel live={q.data} onShow={setScenario} onClose={backToLive} />}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failed error={q.error} />
      ) : !scenario ? (
        <Board data={q.data} />
      ) : wi.isPending ? (
        <Loading />
      ) : wi.isError ? (
        <Failed error={wi.error} />
      ) : (
        <>
          <div className={a.whatIf} role="status">
            <b>{t("What-if view. Nothing is saved.")}</b>{" "}
            {t("Gaps: {now} now, {then} with these changes.", { now: gapCount(q.data), then: gapCount(wi.data) })}{" "}
            <button type="button" className={`${u.button} ${u.quiet}`} onClick={backToLive}>
              {t("Back to live")}
            </button>
          </div>
          <Board data={wi.data} />
        </>
      )}
    </>
  );
}

function Board({ data }: { data: Arrivals }) {
  const coming = data.flights.filter((f) => f.state !== "landed");
  const items = attention(data);
  return (
    <>
      <div className={u.tiles}>
        <Tile
          label={t("Pilgrims landing")}
          value={sum(coming, "pilgrims")}
          note={t("On {n} flights", { n: coming.length })}
        />
        <Tile label={t("Wheelchairs")} value={sum(coming, "wheelchair")} attention />
        <Tile label={t("Over 75")} value={sum(coming, "over_75")} attention />
        <Tile label={t("Buses")} value={sum(coming, "buses")} note={t("{n} seats each", { n: BUS_SEATS })} />
        <Tile
          label={t("Interpreters")}
          value={sum(coming, "interpreters")}
          note={t("One per {n} pilgrims", { n: INTERPRETER_EVERY })}
        />
      </div>

      <div className={u.grid2}>
        <section className={u.card}>
          <h2>{t("Arrival wave")}</h2>
          <p className={u.hint}>{t("Pilgrims landing every {n} hours, Saudi time.", { n: data.slot_hours })}</p>
          <WaveChart waves={data.waves} slotHours={data.slot_hours} />
        </section>
        <section className={u.card}>
          <h2>{t("Needs attention")}</h2>
          {items.length === 0 ? (
            <p className={u.muted}>{t("Nothing needs attention.")}</p>
          ) : (
            <ul className={a.attention}>
              {items.map((i) => (
                <li key={i.key}>
                  <span className={`${a.mark} ${i.urgent ? a.urgent : ""}`} aria-hidden="true">
                    !
                  </span>
                  <span>{i.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={u.card} style={{ marginBottom: 16 }}>
        <h2>{t("Need and on shift")}</h2>
        <p className={u.hint}>{t("Each block with a flight landing, by airport.")}</p>
        <LoadTable rows={data.load} slotHours={data.slot_hours} />
      </section>

      <section className={u.card}>
        <h2>{t("Flights")}</h2>
        <p className={u.hint}>{t("Soonest first. Open one for its brief.")}</p>
        <FlightsTable data={data} />
      </section>
    </>
  );
}
