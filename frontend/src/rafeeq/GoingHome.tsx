import { useState } from "react";
import { AIRPORTS, calendarFile, localTime, reminders } from "./flightsHome";
import type { RafeeqLang } from "./help";
import type { RafeeqPage, ReturnLeg } from "./source";
import { say } from "./words";
import r from "./rafeeq.module.css";

/**
 * Going home: the reminder at the top of the page as the day comes, and the
 * flights home leg by leg beside the visa window, with a button that puts
 * them (and the visa's last day) in the phone's own calendar.
 */

const ltr = (s: string) => `⁦${s}⁩`;

/** The English the page passes to say() through its tables, for the words test. */
export const HOME_TABLE_LINES = [
  "Your flight home is today at {time}. Keep your passport and Rafeeq card with you.",
  "Your flight home is tomorrow at {time}. Pack tonight and keep your passport with you.",
  "Your flight home is in {n} days.",
  "Ask your group leader when the bus leaves for the airport.",
  "Your visa ends today.",
  "Your visa ends in {n} days.",
  "Flight home {flight}: {from} to {to}",
  "Last day of your visa",
];

export function ReminderBanner({ page, lang, now }: { page: RafeeqPage; lang: RafeeqLang; now?: Date }) {
  const list = reminders(page.return_legs, page.visa_expires_on, now);
  if (!list.length) return null;
  const top = list[0].level;
  return (
    <section className={`${r.remind} ${top === "today" ? r.remindToday : top === "soon" ? r.remindSoon : ""}`} role={top === "info" ? "status" : "alert"}>
      <span className={r.remindIcon} aria-hidden="true">
        <PlaneIcon />
      </span>
      <ul>
        {list.map((x) => (
          <li key={x.line}>{say(x.line, lang, x.vars && Object.fromEntries(Object.entries(x.vars).map(([k, v]) => [k, typeof v === "string" ? ltr(v) : v])))}</li>
        ))}
      </ul>
    </section>
  );
}

export function FlightsHome({ page, lang }: { page: RafeeqPage; lang: RafeeqLang }) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  const legs = page.return_legs ?? [];
  const [saved, setSaved] = useState<"yes" | "no" | null>(null);
  if (!legs.length)
    return (
      <section className={r.flights} aria-label={s("Your flights home")}>
        <p className={r.visaTitle}>{s("Your flights home")}</p>
        <p className={r.quiet}>{s("Your flights home are not on file yet. Ask your group leader.")}</p>
      </section>
    );
  const gone = Date.parse(legs[legs.length - 1].departs_at) < Date.now();
  const download = () => {
    const text = calendarFile(legs, page.visa_expires_on, {
      flight: (l: ReturnLeg) => s("Flight home {flight}: {from} to {to}", { flight: l.flight_number, from: l.from_airport, to: l.to_airport }),
      visa: s("Last day of your visa"),
    });
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "rafeeq-flights-home.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setSaved("yes");
    } catch {
      setSaved("no");
    }
  };
  return (
    <section className={r.flights} aria-label={s("Your flights home")}>
      <p className={r.visaTitle}>{s("Your flights home")}</p>
      <ol className={r.legs}>
        {legs.map((l) => {
          const dep = localTime(l.departs_at, l.from_airport, lang);
          const arr = l.arrives_at ? localTime(l.arrives_at, l.to_airport, lang) : null;
          return (
            <li key={l.seq} className={r.leg2}>
              <span className={r.legRoute} dir="ltr">
                <b>{l.from_airport}</b>
                <i aria-hidden="true">✈</i>
                <b>{l.to_airport}</b>
              </span>
              <span className={r.legWords}>
                <span className={r.legFlight} dir="ltr">
                  {l.flight_number}
                </span>
                <span>
                  {s("Leaves {day} at {time}", { day: dep.day, time: ltr(dep.time) })}
                  {dep.saudi && <small> · {s("Saudi time")}</small>}
                </span>
                {arr && (
                  <small className={r.quiet}>
                    {s("Lands {day} at {time}, local time in {city}", { day: arr.day, time: ltr(arr.time), city: AIRPORTS[l.to_airport]?.city ?? l.to_airport })}
                  </small>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {!gone && (
        <button type="button" className={r.plain} onClick={download}>
          {s("Add reminders to my calendar")}
        </button>
      )}
      {saved === "yes" && <p className={r.quiet}>{s("Open the file to add the reminders to your calendar.")}</p>}
      {saved === "no" && <p className={r.quiet}>{s("This phone could not save the file. Rafeeq still reminds you here.")}</p>}
    </section>
  );
}

const PlaneIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M29 15.2c0-1-.9-1.7-2-1.7h-7.3L12.6 3.5h-3l3.5 10H6.4L4 10.3H1.8l1.7 5.7-1.7 5.7H4l2.4-3.2h6.7l-3.5 10h3l7.1-10H27c1.1 0 2-.8 2-1.8z" fill="currentColor" />
  </svg>
);
