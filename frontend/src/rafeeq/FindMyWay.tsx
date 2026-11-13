import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { RafeeqLang } from "./help";
import { distanceText, heading, metres, SITES, walkingLink, type Point } from "./places";
import type { RafeeqPage } from "./source";
import { say } from "./words";
import r from "./rafeeq.module.css";

const WayMap = lazy(() => import("./WayMap"));

interface Destination {
  key: string;
  title: string;
  sub?: string;
  point: Point;
}

/**
 * "I am lost" opens this first: where they are, and the way to their group,
 * its meeting point, or a holy site, with walking directions in the phone's
 * maps app. Their place is used on this phone only; nothing is sent unless
 * they agreed to share it. Calling for help stays one press away.
 */
export function FindMyWay({ page, lang, onStillLost, onBack, stand = null }: {
  page: RafeeqPage; lang: RafeeqLang; onStillLost: () => void; onBack: () => void;
  /** the sample's pretend place, used only when the phone gives none */
  stand?: Point | null;
}) {
  const [found, setMe] = useState<Point | null>(null);
  const [finding, setFinding] = useState(() => !!globalThis.isSecureContext && !!globalThis.navigator?.geolocation);
  useEffect(() => {
    if (!finding) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setMe({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setFinding(false),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [finding]);
  const me = found ?? (finding ? null : stand);

  const places = useMemo(() => {
    const out: Destination[] = [];
    if (page.group_now)
      out.push({
        key: "group",
        title: say("Where most of your group is now", lang),
        sub: say("{n} people", lang, { n: page.group_now.count }),
        point: page.group_now,
      });
    if (page.meeting) out.push({ key: "meeting", title: say("Meeting point", lang), sub: page.meeting.name, point: page.meeting });
    const near = me ? SITES.filter((s) => metres(me, s) < 40_000) : SITES;
    const sites = [...(near.length ? near : SITES)].sort((a, b) => (me ? metres(me, a) - metres(me, b) : 0));
    for (const s of sites) out.push({ key: s.id, title: s.name[lang], point: s });
    return out;
  }, [page.group_now, page.meeting, me, lang]);

  const [chosen, setChosen] = useState<string | null>(null);
  const dest = places.find((p) => p.key === chosen) ?? places[0];
  const away = me && dest ? metres(me, dest.point) : null;

  return (
    <section className={r.way} aria-labelledby="rafeeq-way">
      <h2 id="rafeeq-way">{say("Find my way", lang)}</h2>
      {finding && !me && <p className={r.quiet}>{say("Finding where you are…", lang)}</p>}
      {!finding && !found && !stand && <p className={r.quiet}>{say("Your phone did not give your place. Choose where to go, and follow the directions.", lang)}</p>}

      <p className={r.lead}>{say("Where do you want to go?", lang)}</p>
      {!page.group_now && <p className={r.quiet}>{say("Your group is not sharing where they are right now.", lang)}</p>}
      <div className={r.destinations} role="group" aria-label={say("Where do you want to go?", lang)}>
        {places.map((p, i) => (
          <button
            key={p.key}
            type="button"
            className={`${r.destination} ${i < (page.group_now ? 1 : 0) + (page.meeting ? 1 : 0) ? r.destinationGroup : ""}`}
            aria-pressed={dest?.key === p.key}
            onClick={() => setChosen(p.key)}
          >
            <span className={r.destTitle}>{p.title}</span>
            {(p.sub || me) && (
              <span className={r.destSub}>
                {p.sub}
                {p.sub && me ? " · " : ""}
                {me && <bdi dir="ltr">{distanceText(metres(me, p.point))}</bdi>}
              </span>
            )}
          </button>
        ))}
      </div>

      {dest && (
        <div className={r.route}>
          {away != null && (
            <p className={r.routeLine}>
              <b>{say("{d} away", lang, { d: `⁦${distanceText(away)}⁩` })}</b> {say(heading(me!, dest.point), lang)}
            </p>
          )}
          {import.meta.env.MODE !== "test" && (
            <Suspense fallback={<div className={r.map} />}>
              <WayMap
                me={me}
                to={dest.point}
                toName={dest.title}
                meName={say("You are here.", lang)}
                sites={SITES.filter((s) => s.id !== dest.key).map((s) => ({ ...s, name: s.name[lang] }))}
              />
            </Suspense>
          )}
          <a className={`${r.big} ${r.yes}`} href={walkingLink(dest.point, me)} target="_blank" rel="noreferrer">
            {say("Open walking directions", lang)}
          </a>
        </div>
      )}

      <button type="button" className={`${r.big} ${r.lost}`} onClick={onStillLost}>
        {say("I am still lost: send for help", lang)}
      </button>
      <button type="button" className={r.plain} onClick={onBack}>
        {say("Back", lang)}
      </button>
    </section>
  );
}
