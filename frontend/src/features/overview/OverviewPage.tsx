import { Link } from "react-router-dom";
import { useOverview } from "../../api/queries";
import { Failed, JourneyBar, Loading, PageHead, Tile, u } from "../../design/ui";
import { inKingdom } from "../../domain/journey";
import { kindLabel, needLabel } from "../../domain/labels";
import type { MovingGroup, Need } from "../../domain/types";
import { countryName, fmtDate, fmtHijri, fmtNum, t } from "../../i18n";
import { daysBetween } from "../../lib/dates";

function when(on: string, today: string): string {
  const d = daysBetween(today, on);
  return d === 0 ? t("Today") : d === 1 ? t("Tomorrow") : t("In {n} days", { n: d });
}

function Moving({ title, items, today, days }: { title: string; items: MovingGroup[]; today: string; days: number }) {
  return (
    <section className={u.card}>
      <h2>{t(title, { n: days })}</h2>
      {items.length === 0 ? (
        <p className={u.muted}>{t("Nothing in the next {n} days.", { n: days })}</p>
      ) : (
        <ul className={u.list}>
          {items.map((g) => (
            <li key={g.id}>
              <span>
                <Link to={`/groups/${g.id}`}>{g.name}</Link>
                <span className={u.sub}>
                  {g.code} · {kindLabel(g.kind)} · {countryName(g.origin_country)} · {fmtNum(g.pilgrims)}
                </span>
              </span>
              <span style={{ textAlign: "end" }}>
                <b>{when(g.on_date, today)}</b>
                <span className={u.sub}>
                  {fmtDate(g.on_date)} · {fmtHijri(g.on_date)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OverviewPage() {
  const q = useOverview();
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const o = q.data;
  const arrivingPeople = o.arriving.reduce((n, g) => n + g.pilgrims, 0);
  const care = (o.needs.wheelchair ?? 0) + (o.needs.medical ?? 0);
  const needs = Object.entries(o.needs).sort((a, b) => b[1] - a[1]) as [Need, number][];

  return (
    <>
      <PageHead title={t("Overview")} sub={t("Where every pilgrim is today.")}>
        <span className={u.muted}>
          {fmtDate(o.today)} · {fmtHijri(o.today)}
        </span>
      </PageHead>

      <div className={u.tiles}>
        <Tile label={t("Pilgrims")} value={o.pilgrims} note={t("In {n} groups", { n: o.groups })} />
        <Tile label={t("In the Kingdom")} value={inKingdom(o.by_status)} />
        <Tile label={t("Arriving this week")} value={arrivingPeople} />
        <Tile label={t("Need care")} value={care} note={t("Wheelchair or medical, still here.")} attention />
      </div>

      <section className={u.card} style={{ marginBottom: 16 }}>
        <h2>{t("Where everyone is")}</h2>
        <div style={{ marginTop: 12 }}>
          <JourneyBar by={o.by_status} big legend />
        </div>
      </section>

      <div className={u.grid2}>
        <Moving title="Arriving in the next {n} days" items={o.arriving} today={o.today} days={o.window_days} />
        <Moving title="Leaving in the next {n} days" items={o.departing} today={o.today} days={o.window_days} />
      </div>

      <section className={u.card}>
        <h2>{t("Care to plan for")}</h2>
        <p className={u.hint}>{t("Not counting pilgrims who have left.")}</p>
        <ul className={u.list}>
          {needs.map(([n, count]) => (
            <li key={n}>
              <span>{needLabel(n)}</span>
              <b>{fmtNum(count)}</b>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
