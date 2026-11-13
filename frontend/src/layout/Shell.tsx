import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../app/SessionContext";
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
  const { source, me, fallbackReason } = useSession();
  const { lang, setLang } = useLang();
  const operator = lang === "ar" && me.tenant.name_ar ? me.tenant.name_ar : me.tenant.name;

  return (
    <div className={s.shell}>
      <header className={s.header}>
        <div className={s.brand}>
          <span className={s.mark} aria-hidden="true" />
          <span className={s.word}>{lang === "ar" ? "ضيوف" : "Duyuf"}</span>
          <span className={s.operator}>{operator}</span>
        </div>
        <nav className={s.nav}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? s.active : undefined)}>
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
        <div className={s.tools}>
          <span className={s.who}>{me.principal.name}</span>
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
