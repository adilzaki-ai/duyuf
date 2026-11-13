import { useState } from "react";
import { useImportPilgrims } from "../../api/queries";
import { u } from "../../design/ui";
import { IMPORT_COLUMNS } from "../../domain/importRow";
import type { ImportResult } from "../../domain/types";
import { fmtNum, t } from "../../i18n";
import { csvLine, parseCsv } from "../../lib/csv";

/** A file to start from: the columns, and one filled-in row to copy. */
function templateUrl(country: string): string {
  const example = ["Imran Khan", "", "M", "1958-03-02", country || "PK", "AB1234567", "+92 300 0000000", "ur", "wheelchair; medical"];
  const text = `﻿${csvLine([...IMPORT_COLUMNS])}\r\n${csvLine(example)}\r\n`;
  return URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
}

/**
 * Pilgrims from a spreadsheet: pick a CSV, see what the platform makes of it,
 * then save. One bad row and nothing is saved; every problem is listed by
 * row and column, so the file can be fixed and picked again.
 */
export function ImportPilgrims({ groupId, country, onClose }: { groupId: string; country: string; onClose: () => void }) {
  const run = useImportPilgrims(groupId);
  const [file, setFile] = useState<{ name: string; rows: Record<string, string>[]; unknown: string[] } | null>(null);
  const [check, setCheck] = useState<ImportResult | null>(null);
  const [template] = useState(() => templateUrl(country));

  const pick = async (f: File | undefined) => {
    setCheck(null);
    run.reset();
    if (!f) return setFile(null);
    const { columns, rows } = parseCsv(await f.text());
    const unknown = columns.filter((c) => !(IMPORT_COLUMNS as readonly string[]).includes(c));
    setFile({ name: f.name, rows, unknown });
    if (rows.length) run.mutate({ rows, dryRun: true }, { onSuccess: setCheck });
  };

  const saved = run.data?.saved;
  const missing = file ? (["full_name", "gender", "nationality", "passport_no"] as const).filter((c) => !file.rows.some((r) => c in r)) : [];

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("Import pilgrims from a spreadsheet")}</h2>
      <p className={u.hint}>
        {t("Save it as CSV. One row per pilgrim.")}{" "}
        <a href={template} download="duyuf-pilgrims.csv">
          {t("Download the template")}
        </a>
      </p>
      <p className={u.hint}>
        {t("Columns")}: <span className={u.mono}>{IMPORT_COLUMNS.join(", ")}</span>
      </p>
      <label className={u.field} style={{ maxWidth: 420 }}>
        {t("CSV file")}
        <input type="file" accept=".csv,text/csv" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>

      {file && file.rows.length === 0 && <p className={u.error}>{t("That file has no rows under its header.")}</p>}
      {missing.length > 0 && (
        <p className={u.error}>{t("Missing columns: {cols}", { cols: missing.join(", ") })}</p>
      )}
      {file && file.unknown.length > 0 && (
        <p className={u.muted}>{t("Not read: {cols}", { cols: file.unknown.join(", ") })}</p>
      )}
      {run.isPending && <p className={u.muted}>{t("Checking…")}</p>}
      {run.isError && <p className={u.error}>{run.error.message}</p>}

      {saved ? (
        <p className={u.done}>
          <b>{t("{n} pilgrims added to the group.", { n: fmtNum(run.data!.rows) })}</b>
        </p>
      ) : (
        check && (
          <>
            <p>
              {t("{valid} of {rows} rows are ready.", { valid: fmtNum(check.valid), rows: fmtNum(check.rows) })}{" "}
              {check.errors.length > 0 && <span className={u.error}>{t("Fix the rows below, then pick the file again.")}</span>}
            </p>
            {check.errors.length > 0 && (
              <div className={u.tableWrap} style={{ maxHeight: 320, overflowY: "auto" }}>
                <table className={u.table}>
                  <thead>
                    <tr>
                      <th>{t("Row")}</th>
                      <th>{t("Column")}</th>
                      <th>{t("Problem")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.errors.map((e, i) => (
                      <tr key={i} style={{ cursor: "default" }}>
                        <td>{e.row}</td>
                        <td className={u.mono}>{e.field}</td>
                        <td style={{ whiteSpace: "normal" }}>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}

      <div className={u.formActions} style={{ marginTop: 12 }}>
        {!saved && (
          <button
            type="button"
            className={u.button}
            disabled={!check || check.errors.length > 0 || check.rows === 0 || run.isPending}
            onClick={() => file && run.mutate({ rows: file.rows, dryRun: false })}
          >
            {check && check.errors.length === 0 && check.rows > 0
              ? t("Add {n} pilgrims", { n: fmtNum(check.rows) })
              : t("Add pilgrims")}
          </button>
        )}
        <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
          {saved ? t("Done") : t("Cancel")}
        </button>
      </div>
    </section>
  );
}
