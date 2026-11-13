import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useGroup } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { Failed, JourneyBar, Loading, PageHead, u } from "../../design/ui";
import { kindLabel } from "../../domain/labels";
import { countryName, fmtDate, fmtHijri, getLang, t } from "../../i18n";
import { AddPilgrimForm } from "../pilgrims/PilgrimForm";
import { PilgrimBrowser } from "../pilgrims/PilgrimsPage";
import { GroupRafeeq } from "../rafeeq/RafeeqCards";
import { EditGroupForm } from "./GroupForm";
import { ImportPilgrims } from "./ImportPilgrims";

export function GroupPage() {
  const { id } = useParams();
  const q = useGroup(id);
  const canGroup = useCan("group:write");
  const canPilgrim = useCan("pilgrim:write");
  const canCards = useCan("rafeeq:issue");
  const [open, setOpen] = useState<"edit" | "add" | "import" | "cards" | null>(null);
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
      >
        {!open && (canGroup || canPilgrim || canCards) && (
          <div className={u.headActions}>
            {canGroup && (
              <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setOpen("edit")}>
                {t("Edit group")}
              </button>
            )}
            {canCards && (
              <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setOpen("cards")}>
                {t("Rafeeq cards")}
              </button>
            )}
            {canPilgrim && (
              <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setOpen("import")}>
                {t("Import from CSV")}
              </button>
            )}
            {canPilgrim && (
              <button type="button" className={u.button} onClick={() => setOpen("add")}>
                {t("Add pilgrim")}
              </button>
            )}
          </div>
        )}
      </PageHead>
      {open === "edit" && <EditGroupForm key={g.id} group={g} onClose={() => setOpen(null)} />}
      {open === "add" && <AddPilgrimForm groupId={g.id} country={g.origin_country} onClose={() => setOpen(null)} />}
      {open === "cards" && <GroupRafeeq groupId={g.id} onClose={() => setOpen(null)} />}
      {open === "import" && <ImportPilgrims groupId={g.id} country={g.origin_country} onClose={() => setOpen(null)} />}
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
