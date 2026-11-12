import type { ReactNode } from "react";
import { STATUSES, type Status } from "../domain/journey";
import { statusLabel } from "../domain/labels";
import { fmtNum, t } from "../i18n";
import u from "./ui.module.css";

export { u };

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className={u.pageHead}>
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Tile({
  label,
  value,
  note,
  attention,
}: {
  label: string;
  value: number;
  note?: string;
  attention?: boolean;
}) {
  return (
    <div className={`${u.tile} ${attention ? u.attention : ""}`}>
      <div className={u.tileLabel}>{label}</div>
      <div className={u.tileValue}>{fmtNum(value)}</div>
      {note && <div className={u.tileNote}>{note}</div>}
    </div>
  );
}

export const stageColor = (s: Status) => `var(--st-${s})`;

export function StatusChip({ status }: { status: Status }) {
  return (
    <span className={u.chip}>
      <span className={u.dot} style={{ background: stageColor(status) }} />
      {statusLabel(status)}
    </span>
  );
}

/** Head count at each stage, as one bar. With `legend`, the numbers beneath. */
export function JourneyBar({
  by,
  big,
  legend,
}: {
  by: Partial<Record<Status, number>>;
  big?: boolean;
  legend?: boolean;
}) {
  const total = STATUSES.reduce((n, s) => n + (by[s] ?? 0), 0);
  return (
    <div>
      <div
        className={`${u.bar} ${big ? u.big : ""}`}
        role="img"
        aria-label={STATUSES.map((s) => `${statusLabel(s)} ${by[s] ?? 0}`).join(", ")}
      >
        {total > 0 &&
          STATUSES.filter((s) => by[s]).map((s) => (
            <span key={s} style={{ width: `${(100 * by[s]!) / total}%`, background: stageColor(s) }} />
          ))}
      </div>
      {legend && (
        <div className={u.legend}>
          {STATUSES.map((s) => (
            <span key={s}>
              <span className={u.dot} style={{ background: stageColor(s) }} />
              {statusLabel(s)} <b>{fmtNum(by[s] ?? 0)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Loading() {
  return <p className={u.muted}>{t("Loading…")}</p>;
}

export function Failed({ error }: { error: unknown }) {
  const reason = error instanceof Error ? error.message : String(error);
  return <p className={u.error}>{t("Could not load: {reason}", { reason })}</p>;
}
