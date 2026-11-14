import { Link, NavLink, Outlet } from "react-router-dom";
import { useCan, useSession } from "../app/SessionContext";
import { DuyufMark } from "../design/DuyufMark";
import { AskBar } from "../features/ai/AskBar";
import { useTheme } from "../design/theme";
import { roleLabel } from "../features/account/StaffPage";
import { t, useLang } from "../i18n";
import s from "./shell.module.css";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/arrivals", label: "Arrivals", end: false },
  { to: "/groups", label: "Groups", end: false },
  { to: "/pilgrims", label: "Pilgrims", end: false },
  { to: "/incidents", label: "Incidents", end: false },
  { to: "/analyst", label: "Analyst", end: false },
];

export function Shell() {
  const { source, me, fallbackReason, signedOut } = useSession();
  const canManage = useCan("staff:manage");
  const canHealth = useCan("health:read");
  const nav = [
    ...NAV.slice(0, 5),
    ...(canHealth ? [{ to: "/health", label: "Health", end: false }] : []),
    ...NAV.slice(5),
    ...(canManage ? [{ to: "/staff", label: "Staff", end: false }] : []),
  ];
  const { lang, setLang } = useLang();
  const [theme, toggleTheme] = useTheme();
  const operator = lang === "ar" && me.tenant.name_ar ? me.tenant.name_ar : me.tenant.name;

  return (
    <div className={s.shell}>
      <header className={s.header}>
        <div className={s.brand}>
          <DuyufMark size={36} />
          <span className={s.brandWords}>
            <span className={s.word}>{lang === "ar" ? "ضيوف" : "Duyuf"}</span>
            <span className={s.operator}>{operator}</span>
          </span>
        </div>
        <nav className={s.nav}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? s.active : undefined)}>
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
        <AskBar />
        <div className={s.tools}>
          <details className={s.menu}>
            <summary aria-label={t("Account")}>
              <span className={s.who}>{me.principal.name}</span>
              <span className={s.initial} aria-hidden="true">
                {me.principal.name.slice(0, 1)}
              </span>
            </summary>
            <div className={s.menuPanel}>
              <b>{me.principal.name}</b>
              <span className={s.menuSub}>
                {roleLabel(me.principal.role)}
                {me.principal.email && (
                  <>
                    {" · "}
                    <span dir="ltr">{me.principal.email}</span>
                  </>
                )}
              </span>
              <Link to="/account">{t("Your account")}</Link>
              {me.via === "session" && (
                <button type="button" onClick={() => void source.signOut().finally(signedOut)}>
                  {t("Sign out")}
                </button>
              )}
            </div>
          </details>
          <button
            type="button"
            className={s.iconButton}
            aria-label={theme === "dark" ? t("Light screen") : t("Dark screen")}
            title={theme === "dark" ? t("Light screen") : t("Dark screen")}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4.5" fill="currentColor" />
                <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className={s.lang}
            aria-label={t("Language")}
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            {lang === "ar" ? "English" : "العربية"}
          </button>
        </div>
      </header>
      {source.kind === "mock" && (
        <div className={s.sample} role="status">
          {fallbackReason
            ? t("Sample data — the platform could not be reached: {reason}", { reason: fallbackReason })
            : t("Sample data — invented pilgrims, nothing is saved.")}
        </div>
      )}
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
