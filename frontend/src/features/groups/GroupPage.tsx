import { Link, useParams } from "react-router-dom";
import { useGroup } from "../../api/queries";
import { Failed, JourneyBar, Loading, PageHead, u } from "../../design/ui";
import { kindLabel } from "../../domain/labels";
import { countryName, fmtDate, fmtHijri, getLang, t } from "../../i18n";
import { PilgrimBrowser } from "../pilgrims/PilgrimsPage";

export function GroupPage() {
  const { id } = useParams();
  const q = useGroup(id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const g = q.data;
  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link to="/groups">
          {getLang() === "ar" ? "→" : "←"} {t("Back to groups")}
        </Link>
      </p>
      <PageHead
        title={g.name}
        sub={`${g.code} · ${kindLabel(g.kind)} · ${t("Season {s}", { s: g.season })} · ${countryName(g.origin_country)}`}
      />
      <div className={u.grid2}>
        <section className={u.card}>
          <ul className={u.list}>
            <li>
              <span>{t("Arrives")}</span>
              <span>
                {fmtDate(g.arrival_date)} <span className={u.muted}>· {fmtHijri(g.arrival_date)}</span>
              </span>
            </li>
            <li>
              <span>{t("Leaves")}</span>
              <span>
                {fmtDate(g.departure_date)} <span className={u.muted}>· {fmtHijri(g.departure_date)}</span>
              </span>
            </li>
            <li>
              <span>{t("Leader")}</span>
              <span>{g.leader_name ?? "—"}</span>
            </li>
            <li>
              <span>{t("Leader phone")}</span>
              <span className={u.mono} dir="ltr">
                {g.leader_phone ?? "—"}
              </span>
            </li>
          </ul>
        </section>
        <section className={u.card}>
          <h2>{t("Where everyone is")}</h2>
          <div style={{ marginTop: 12 }}>
            <JourneyBar by={g.by_status} big legend />
          </div>
        </section>
      </div>
      <PilgrimBrowser groupId={g.id} />
    </>
  );
}
