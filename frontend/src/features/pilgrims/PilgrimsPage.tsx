import { useState } from "react";
import { useGroups, usePilgrims } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { Failed, Loading, PageHead, StatusChip, u } from "../../design/ui";
import { STATUSES, type Status } from "../../domain/journey";
import { needLabel, statusLabel } from "../../domain/labels";
import { countryName, fmtNum, t } from "../../i18n";
import { PilgrimPanel } from "./PilgrimPanel";
import p from "./pilgrims.module.css";

const PAGE = 100;

/** Search, filter and open pilgrims. On its own page, under a group with that group fixed, and under a flight. */
export function PilgrimBrowser({ groupId, flightId }: { groupId?: string; flightId?: string }) {
  const seesPassports = useCan("pilgrim:identity");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [group, setGroup] = useState(groupId ?? "");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const groups = useGroups();
  const list = usePilgrims({
    q: q.trim() || undefined,
    status: status || undefined,
    group_id: group || undefined,
    flight_id: flightId,
    limit,
  });

  return (
    <div className={`${p.layout} ${open ? p.withPanel : ""}`}>
      <section className={u.card}>
        <div className={u.filters}>
          <input
            type="search"
            value={q}
            placeholder={t(seesPassports ? "Search by name or passport" : "Search by name")}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | "")}>
            <option value="">{t("All stages")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          {!groupId && (
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">{t("All groups")}</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} · {g.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <Failed error={list.error} />
        ) : list.data.items.length === 0 ? (
          <p className={u.muted}>{t("No pilgrims match.")}</p>
        ) : (
          <>
            <p className={u.hint}>{t("{n} of {total}", { n: fmtNum(list.data.items.length), total: fmtNum(list.data.total) })}</p>
            <div className={u.tableWrap}>
              <table className={u.table}>
                <thead>
                  <tr>
                    <th>{t("Name")}</th>
                    {!groupId && <th>{t("Group")}</th>}
                    <th>{t("Nationality")}</th>
                    <th>{t("Passport")}</th>
                    <th>{t("Stage")}</th>
                    <th>{t("Needs")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((x) => (
                    <tr key={x.id} className={open === x.id ? u.selected : undefined} onClick={() => setOpen(x.id)}>
                      <td>
                        {x.full_name}
                        {x.full_name_ar && (
                          <span className={u.sub} dir="rtl">
                            {x.full_name_ar}
                          </span>
                        )}
                      </td>
                      {!groupId && <td className={u.mono}>{x.group_code}</td>}
                      <td>{countryName(x.nationality)}</td>
                      <td className={u.mono} dir="ltr">
                        {x.passport_no}
                      </td>
                      <td>
                        <StatusChip status={x.status} />
                      </td>
                      <td>
                        {x.needs.map((n) => (
                          <span key={n} className={u.need}>
                            {needLabel(n)}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.data.items.length < list.data.total && (
              <p>
                <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setLimit(limit + PAGE)}>
                  {t("Show more")}
                </button>
              </p>
            )}
          </>
        )}
      </section>
      {open && <PilgrimPanel id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function PilgrimsPage() {
  return (
    <>
      <PageHead title={t("Pilgrims")} sub={t("Find a pilgrim and update their stage.")} />
      <PilgrimBrowser />
    </>
  );
}
