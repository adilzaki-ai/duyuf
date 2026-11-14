import type { RafeeqLang } from "./help";
import type { RafeeqPage } from "./source";
import { RING_DAYS, visaState } from "./visaDays";
import { say } from "./words";
import r from "./rafeeq.module.css";

/** "20 December 2026 · 29 Jumada II 1448": the Gregorian day and the Umm al-Qura date beside it. */
export function bothDates(iso: string, lang: RafeeqLang): string {
  const at = new Date(`${iso}T12:00:00+03:00`);
  try {
    const g = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(at);
    const h = new Intl.DateTimeFormat(`${lang}-u-ca-islamic-umalqura-nu-latn`, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(at);
    return `${g} · ${h}`;
  } catch {
    return iso;
  }
}

/**
 * The visa window: the days left in a ring, the last day in both calendars,
 * and what to do. Counted on the phone, so it is right with no signal.
 */
export function VisaCard({ page, lang }: { page: RafeeqPage; lang: RafeeqLang }) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  const v = visaState(page.visa_expires_on, page.leaving_on);
  if (v.level === "none")
    return (
      <section className={`${r.visa} ${r.visaNone}`} aria-label={s("Your visa")}>
        <p className={r.visaTitle}>{s("Your visa")}</p>
        <p className={r.quiet}>{s("Your visa date is not on file. Ask your group leader.")}</p>
      </section>
    );
  const days = v.days ?? 0;
  const fraction = Math.max(0, Math.min(1, days / RING_DAYS));
  const R = 34;
  const C = 2 * Math.PI * R;
  const big = v.level === "ended" ? "!" : String(days);
  const unit = v.level === "ended" ? s("Ended") : days === 0 ? s("Ends today") : days === 1 ? s("day left") : s("days left");
  const tone = { ok: r.visaOk, soon: r.visaSoon, urgent: r.visaUrgent, ended: r.visaEnded }[v.level];
  const line =
    v.level === "ended"
      ? s("Your visa has ended. Call your group leader now.")
      : v.level === "urgent"
        ? s("Your visa ends very soon. Make sure you leave in time.")
        : v.level === "soon"
          ? s("Your visa ends soon. Check your flight home.")
          : s("Leave the Kingdom before your visa ends.");
  return (
    <section className={`${r.visa} ${tone}`} aria-label={s("Your visa")} role={v.level === "ended" || v.level === "urgent" ? "alert" : undefined}>
      <svg className={r.visaRing} viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r={R} className={r.visaTrack} />
        <circle
          cx="40"
          cy="40"
          r={R}
          className={r.visaArc}
          strokeDasharray={`${C * fraction} ${C}`}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="47" textAnchor="middle" className={r.visaNumber}>
          {big}
        </text>
      </svg>
      <div className={r.visaWords}>
        <p className={r.visaTitle}>
          {s("Your visa")} · <b>{unit}</b>
        </p>
        <p className={r.visaDate}>{s("Valid until {date}", { date: bothDates(page.visa_expires_on!, lang) })}</p>
        <p className={r.visaLine}>{line}</p>
        {v.leavesAfter && page.leaving_on && v.level !== "ended" && (
          <p className={r.visaWarn}>{s("Your group leaves on {date}, after your visa ends. Talk to your group leader.", { date: bothDates(page.leaving_on, lang) })}</p>
        )}
      </div>
    </section>
  );
}
