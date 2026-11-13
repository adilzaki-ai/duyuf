import { useState, type FormEvent } from "react";
import type { DataSource } from "../../api/dataSource";
import { u } from "../../design/ui";
import type { Me } from "../../domain/types";
import { t } from "../../i18n";

const MIN = 10;

/**
 * One's own password. With `forced`, it is the only thing on screen: a new or
 * reset password has to be replaced before anything else opens.
 */
export function ChangePassword({
  source,
  onChanged,
  forced,
}: {
  source: DataSource;
  onChanged: (me: Me) => void;
  forced?: boolean;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const problem =
    next && next.length < MIN
      ? t("At least {n} characters.", { n: MIN })
      : again && next !== again
        ? t("The two new passwords are not the same.")
        : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      const me = await source.changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setAgain("");
      onChanged(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={u.form} style={{ gridTemplateColumns: "1fr", maxWidth: 380 }} onSubmit={submit}>
      {forced && <p style={{ margin: 0 }}>{t("Choose your own password before you start.")}</p>}
      <label>
        {forced ? t("Password you were given") : t("Current password")}
        <input
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label>
        {t("New password")}
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN}
          dir="ltr"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <label>
        {t("New password again")}
        <input
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </label>
      {(problem || error) && (
        <p className={u.error} role="alert" style={{ margin: 0 }}>
          {problem ?? error}
        </p>
      )}
      {done && !forced && <p className={u.done} style={{ margin: 0 }}>{t("Password changed. You are signed out everywhere else.")}</p>}
      <div className={u.formActions}>
        <button type="submit" className={u.button} disabled={busy || !!problem}>
          {t("Save password")}
        </button>
      </div>
    </form>
  );
}
