import { useState, type FormEvent } from "react";
import type { DataSource } from "../../api/dataSource";
import { u } from "../../design/ui";
import type { Me } from "../../domain/types";
import { t, useLang } from "../../i18n";
import s from "./account.module.css";

/** The door: email and password. Nothing else of Duyuf shows until someone is through it. */
export function SignInPage({ source, onSignedIn }: { source: DataSource; onSignedIn: (me: Me) => void }) {
  const { lang, setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await source.signIn(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={s.door}>
      <form className={`${u.card} ${s.box}`} onSubmit={submit}>
        <div className={s.brand}>
          <span className={s.mark} aria-hidden="true" />
          <span>{lang === "ar" ? "ضيوف" : "Duyuf"}</span>
        </div>
        <h1>{t("Sign in")}</h1>
        <label className={u.field}>
          {t("Email")}
          <input
            type="email"
            autoComplete="username"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={u.field}>
          {t("Password")}
          <input
            type="password"
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className={u.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={u.button} disabled={busy}>
          {busy ? t("Signing in…") : t("Sign in")}
        </button>
        <p className={u.hint} style={{ margin: 0 }}>
          {t("No account? Ask your administrator.")}
        </p>
        <button type="button" className={s.lang} onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "English" : "العربية"}
        </button>
      </form>
    </main>
  );
}
