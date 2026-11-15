import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAiDispatch, useDispatch, useDispatchStep, useSaveWorker, useWorkers } from "../../api/queries";
import { useCan, useSession } from "../../app/SessionContext";
import { Failed, Loading, PageHead, u } from "../../design/ui";
import { ARRIVAL_AIRPORTS, airportName } from "../../domain/airports";
import { MODES, roleLabel, ROLES, requestStatusLabel, type DispatchMode, type Role } from "../../domain/dispatch";
import { INTERPRETER_LANGUAGES } from "../../domain/languages";
import type { DispatchPlanItem, DispatchRequest, DispatchView, NewWorker, Worker } from "../../domain/types";
import { fmtDateTime, fmtNum, getLang, languageName, t } from "../../i18n";
import { blockName } from "../arrivals/Plan";
import d from "./dispatch.module.css";

/**
 * Cover the gaps: the dispatcher asks people from the roster to cover the
 * arrivals board's gaps. Off / Approve first / Automatic. Each person gets a
 * personal link to accept, decline, and say they are at the airport; until an
 * SMS or WhatsApp service is connected, staff send it with one tap on WhatsApp.
 */

const MODE_HINTS: Record<DispatchMode, string> = {
  off: "Nothing is planned on its own. You can still find people by hand.",
  approve: "The dispatcher prepares a plan; a supervisor approves it before anyone is asked.",
  auto: "The dispatcher asks people by itself and replaces anyone who says no.",
};
/** The English this page passes to t() through its table, for the Arabic coverage test. */
export const DISPATCH_PAGE_LINES_EN = Object.values(MODE_HINTS);

const what = (kind: Role, language: string | null) => roleLabel(kind) + (language ? ` (${languageName(language)})` : "");

export function CoverGapsPage() {
  const [tab, setTab] = useState<"dispatch" | "roster">("dispatch");
  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link to="/arrivals">
          {getLang() === "ar" ? "→" : "←"} {t("Back to arrivals")}
        </Link>
      </p>
      <PageHead title={t("Cover the gaps")} sub={t("Ask people from your roster, and see who said yes.")}>
        <div className={d.tabs} role="group" aria-label={t("Cover the gaps")}>
          <button type="button" aria-pressed={tab === "dispatch"} onClick={() => setTab("dispatch")}>
            {t("Dispatcher")}
          </button>
          <button type="button" aria-pressed={tab === "roster"} onClick={() => setTab("roster")}>
            {t("Roster")}
          </button>
        </div>
      </PageHead>
      {tab === "dispatch" ? <Dispatcher /> : <Roster />}
    </>
  );
}

function Dispatcher() {
  const q = useDispatch();
  const step = useDispatchStep();
  const { source } = useSession();
  const canRun = useCan("dispatch:approve");
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const v = q.data;
  const counts = (s: DispatchRequest["status"][]) => v.requests.filter((r) => s.includes(r.status)).length;
  const toSend = v.requests.filter((r) => r.status === "asked" && !r.sent_at).length;
  return (
    <>
      <div className={d.tiles}>
        <Tile label={t("To send")} n={v.provider ? 0 : toSend} tone={toSend && !v.provider ? "act" : undefined} />
        <Tile label={t("Waiting for an answer")} n={counts(["asked"])} tone="wait" />
        <Tile label={t("Confirmed")} n={counts(["accepted"])} tone="ok" />
        <Tile label={t("At the airport")} n={counts(["arrived"])} tone="ok" />
        <Tile label={t("Said no or no answer")} n={counts(["declined", "expired"])} />
      </div>
      <Settings v={v} canRun={canRun} busy={step.isPending} onSave={(x) => step.mutate(() => source.setDispatchSettings(x))} onRun={() => step.mutate(() => source.runDispatch())} />
      {step.isError && <p className={u.error}>{step.error.message}</p>}
      {v.plan && <PlanCard v={v} canRun={canRun} busy={step.isPending} onApprove={(id) => step.mutate(() => source.approvePlan(id))} onDiscard={(id) => step.mutate(() => source.discardPlan(id))} />}
      <Requests v={v} canRun={canRun} onSent={(id) => step.mutate(() => source.markSent(id))} onCancel={(id) => step.mutate(() => source.cancelRequest(id))} />
    </>
  );
}

function Tile({ label, n, tone }: { label: string; n: number; tone?: "act" | "wait" | "ok" }) {
  return (
    <div className={`${d.tile} ${tone ? d[tone] : ""}`}>
      <span>{label}</span>
      <b>{fmtNum(n)}</b>
    </div>
  );
}

function Settings({
  v,
  canRun,
  busy,
  onSave,
  onRun,
}: {
  v: DispatchView;
  canRun: boolean;
  busy: boolean;
  onSave: (x: { mode: DispatchMode; horizon_hours: number; answer_minutes: number }) => void;
  onRun: () => void;
}) {
  const s = v.settings;
  const MODE_HINT = MODE_HINTS;
  return (
    <section className={u.card}>
      <div className={d.head}>
        <h2>{t("How the dispatcher works")}</h2>
        {canRun && (
          <button type="button" className={u.button} disabled={busy} onClick={onRun}>
            {t("Find people now")}
          </button>
        )}
      </div>
      <div className={d.modes} role="radiogroup" aria-label={t("How the dispatcher works")}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={s.mode === m}
            disabled={!canRun || busy}
            className={d.mode}
            onClick={() => onSave({ mode: m, horizon_hours: s.horizon_hours, answer_minutes: s.answer_minutes })}
          >
            <b>{t(m === "off" ? "Off" : m === "approve" ? "Approve first" : "Automatic")}</b>
            <small>{t(MODE_HINT[m])}</small>
          </button>
        ))}
      </div>
      <div className={d.row}>
        <label>
          {t("Look ahead")}
          <select
            value={s.horizon_hours}
            disabled={!canRun || busy}
            onChange={(e) => onSave({ mode: s.mode, horizon_hours: Number(e.target.value), answer_minutes: s.answer_minutes })}
          >
            {[12, 24, 48, 72].map((h) => (
              <option key={h} value={h}>
                {t("{n} hours", { n: h })}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Time to answer")}
          <select
            value={s.answer_minutes}
            disabled={!canRun || busy}
            onChange={(e) => onSave({ mode: s.mode, horizon_hours: s.horizon_hours, answer_minutes: Number(e.target.value) })}
          >
            {[15, 30, 60, 120].map((m) => (
              <option key={m} value={m}>
                {t("{n} minutes", { n: m })}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!v.provider && (
        <p className={d.note}>
          {t("No SMS or WhatsApp service is connected yet, so you send each request yourself with one tap on WhatsApp. Once a service is connected, requests go out by themselves.")}
        </p>
      )}
      {!canRun && <p className={u.muted}>{t("Only a supervisor or administrator can change this or approve plans.")}</p>}
    </section>
  );
}

function PlanCard({ v, canRun, busy, onApprove, onDiscard }: { v: DispatchView; canRun: boolean; busy: boolean; onApprove: (id: string) => void; onDiscard: (id: string) => void }) {
  const p = v.plan!;
  const ai = useAiDispatch();
  const asks = p.items.reduce((n, i) => n + i.people.length, 0);
  const missing = p.items.reduce((n, i) => n + i.missing, 0);
  const note = (n: number) => ai.data?.items.find((x) => x.gap === n)?.note;
  return (
    <section className={`${u.card} ${d.plan}`}>
      <div className={d.head}>
        <h2>{t("Plan ready")}</h2>
        <span className={u.muted}>
          {asks === 1 ? t("Asks 1 person") : t("Asks {n} people", { n: asks })}
          {missing > 0 && ` · ${t("{n} nobody can cover", { n: missing })}`}
        </span>
      </div>
      <ol className={d.items}>
        {p.items.map((i, n) => (
          <PlanLine key={`${i.airport}-${i.start}-${i.kind}-${i.language}-${i.shift_id}`} i={i} note={note(n + 1)} />
        ))}
      </ol>
      {ai.data?.summary && (
        <p className={d.ai}>
          <b>{t("AI")}:</b> {ai.data.summary}
        </p>
      )}
      {ai.isError && <p className={u.error}>{ai.error.message}</p>}
      <div className={d.actions}>
        {canRun && asks > 0 && (
          <button type="button" className={u.button} disabled={busy} onClick={() => onApprove(p.id)}>
            {asks === 1 ? t("Approve and ask 1 person") : t("Approve and ask {n} people", { n: asks })}
          </button>
        )}
        <button type="button" className={`${u.button} ${u.quiet}`} disabled={ai.isPending} onClick={() => ai.mutate(getLang() === "ar" ? "ar" : "en")}>
          {ai.isPending ? t("Thinking…") : t("Explain with AI")}
        </button>
        {canRun && (
          <button type="button" className={`${u.button} ${u.quiet}`} disabled={busy} onClick={() => onDiscard(p.id)}>
            {t("Discard")}
          </button>
        )}
      </div>
      <p className={u.hint}>
        {t("Made by {who}", { who: p.made_by })} · {fmtDateTime(p.made_at)}
      </p>
    </section>
  );
}

function PlanLine({ i, note }: { i: DispatchPlanItem; note?: string }) {
  return (
    <li className={i.missing ? d.missing : undefined}>
      <div className={d.itemHead}>
        <b>{what(i.kind, i.language)}</b> · {airportName(i.airport)} · {blockName(i.start, (Date.parse(i.end) - Date.parse(i.start)) / 3_600_000)}
        {i.shift_id && <span className={d.chip}>{t("Replacing a no")}</span>}
      </div>
      <div className={d.people}>
        {i.people.map((p) => (
          <span key={p.id} className={d.person} dir="auto">
            {p.name}
          </span>
        ))}
        {i.missing > 0 && <span className={d.nobody}>{t("Nobody on the roster for {n}", { n: i.missing })}</span>}
      </div>
      {note && <p className={d.aiNote}>{note}</p>}
    </li>
  );
}

function waLink(r: DispatchRequest, demo: boolean): string {
  /* the demo's numbers are invented: WhatsApp opens with the message and lets you choose who */
  const link = r.link?.startsWith("#") ? location.href.split("#")[0] + r.link : (r.link ?? "");
  const text = encodeURIComponent(r.message.replace(/\(link\)/g, link));
  const phone = r.phone.replace(/[^\d]/g, "");
  return demo ? `https://wa.me/?text=${text}` : `https://wa.me/${phone}?text=${text}`;
}

function Requests({ v, canRun, onSent, onCancel }: { v: DispatchView; canRun: boolean; onSent: (id: string) => void; onCancel: (id: string) => void }) {
  const { me, source } = useSession();
  const demo = me.tenant.is_demo || source.kind === "mock";
  const [copied, setCopied] = useState<string | null>(null);
  const groups = new Map<string, DispatchRequest[]>();
  for (const r of v.requests) groups.set(r.shift_id, [...(groups.get(r.shift_id) ?? []), r]);
  return (
    <section className={u.card}>
      <h2>{t("Requests")}</h2>
      {v.requests.length === 0 ? (
        <p className={u.muted}>{t("Nobody has been asked yet. Approve a plan, or press Find people now.")}</p>
      ) : (
        [...groups.values()].map((rs) => {
          const r0 = rs[0];
          return (
            <div key={r0.shift_id} className={d.shift}>
              <p className={d.itemHead}>
                <b>{what(r0.kind, r0.language)}</b> · {airportName(r0.airport)} · {blockName(r0.starts_at, (Date.parse(r0.ends_at) - Date.parse(r0.starts_at)) / 3_600_000)}
              </p>
              <ul className={d.reqs}>
                {rs.map((r) => (
                  <li key={r.id}>
                    <span className={d.who} dir="auto">
                      {getLang() === "ar" && r.name_ar ? r.name_ar : r.name}
                      <small dir="ltr">{r.phone}</small>
                    </span>
                    <span className={`${d.status} ${d[`st_${r.status}`]}`}>
                      {r.status === "asked" && !r.sent_at && !v.provider ? t("To send") : requestStatusLabel(r.status)}
                    </span>
                    <span className={d.when}>
                      {r.status === "asked"
                        ? t("Answer by {time}", { time: fmtDateTime(r.answer_by) })
                        : r.arrived_at
                          ? fmtDateTime(r.arrived_at)
                          : r.answered_at
                            ? fmtDateTime(r.answered_at)
                            : ""}
                    </span>
                    <span className={d.btns}>
                      {r.status === "asked" && (
                        <a className={`${u.button} ${r.sent_at ? u.quiet : ""}`} href={waLink(r, demo)} target="_blank" rel="noreferrer" onClick={() => onSent(r.id)}>
                          {r.sent_at ? t("Send again") : t("Send on WhatsApp")}
                        </a>
                      )}
                      {r.link && (
                        <button
                          type="button"
                          className={`${u.button} ${u.quiet}`}
                          onClick={() => {
                            void navigator.clipboard?.writeText(r.link!.startsWith("#") ? location.href.split("#")[0] + r.link : r.link!);
                            setCopied(r.id);
                          }}
                        >
                          {copied === r.id ? t("Copied") : t("Copy link")}
                        </button>
                      )}
                      {r.link?.startsWith("#") && (
                        <a className={`${u.button} ${u.quiet}`} href={r.link}>
                          {t("Open their page")}
                        </a>
                      )}
                      {canRun && (r.status === "asked" || r.status === "accepted") && (
                        <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => onCancel(r.id)}>
                          {t("Take back")}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
      {demo && <p className={u.hint}>{t("Demonstration: the numbers are invented, so WhatsApp lets you choose who to send to.")}</p>}
    </section>
  );
}

/* ---- the roster ---- */

const BLANK: NewWorker = {
  name: "",
  name_ar: null,
  phone: "",
  roles: ["wheelchair"],
  languages: [],
  airports: ["JED"],
  max_hours_week: 48,
  active: true,
  note: null,
};

function Roster() {
  const q = useWorkers();
  const canEdit = useCan("roster:write");
  const [editing, setEditing] = useState<Worker | "new" | null>(null);
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  return (
    <div className={d.split}>
      <section className={u.card}>
        <div className={d.head}>
          <h2>{t("{n} people", { n: q.data.length })}</h2>
          {canEdit && (
            <button type="button" className={u.button} onClick={() => setEditing("new")}>
              {t("Add a person")}
            </button>
          )}
        </div>
        <p className={u.hint}>{t("Who can cover a shift: their role, languages and airports.")}</p>
        <div className={u.tableWrap}>
          <table className={u.table}>
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Can do")}</th>
                <th>{t("Airports")}</th>
                <th>{t("Phone")}</th>
                <th>{t("Asked now")}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((w) => (
                <tr key={w.id} onClick={() => canEdit && setEditing(w)} style={{ cursor: canEdit ? "pointer" : undefined, opacity: w.active ? 1 : 0.5 }}>
                  <td>
                    <bdi dir="auto">{getLang() === "ar" && w.name_ar ? w.name_ar : w.name}</bdi>
                    {!w.active && <div className={u.muted}>{t("Off")}</div>}
                  </td>
                  <td>
                    {w.roles.map((r) => roleLabel(r)).join(getLang() === "ar" ? "، " : ", ")}
                    {w.languages.length > 0 && <div className={u.muted}>{w.languages.map(languageName).join(getLang() === "ar" ? "، " : ", ")}</div>}
                  </td>
                  <td>{w.airports.map(airportName).join(getLang() === "ar" ? "، " : ", ")}</td>
                  <td className={u.mono} dir="ltr">
                    {w.phone}
                  </td>
                  <td>{fmtNum(w.holding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && <WorkerForm key={editing === "new" ? "new" : editing.id} w={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function WorkerForm({ w, onClose }: { w: Worker | null; onClose: () => void }) {
  const save = useSaveWorker();
  const [f, setF] = useState<NewWorker>(() => (w ? { ...w } : { ...BLANK }));
  const toggle = <T,>(xs: readonly T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = { ...f, languages: f.roles.includes("interpreter") ? f.languages : [] };
    save.mutate({ id: w?.id, w: body }, { onSuccess: onClose });
  };
  return (
    <section className={`${u.card} ${d.panel}`}>
      <div className={d.head}>
        <h2>{w ? t("Edit person") : t("Add a person")}</h2>
        <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
          {t("Close")}
        </button>
      </div>
      <form className={u.form} onSubmit={submit} style={{ gridTemplateColumns: "1fr 1fr" }}>
        <label>
          {t("Name")}
          <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label>
          {t("Name in Arabic")}
          <input dir="rtl" value={f.name_ar ?? ""} onChange={(e) => setF({ ...f, name_ar: e.target.value || null })} />
        </label>
        <label>
          {t("Phone (WhatsApp)")}
          <input required type="tel" dir="ltr" placeholder="+966 5…" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </label>
        <label>
          {t("Hours a week, at most")}
          <input type="number" min={1} max={84} value={f.max_hours_week} onChange={(e) => setF({ ...f, max_hours_week: Number(e.target.value) })} />
        </label>
        <fieldset className={d.boxes}>
          <legend>{t("Can do")}</legend>
          {ROLES.map((r) => (
            <label key={r} className={d.check}>
              <input type="checkbox" checked={f.roles.includes(r)} onChange={() => setF({ ...f, roles: toggle(f.roles, r) })} />
              {roleLabel(r)}
            </label>
          ))}
        </fieldset>
        <fieldset className={d.boxes}>
          <legend>{t("Airports")}</legend>
          {ARRIVAL_AIRPORTS.map((a) => (
            <label key={a} className={d.check}>
              <input type="checkbox" checked={f.airports.includes(a)} onChange={() => setF({ ...f, airports: toggle(f.airports, a) })} />
              {airportName(a)}
            </label>
          ))}
        </fieldset>
        {f.roles.includes("interpreter") && (
          <fieldset className={d.boxes} style={{ gridColumn: "1 / -1" }}>
            <legend>{t("Languages they interpret")}</legend>
            {INTERPRETER_LANGUAGES.map((l) => (
              <label key={l} className={d.check}>
                <input type="checkbox" checked={f.languages.includes(l)} onChange={() => setF({ ...f, languages: toggle(f.languages, l) })} />
                {languageName(l)}
              </label>
            ))}
          </fieldset>
        )}
        <label className={d.check}>
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          {t("Can be asked")}
        </label>
        <div className={u.formActions} style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className={u.button} disabled={save.isPending || f.roles.length === 0 || f.airports.length === 0}>
            {t("Save")}
          </button>
          {save.isError && <span className={u.error}>{save.error.message}</span>}
        </div>
      </form>
    </section>
  );
}
