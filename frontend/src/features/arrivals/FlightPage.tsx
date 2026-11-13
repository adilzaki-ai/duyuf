import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAssignToFlight, useFlight, useGroups, useLandFlight, useUpdateFlight } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { Failed, Loading, PageHead, u } from "../../design/ui";
import { airportName } from "../../domain/airports";
import { BUS_SEATS, INTERPRETER_EVERY, OLDER_AGE } from "../../domain/brief";
import type { FlightDetail, FlightEvent } from "../../domain/types";
import { fmtDate, fmtDateTime, fmtHijri, fmtNum, fmtTime, getLang, ltr, route, t } from "../../i18n";
import { daysBetween, ksaDate } from "../../lib/dates";
import { PilgrimBrowser } from "../pilgrims/PilgrimsPage";
import a from "./arrivals.module.css";
import { FlightStateChip, langName } from "./parts";

function When({ label, iso, extra }: { label: string; iso: string; extra?: string }) {
  const day = ksaDate(new Date(iso));
  return (
    <li>
      <span>{label}</span>
      <span style={{ textAlign: "end" }}>
        <b dir="ltr">{fmtTime(iso)}</b> {extra && <span className={u.muted}>· {extra}</span>}
        <span className={u.sub}>
          {fmtDate(day)} · {fmtHijri(day)}
        </span>
      </span>
    </li>
  );
}

function Row({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <li>
      <span>
        {label}
        {note && <span className={u.sub}>{note}</span>}
      </span>
      <b className={a.num}>{fmtNum(value)}</b>
    </li>
  );
}

function eventText(e: FlightEvent): string {
  switch (e.kind) {
    case "created":
      return t("Flight added");
    case "expected":
      return e.detail.expected_at
        ? t("Now expected at {time}", { time: fmtTime(e.detail.expected_at) })
        : t("Back on schedule");
    case "added":
      return e.detail.group
        ? t("{n} pilgrims added from {group}", { n: e.detail.added, group: e.detail.group })
        : t("{n} pilgrims added", { n: e.detail.added });
    case "landed":
      return t("Landed: {n} moved to Arrived", { n: e.detail.arrived });
  }
}

function ChangeTime({ f }: { f: FlightDetail }) {
  const update = useUpdateFlight(f.id);
  const [date, setDate] = useState(ksaDate(new Date(f.expected_at)));
  const [time, setTime] = useState(fmtTime(f.expected_at));
  return (
    <div>
      <h3>{t("Change expected time")}</h3>
      <p className={u.hint}>{t("Saudi time. Buses and desks plan on this.")}</p>
      <div className={a.row}>
        <input type="date" aria-label={t("Date")} value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" aria-label={t("Saudi time")} value={time} onChange={(e) => setTime(e.target.value)} />
        <button
          type="button"
          className={u.button}
          disabled={update.isPending || !date || !time}
          onClick={() => update.mutate({ estimated_at: `${date}T${time}:00+03:00` })}
        >
          {t("Save")}
        </button>
        {f.estimated_at && (
          <button
            type="button"
            className={`${u.button} ${u.quiet}`}
            disabled={update.isPending}
            onClick={() => update.mutate({ estimated_at: null })}
          >
            {t("Back on schedule")}
          </button>
        )}
      </div>
      {update.isError && <p className={u.error}>{update.error.message}</p>}
    </div>
  );
}

function AddGroup({ f }: { f: FlightDetail }) {
  const groups = useGroups();
  const assign = useAssignToFlight(f.id);
  const [group, setGroup] = useState("");
  const landing = ksaDate(new Date(f.expected_at));
  /* groups with someone still to fly, those landing nearest this flight's day first */
  const options = (groups.data ?? [])
    .filter((g) => (g.by_status.registered ?? 0) + (g.by_status.visa_issued ?? 0) > 0)
    .sort(
      (x, y) =>
        Math.abs(daysBetween(landing, x.arrival_date ?? "2999-01-01")) -
          Math.abs(daysBetween(landing, y.arrival_date ?? "2999-01-01")) || x.code.localeCompare(y.code),
    );
  return (
    <div>
      <h3>{t("Add a group")}</h3>
      <p className={u.hint}>{t("Adds its pilgrims who have no flight yet.")}</p>
      <div className={a.row}>
        <select aria-label={t("Group")} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">{t("Choose a group")}</option>
          {options.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} · {g.name} · {fmtDate(g.arrival_date)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={u.button}
          disabled={!group || assign.isPending}
          onClick={() => assign.mutate({ group_id: group }, { onSuccess: () => setGroup("") })}
        >
          {t("Add")}
        </button>
      </div>
      {assign.isSuccess && (
        <p className={a.ok}>
          {assign.data.added
            ? t("Added {n} pilgrims.", { n: assign.data.added })
            : t("No one in that group is waiting for a flight.")}
        </p>
      )}
      {assign.isError && <p className={u.error}>{assign.error.message}</p>}
    </div>
  );
}

function Land({ f }: { f: FlightDetail }) {
  const land = useLandFlight(f.id);
  const [sure, setSure] = useState(false);
  const moving = f.brief.pilgrims - f.brief.no_visa;
  return (
    <div>
      <h3>{t("Mark landed")}</h3>
      <p className={u.hint}>{t("{n} with a visa move to Arrived.", { n: moving })}</p>
      {!sure ? (
        <div className={a.row}>
          <button type="button" className={u.button} onClick={() => setSure(true)}>
            {t("Mark landed")}
          </button>
        </div>
      ) : (
        <div className={a.row}>
          <button type="button" className={u.button} disabled={land.isPending} onClick={() => land.mutate(undefined)}>
            {t("Yes, {flight} is down", { flight: f.number })}
          </button>
          <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setSure(false)}>
            {t("Cancel")}
          </button>
        </div>
      )}
      {land.isError && <p className={u.error}>{land.error.message}</p>}
    </div>
  );
}

export function FlightPage() {
  const { id } = useParams();
  const q = useFlight(id);
  const canPlan = useCan("flight:write");
  const canLand = useCan("pilgrim:status");
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const f = q.data;
  const b = f.brief;
  const landedEvent = f.history.findLast((e) => e.kind === "landed");

  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link to="/arrivals">
          {getLang() === "ar" ? "→" : "←"} {t("Back to arrivals")}
        </Link>
      </p>
      <PageHead
        title={f.number}
        sub={route(f.origin_airport, `${airportName(f.arrival_airport)} (${ltr(f.arrival_airport)})`)}
      >
        <FlightStateChip flight={f} />
      </PageHead>

      <div className={u.grid2}>
        <section className={u.card}>
          <h2>{t("When")}</h2>
          <ul className={u.list}>
            <When label={t("Scheduled")} iso={f.scheduled_at} />
            {f.estimated_at && !f.landed_at && (
              <When
                label={t("Expected")}
                iso={f.estimated_at}
                extra={f.delay_minutes > 0 ? t("{n} min late", { n: f.delay_minutes }) : undefined}
              />
            )}
            {f.landed_at && <When label={t("Landed")} iso={f.landed_at} />}
          </ul>
          <h2 style={{ marginTop: 16 }}>{t("Groups on board")}</h2>
          {f.groups.length === 0 ? (
            <p className={u.muted}>{t("No one is on this flight yet.")}</p>
          ) : (
            <ul className={u.list}>
              {f.groups.map((g) => (
                <li key={g.id}>
                  <span>
                    <Link to={`/groups/${g.id}`}>{g.name}</Link> <span className={u.mono}>{g.code}</span>
                  </span>
                  <b>{fmtNum(g.pilgrims)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={u.card}>
          <h2>{t("Flight brief")}</h2>
          <p className={u.hint}>{t("What to have ready at the gate.")}</p>
          {b.no_visa > 0 && (
            <p className={u.error} style={{ marginTop: 0 }}>
              {t("{n} with no visa yet. They will not move to Arrived.", { n: b.no_visa })}
            </p>
          )}
          <ul className={u.list}>
            <Row label={t("Pilgrims")} value={b.pilgrims} />
            <Row
              label={t("Over 75")}
              value={b.over_75}
              note={b.unknown_age ? t("{n} with no birth date recorded", { n: b.unknown_age }) : undefined}
            />
            <Row label={t("Wheelchairs")} value={b.wheelchair} />
            <Row label={t("Medical care")} value={b.medical} />
            <Row label={t("Special diet")} value={b.dietary} />
            <Row label={t("Minor alone")} value={b.minor_alone} />
            <Row label={t("Buses")} value={b.buses} note={t("{n} seats each", { n: BUS_SEATS })} />
            <Row
              label={t("Interpreters")}
              value={b.interpreters}
              note={t("One per {n}, except Arabic and English", { n: INTERPRETER_EVERY })}
            />
          </ul>
          <h3 style={{ fontSize: 14, margin: "14px 0 4px" }}>{t("Languages")}</h3>
          <ul className={u.list}>
            {b.languages.map((l) => (
              <li key={l.language ?? "-"}>
                <span>{langName(l.language)}</span>
                <span>
                  <b>{fmtNum(l.pilgrims)}</b>
                  {l.interpreters > 0 && (
                    <span className={u.muted}> · {t("{n} interpreters", { n: l.interpreters })}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className={u.hint} style={{ marginTop: 10 }}>
            {t("Over {n} on the day it lands.", { n: OLDER_AGE })}
          </p>
        </section>
      </div>

      {!f.landed_at && (canPlan || canLand) && (
        <section className={`${u.card} ${a.actions}`} style={{ marginBottom: 16 }}>
          <h2>{t("Actions")}</h2>
          {canLand && <Land f={f} />}
          {canPlan && <ChangeTime f={f} />}
          {canPlan && <AddGroup f={f} />}
        </section>
      )}
      {landedEvent?.kind === "landed" && (
        <p className={a.ok} style={{ marginBottom: 16 }}>
          {t("{n} moved to Arrived.", { n: landedEvent.detail.arrived })}{" "}
          {landedEvent.detail.no_visa > 0 && t("{n} with no visa stay where they are.", { n: landedEvent.detail.no_visa })}
        </p>
      )}

      <section className={u.card} style={{ marginBottom: 16 }}>
        <h2>{t("History")}</h2>
        <ol className={u.list}>
          {[...f.history].reverse().map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span>{eventText(e)}</span>
              <span className={u.muted}>
                {fmtDateTime(e.at)} · {t("by {who}", { who: e.actor })}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>{t("On this flight")}</h2>
      <PilgrimBrowser flightId={f.id} />
    </>
  );
}
