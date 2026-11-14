import { useEffect, useMemo, useState } from "react";
import { CREDITS, photoOf } from "./guide/photos";
import { GUIDE_LOADERS, siteById, TRIP_SITES, type City, type Guide, type SiteId, type TripSite } from "./guide/sites";
import type { RafeeqLang } from "./help";
import { distanceText, metres } from "./places";
import { dayRouteLink, directionsLink, HOME, loadPlan, makePlan, savePlan, START_TIMES, suggested, type Plan, type StartTime } from "./planner";
import type { Venue } from "./source";
import type { WeatherReport } from "./weatherRules";
import { say } from "./words";
import r from "./rafeeq.module.css";

/**
 * Visit the sites: a guide to the holy and historic places of Makkah and
 * Madinah, with a photo of each, and a plan for the day made from the ones the
 * pilgrim picks. The plan keeps outdoor places for the cool hours using the
 * weather report, and lives on the phone only.
 */

type Screen = { name: "list" } | { name: "site"; id: SiteId } | { name: "plan" };

const KIND_WORD: Record<TripSite["kind"], string> = {
  mosque: "Mosque",
  hajj: "Hajj site",
  landmark: "Landmark",
  cemetery: "Cemetery",
  museum: "Museum",
};
const START_WORD: Record<StartTime, string> = { "06:30": "Early morning", "08:00": "Morning", "16:00": "Afternoon and evening" };
/** The English the trips page passes to say() through its tables, for the words test. */
export const TRIPS_TABLE_LINES = [
  ...Object.values(KIND_WORD),
  ...Object.values(START_WORD),
  "Makkah",
  "Madinah",
  "{d} from the Haram",
  "{d} from the Prophet's Mosque",
  "Starts from the Haram. Times are estimates.",
  "Starts from the Prophet's Mosque. Times are estimates.",
];

const ltr = (s: string) => `⁦${s}⁩`;

function useGuide(lang: RafeeqLang): { guide: Guide | null; english: Guide | null } {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [english, setEnglish] = useState<Guide | null>(null);
  useEffect(() => {
    let live = true;
    void GUIDE_LOADERS[lang]().then((g) => live && setGuide(g));
    void GUIDE_LOADERS.en().then((g) => live && setEnglish(g));
    return () => {
      live = false;
    };
  }, [lang]);
  return { guide, english };
}

export function Trips({
  lang,
  first,
  weather,
  onBack,
  speak,
  attractions = [],
  onBook,
}: {
  lang: RafeeqLang;
  first: City;
  weather: WeatherReport | null;
  onBack: () => void;
  speak: ((t: string) => void) | null;
  /** the places that take a booking through the operator, by guide site */
  attractions?: Venue[];
  onBook?: (venueId: string) => void;
}) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  const [city, setCity] = useState<City>(first);
  const [screen, setScreen] = useState<Screen>(() => (loadPlan(first) ? { name: "plan" } : { name: "list" }));
  const [plan, setPlanState] = useState<Plan | null>(() => loadPlan(first));
  const [picks, setPicks] = useState<SiteId[]>(() => loadPlan(first)?.picks ?? []);
  const [days, setDays] = useState(1);
  const [start, setStart] = useState<StartTime>("06:30");
  const { guide } = useGuide(lang);

  const setPlan = (p: Plan | null) => {
    savePlan(city, p);
    setPlanState(p);
  };
  const switchCity = (c: City) => {
    setCity(c);
    const p = loadPlan(c);
    setPlanState(p);
    setPicks(p?.picks ?? []);
    setScreen(p ? { name: "plan" } : { name: "list" });
  };
  const toggle = (id: SiteId) => setPicks((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  const hours = weather?.cities[city]?.hours ?? null;
  const build = (ids: SiteId[]) => {
    const stops = makePlan(ids, city, { days, start, hours });
    setPicks(ids);
    setPlan({ city, days, start, picks: ids, stops, visited: plan?.visited.filter((v) => ids.includes(v)) ?? [], made_at: new Date().toISOString() });
    setScreen({ name: "plan" });
    globalThis.scrollTo?.({ top: 0 });
  };

  const sites = TRIP_SITES.filter((x) => x.city === city);
  const name = (id: SiteId) => guide?.[id]?.name ?? id;

  if (screen.name === "site") {
    const site = siteById(screen.id)!;
    return (
      <SiteDetail
        site={site}
        lang={lang}
        guide={guide}
        picked={picks.includes(site.id)}
        onPick={() => toggle(site.id)}
        onBack={() => setScreen({ name: "list" })}
        speak={speak}
        bookable={attractions.find((v) => v.site_id === site.id && v.bookable) ?? null}
        onBook={onBook}
      />
    );
  }

  return (
    <section className={r.trips}>
      <h2>{s("Holy Sites & Attractions")}</h2>
      <div className={r.seg} role="group" aria-label={s("City")}>
        {(["makkah", "madinah"] as City[]).map((c) => (
          <button key={c} type="button" aria-pressed={city === c} onClick={() => switchCity(c)}>
            {s(c === "makkah" ? "Makkah" : "Madinah")}
          </button>
        ))}
      </div>
      <p className={r.quiet}>{s("Visiting these places is optional. It is not part of Hajj or Umrah.")}</p>

      {plan && plan.stops.length > 0 && (
        <div className={r.seg} role="group" aria-label={s("Holy Sites & Attractions")}>
          <button type="button" aria-pressed={screen.name === "plan"} onClick={() => setScreen({ name: "plan" })}>
            {s("My plan")}
          </button>
          <button type="button" aria-pressed={screen.name === "list"} onClick={() => setScreen({ name: "list" })}>
            {s("All places")}
          </button>
        </div>
      )}

      {screen.name === "plan" && plan ? (
        <PlanView
          plan={plan}
          lang={lang}
          name={name}
          onVisited={(id) =>
            setPlan({ ...plan, visited: plan.visited.includes(id) ? plan.visited.filter((v) => v !== id) : [...plan.visited, id] })
          }
          onOpen={(id) => setScreen({ name: "site", id })}
          onChange={() => setScreen({ name: "list" })}
          onClear={() => {
            setPlan(null);
            setPicks([]);
            setScreen({ name: "list" });
          }}
        />
      ) : (
        <>
          <section className={r.planner}>
            <h3>{s("Make a plan")}</h3>
            <p className={r.quiet}>{s("Tap + on the places you want. Rafeeq puts them in a good order.")}</p>
            <label className={r.plannerRow}>
              <span>{s("How many days?")}</span>
              <span className={r.segSmall}>
                {[1, 2].map((d) => (
                  <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
                    {d === 1 ? s("1 day") : s("2 days")}
                  </button>
                ))}
              </span>
            </label>
            <label className={r.plannerRow}>
              <span>{s("When do you start?")}</span>
              <select className={r.select} value={start} onChange={(e) => setStart(e.target.value as StartTime)}>
                {START_TIMES.map((t) => (
                  <option key={t} value={t}>
                    {s(START_WORD[t])} ({t})
                  </option>
                ))}
              </select>
            </label>
            <div className={r.twoButtons}>
              <button type="button" className={`${r.big} ${r.yes}`} disabled={picks.length === 0} onClick={() => build(picks)}>
                {picks.length ? s("Make my plan ({n} places)", { n: picks.length }) : s("Pick places below")}
              </button>
              <button
                type="button"
                className={r.plain}
                onClick={() => {
                  /* only what fits in the days chosen: a suggestion should not come back overfull */
                  const fit = makePlan(suggested(city), city, { days, start, hours }).filter((x) => !x.over);
                  build(fit.map((x) => x.id));
                }}
              >
                {s("Suggest a plan for me")}
              </button>
            </div>
          </section>

          <ul className={r.siteList}>
            {sites.map((x) => (
              <li key={x.id} className={r.siteCard}>
                <button type="button" className={r.siteOpen} onClick={() => setScreen({ name: "site", id: x.id })}>
                  <Photo id={x.id} alt={name(x.id)} className={r.sitePhoto} />
                  <span className={r.siteWords}>
                    <b>{name(x.id)}</b>
                    <span>{guide?.[x.id]?.summary}</span>
                    <Chips site={x} lang={lang} />
                  </span>
                </button>
                <button
                  type="button"
                  className={r.pick}
                  aria-pressed={picks.includes(x.id)}
                  aria-label={picks.includes(x.id) ? s("Remove from my plan") : s("Add to my plan")}
                  onClick={() => toggle(x.id)}
                >
                  {picks.includes(x.id) ? "✓" : "+"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className={r.plain} onClick={onBack}>
        {s("Back")}
      </button>
    </section>
  );
}

function Chips({ site, lang }: { site: TripSite; lang: RafeeqLang }) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  return (
    <span className={r.chips}>
      <span className={r.chip}>{s(KIND_WORD[site.kind])}</span>
      <span className={r.chip}>{s("About {n} min", { n: site.minutes })}</span>
      <span className={`${r.chip} ${site.indoor ? r.chipCool : r.chipSun}`}>{site.indoor ? s("Indoors") : s("Outdoors")}</span>
      {site.effort === "climb" && <span className={`${r.chip} ${r.chipSun}`}>{s("Steep climb")}</span>}
      {site.booking && <span className={r.chip}>{s("By appointment")}</span>}
    </span>
  );
}

export function Photo({ id, alt, className }: { id: SiteId; alt: string; className?: string }) {
  const src = photoOf(id);
  if (!src) return <span className={`${className ?? ""} ${r.photoNone}`} aria-hidden="true" />;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}

function SiteDetail({
  site,
  lang,
  guide,
  picked,
  onPick,
  onBack,
  speak,
  bookable,
  onBook,
}: {
  bookable?: Venue | null;
  onBook?: (venueId: string) => void;
  site: TripSite;
  lang: RafeeqLang;
  guide: Guide | null;
  picked: boolean;
  onPick: () => void;
  onBack: () => void;
  speak: ((t: string) => void) | null;
}) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  const text = guide?.[site.id];
  const [arabic, setArabic] = useState<string | null>(null);
  useEffect(() => {
    if (lang === "ar") return;
    let live = true;
    void GUIDE_LOADERS.ar().then((g) => live && setArabic(g[site.id].name));
    return () => {
      live = false;
    };
  }, [lang, site.id]);
  const home = siteById(HOME[site.city])!;
  const far = metres(home, site);
  const credit = CREDITS[site.id];
  const read = text ? [text.name, text.summary, text.story, s("What to see"), ...text.see, s("Good to know"), ...text.tips].join(". ") : "";
  return (
    <article className={r.siteDetail}>
      <figure className={r.hero2}>
        <Photo id={site.id} alt={text?.name ?? ""} className={r.heroPhoto} />
        {credit && (
          <figcaption className={r.credit} dir="ltr">
            {s("Photo")}: {credit.author} ·{" "}
            <a href={credit.url} target="_blank" rel="noreferrer">
              {credit.license}
            </a>
            , resized
          </figcaption>
        )}
      </figure>
      <h2>{text?.name ?? "…"}</h2>
      {arabic && (
        <p className={r.arabicName} lang="ar" dir="rtl">
          {arabic}
        </p>
      )}
      <Chips site={site} lang={lang} />
      {text && (
        <>
          <p className={r.lead}>{text.summary}</p>
          <p>{text.story}</p>
          <h3>{s("What to see")}</h3>
          <ul className={r.advice}>
            {text.see.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <h3>{s("Good to know")}</h3>
          <ul className={r.advice}>
            {text.tips.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      )}
      {site.id !== home.id && (
        <p className={r.quiet}>
          {s(site.city === "makkah" ? "{d} from the Haram" : "{d} from the Prophet's Mosque", { d: ltr(distanceText(far)) })}
        </p>
      )}
      {bookable && onBook && (
        <button type="button" className={`${r.big} ${r.go}`} onClick={() => onBook(bookable.id)}>
          {s("Book a visit")}
        </button>
      )}
      {site.id === "nabawi" && (
        <a className={`${r.big} ${r.go}`} href="https://www.nusuk.sa/" target="_blank" rel="noreferrer">
          {s("Book Al-Rawdah in the Nusuk app")}
        </a>
      )}
      <div className={r.twoButtons}>
        <button type="button" className={`${r.big} ${picked ? r.plainBig : r.yes}`} onClick={onPick}>
          {picked ? s("In my plan ✓") : s("Add to my plan")}
        </button>
        <a className={`${r.big} ${r.go}`} href={directionsLink(site, far < 1200 ? "walk" : "car")} target="_blank" rel="noreferrer">
          {s("Directions")}
        </a>
      </div>
      {speak && read && (
        <button type="button" className={r.listen} onClick={() => speak(read)}>
          {s("Listen to this place")}
        </button>
      )}
      <button type="button" className={r.plain} onClick={onBack}>
        {s("Back")}
      </button>
    </article>
  );
}

function PlanView({
  plan,
  lang,
  name,
  onVisited,
  onOpen,
  onChange,
  onClear,
}: {
  plan: Plan;
  lang: RafeeqLang;
  name: (id: SiteId) => string;
  onVisited: (id: SiteId) => void;
  onOpen: (id: SiteId) => void;
  onChange: () => void;
  onClear: () => void;
}) {
  const s = (en: string, vars?: Record<string, string | number>) => say(en, lang, vars);
  const byDay = useMemo(() => {
    const m = new Map<number, Plan["stops"]>();
    for (const x of plan.stops) m.set(x.day, [...(m.get(x.day) ?? []), x]);
    return [...m.entries()];
  }, [plan.stops]);
  const home = siteById(HOME[plan.city])!;
  const anyHot = plan.stops.some((x) => x.hot);
  const done = plan.visited.length;
  return (
    <section className={r.plan}>
      <p className={r.planHead}>
        <b>{s("My plan")}</b> · {s("{done} of {n} visited", { done, n: plan.stops.length })}
      </p>
      <p className={r.quiet}>{s(plan.city === "makkah" ? "Starts from the Haram. Times are estimates." : "Starts from the Prophet's Mosque. Times are estimates.")}</p>
      {plan.stops.some((x) => x.over) && (
        <p className={r.warning}>{plan.days === 1 ? s("Too many places for one day. Choose 2 days or fewer places.") : s("Too many places for two days. Choose fewer places.")}</p>
      )}
      {anyHot && <p className={r.warning}>{s("Some outdoor places fall in hot hours. Take water and an umbrella, or start earlier.")}</p>}
      {byDay.map(([day, stops]) => (
        <div key={day} className={r.planDay}>
          {plan.days > 1 && <h3>{s("Day {n}", { n: day })}</h3>}
          <ol className={r.timeline}>
            {stops.map((x) => {
              const site = siteById(x.id)!;
              const seen = plan.visited.includes(x.id);
              return (
                <li key={x.id} className={`${r.stop} ${seen ? r.stopDone : ""}`}>
                  <p className={r.leg}>
                    {x.mode === "walk" ? s("{n} min walk", { n: x.travel_min }) : s("{n} min by car", { n: x.travel_min })}
                  </p>
                  <div className={r.stopRow}>
                    <span className={r.stopTime}>{ltr(x.arrive)}</span>
                    <button type="button" className={r.stopMain} onClick={() => onOpen(x.id)}>
                      <Photo id={x.id} alt="" className={r.stopPhoto} />
                      <span>
                        <b>{name(x.id)}</b>
                        <small>
                          {ltr(`${x.arrive}–${x.leave}`)}
                          {x.hot && ` · ${s("Hot then")}`}
                          {site.booking && ` · ${s("By appointment")}`}
                        </small>
                      </span>
                    </button>
                  </div>
                  <div className={r.stopActions}>
                    <a className={r.plain} href={directionsLink(site, x.mode)} target="_blank" rel="noreferrer">
                      {s("Directions")}
                    </a>
                    <button type="button" className={r.plain} aria-pressed={seen} onClick={() => onVisited(x.id)}>
                      {seen ? s("Visited ✓") : s("Mark visited")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {stops.length > 1 && (
            <a className={`${r.big} ${r.go}`} href={dayRouteLink(stops, home)} target="_blank" rel="noreferrer">
              {plan.days > 1 ? s("Open day {n} in Maps", { n: day }) : s("Open the whole route in Maps")}
            </a>
          )}
        </div>
      ))}
      <div className={r.twoButtons}>
        <button type="button" className={r.plain} onClick={onChange}>
          {s("Change places")}
        </button>
        <button type="button" className={r.plain} onClick={onClear}>
          {s("Delete plan")}
        </button>
      </div>
    </section>
  );
}

