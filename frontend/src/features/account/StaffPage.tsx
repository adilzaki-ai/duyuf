import { useState, type FormEvent } from "react";
import { useAddStaff, useStaff, useUpdateStaff } from "../../api/queries";
import { useSession } from "../../app/SessionContext";
import { Failed, Loading, PageHead, u } from "../../design/ui";
import type { Role, StaffMember } from "../../domain/types";
import { fmtDateTime, t } from "../../i18n";
import { ChangePassword } from "./ChangePassword";
import s from "./account.module.css";

export const ROLES: Role[] = ["administrator", "supervisor", "staff", "viewer"];
const ROLE_EN: Record<Role, string> = {
  administrator: "Administrator",
  supervisor: "Supervisor",
  staff: "Desk staff",
  viewer: "Viewer",
};
export const roleLabel = (r: string) => t(ROLE_EN[r as Role] ?? r);
export const ROLE_LABELS_EN = Object.values(ROLE_EN);

/** A password to hand over: easy to read out, changed at first sign in anyway. */
function madeUp(): string {
  const words = ["sand", "palm", "date", "moon", "well", "dune", "gate", "lamp", "road", "star", "tent", "olive"];
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  return `${pick()}-${pick()}-${1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)}`;
}

function HandOver({ who, password }: { who: string; password: string }) {
  return (
    <div className={s.once} role="status">
      {t("Give {who} this password. It is shown once and must be changed at first sign in:", { who })}{" "}
      <code dir="ltr">{password}</code>
    </div>
  );
}

function AddStaff() {
  const add = useAddStaff();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [given, setGiven] = useState<{ who: string; password: string } | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const password = madeUp();
    add.mutate(
      { display_name: name.trim(), email: email.trim(), role, password },
      {
        onSuccess: (p) => {
          setGiven({ who: p.display_name, password });
          setName("");
          setEmail("");
        },
      },
    );
  };

  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("Add a person")}</h2>
      <form className={u.form} onSubmit={submit}>
        <label>
          {t("Name")}
          <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t("Email")}
          <input type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t("Role")}
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <div className={u.formActions}>
          <button type="submit" className={u.button} disabled={add.isPending}>
            {t("Add")}
          </button>
          {add.isError && <span className={u.error}>{add.error.message}</span>}
        </div>
      </form>
      {given && <HandOver {...given} />}
    </section>
  );
}

function Row({ p, me }: { p: StaffMember; me: string | null }) {
  const update = useUpdateStaff();
  const [given, setGiven] = useState<string | null>(null);
  const self = p.id === me;
  return (
    <tr style={{ cursor: "default" }}>
      <td>
        {p.display_name}
        {self && <span className={u.sub}>{t("You")}</span>}
      </td>
      {p.email ? (
        <td className={u.mono} dir="ltr" style={{ textAlign: "start" }}>
          {p.email}
        </td>
      ) : (
        <td className={u.muted}>{t("No sign in (key only)")}</td>
      )}
      <td>
        <select
          aria-label={t("Role of {who}", { who: p.display_name })}
          value={p.role}
          disabled={self || update.isPending}
          onChange={(e) => update.mutate({ id: p.id, change: { role: e.target.value as Role } })}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </td>
      <td>
        {p.disabled ? (
          <span className={u.error}>{t("Switched off")}</span>
        ) : p.must_change_password ? (
          <span className={u.muted}>{t("Waiting for first sign in")}</span>
        ) : p.last_signed_in_at ? (
          fmtDateTime(p.last_signed_in_at)
        ) : (
          <span className={u.muted}>{t("Never")}</span>
        )}
      </td>
      <td style={{ whiteSpace: "normal" }}>
        {!self && (
          <div className={u.headActions}>
            <button
              type="button"
              className={`${u.button} ${u.quiet}`}
              disabled={update.isPending}
              onClick={() => update.mutate({ id: p.id, change: { disabled: !p.disabled } })}
            >
              {p.disabled ? t("Switch on") : t("Switch off")}
            </button>
            {p.email && (
              <button
                type="button"
                className={`${u.button} ${u.quiet}`}
                disabled={update.isPending}
                onClick={() => {
                  const password = madeUp();
                  update.mutate({ id: p.id, change: { password } }, { onSuccess: () => setGiven(password) });
                }}
              >
                {t("Reset password")}
              </button>
            )}
          </div>
        )}
        {given && <HandOver who={p.display_name} password={given} />}
        {update.isError && <p className={u.error}>{update.error.message}</p>}
      </td>
    </tr>
  );
}

/** Who may sign in, with which role. Administrators only. */
export function StaffPage() {
  const { me } = useSession();
  const q = useStaff();
  return (
    <>
      <PageHead title={t("Staff")} sub={t("Who can sign in, and what they may do.")} />
      <AddStaff />
      <section className={u.card}>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <Failed error={q.error} />
        ) : (
          <div className={u.tableWrap}>
            <table className={u.table}>
              <thead>
                <tr>
                  <th>{t("Name")}</th>
                  <th>{t("Email")}</th>
                  <th>{t("Role")}</th>
                  <th>{t("Last sign in")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.map((p) => (
                  <Row key={p.id} p={p} me={me.principal.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={u.hint} style={{ marginTop: 10 }}>
          {t("Switching someone off, or resetting their password, signs them out everywhere.")}
        </p>
      </section>
    </>
  );
}

/** One's own account: who they are, and their password. */
export function AccountPage() {
  const { source, me, updateMe } = useSession();
  return (
    <>
      <PageHead title={t("Your account")} sub={`${me.principal.name} · ${roleLabel(me.principal.role)}`} />
      <section className={u.card}>
        <h2>{t("Change password")}</h2>
        {me.via === "session" ? (
          <ChangePassword source={source} onChanged={updateMe} />
        ) : (
          <p className={u.muted}>{t("Signed in without a password here, so there is none to change.")}</p>
        )}
      </section>
    </>
  );
}
