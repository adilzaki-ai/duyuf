import { useNavigate } from "react-router-dom";
import { useGroups } from "../../api/queries";
import { Failed, JourneyBar, Loading, PageHead, u } from "../../design/ui";
import { kindLabel } from "../../domain/labels";
import { countryName, fmtDate, fmtHijri, fmtNum, t } from "../../i18n";

export function GroupsPage() {
  const q = useGroups();
  const go = useNavigate();
  return (
    <>
      <PageHead title={t("Groups")} sub={t("Every group, its dates and stage.")} />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failed error={q.error} />
      ) : (
        <div className={`${u.card} ${u.tableWrap}`}>
          <table className={u.table}>
            <thead>
              <tr>
                <th>{t("Group")}</th>
                <th>{t("Type")}</th>
                <th>{t("From")}</th>
                <th>{t("Arrives")}</th>
                <th>{t("Leaves")}</th>
                <th>{t("Pilgrims")}</th>
                <th style={{ minWidth: 160 }}>{t("Stage")}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((g) => (
                <tr key={g.id} onClick={() => go(`/groups/${g.id}`)}>
                  <td>
                    {g.name}
                    <span className={`${u.sub} ${u.mono}`}>{g.code}</span>
                  </td>
                  <td>
                    {kindLabel(g.kind)}
                    <span className={u.sub}>{t("Season {s}", { s: g.season })}</span>
                  </td>
                  <td>{countryName(g.origin_country)}</td>
                  <td>
                    {fmtDate(g.arrival_date)}
                    <span className={u.sub}>{fmtHijri(g.arrival_date)}</span>
                  </td>
                  <td>
                    {fmtDate(g.departure_date)}
                    <span className={u.sub}>{fmtHijri(g.departure_date)}</span>
                  </td>
                  <td>{fmtNum(g.pilgrims)}</td>
                  <td style={{ paddingTop: 15 }}>
                    <JourneyBar by={g.by_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
