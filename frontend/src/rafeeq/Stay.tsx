import { useCallback, useEffect, useMemo, useState } from "react";
import { DataSourceError } from "../api/dataSource";
import type { City } from "./guide/sites";
import type { RafeeqLang } from "./help";
import { distanceText, metres } from "./places";
import type {
  Booking,
  NewBooking,
  Payments,
  RafeeqSource,
  Venue,
} from "./source";
import {
  ACCESS,
  ACCESS_LABEL,
  BED_LABEL,
  BEDS,
  EXTRA_LABEL,
  EXTRAS,
  HAS_BED_CHOICE,
  ROOM_LABEL,
  ROOM_LINES,
  ROOM_TYPES,
  SLEEPS,
  type Access,
  type Bed,
  type Extra,
  type RoomType,
} from "./rooms";
import { picturesOf, roomPicture, type Picture } from "./venuePhotos";
import { saudiToday } from "./visaDays";
import { say } from "./words";
import r from "./rafeeq.module.css";

/**
 * Food and hotels: the restaurants (simple to upscale) and hotels (2 to 5
 * stars, the official scale) the operator offers in Makkah and Madinah, with
 * their ratings and where each rating comes from; a way to call, message or
 * book; and the pilgrim's own bookings, paid online where the operator can
 * take payment. A request goes to the operator's staff, who check with the
 * place and answer here.
 */

type Tab = "restaurant" | "hotel" | "mine";
type Screen =
  | { name: "list" }
  | { name: "venue"; id: string }
  | { name: "book"; id: string }
  | { name: "pay"; id: string };
type Sort = "rating" | "near" | "price";

const MOSQUE: Record<City, { lat: number; lon: number }> = {
  makkah: { lat: 21.4225, lon: 39.8262 },
  madinah: { lat: 24.4672, lon: 39.6111 },
};
const PRICE_WORD = ["", "Simple", "Casual", "Fine dining", "Upscale"];
const STATUS_WORD: Record<Booking["status"], string> = {
  requested: "Waiting for an answer",
  awaiting_payment: "Pay to confirm",
  confirmed: "Confirmed",
  declined: "Not available",
  cancelled: "Cancelled",
};
const SORT_WORD: Record<Sort, string> = {
  rating: "Best rated",
  near: "Nearest",
  price: "Lowest price",
};
/** The English the page passes to say() through its tables, for the words test. */
export const STAY_TABLE_LINES = ["Example photo", 
  ...ROOM_LINES,
  ...PRICE_WORD.filter(Boolean),
  ...Object.values(STATUS_WORD),
  ...Object.values(SORT_WORD),
  "1 night",
  "{n} nights",
  "1 person",
  "{n} people",
];

const ltr = (s: string) => `⁦${s}⁩`;
const sar = (n: number) => ltr(`${Math.round(n).toLocaleString("en-US")} SAR`);
const POLL_MS = 5_000;

function problem(err: unknown): string {
  return err instanceof DataSourceError ? err.message : String(err);
}

export function Stay({
  source,
  lang,
  first,
  open,
  onBack,
}: {
  source: RafeeqSource;
  lang: RafeeqLang;
  first: City;
  /** start on this place's booking form (an attraction from Visit the sites) */
  open?: string | null;
  onBack: () => void;
}) {
  const s = (en: string, vars?: Record<string, string | number>) =>
    say(en, lang, vars);
  const [tab, setTab] = useState<Tab>("restaurant");
  const [city, setCity] = useState<City>(first);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [payments, setPayments] = useState<Payments>({ online: null });
  const [mine, setMine] = useState<Booking[]>([]);
  const [screen, setScreen] = useState<Screen>(
    open ? { name: "book", id: open } : { name: "list" },
  );
  const [failed, setFailed] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [stars, setStars] = useState<number[]>([]);
  const [levels, setLevels] = useState<number[]>([]);
  const [wheelchair, setWheelchair] = useState(false);
  const [sort, setSort] = useState<Sort>("rating");

  const took = (x: { bookings: Booking[]; payments: Payments }) => {
    setMine(x.bookings);
    setPayments(x.payments);
  };

  useEffect(() => {
    let live = true;
    Promise.all([source.venues(), source.bookings()]).then(
      ([v, b]) => {
        if (!live) return;
        setVenues(v.venues);
        took(b);
      },
      (err) => live && setFailed(problem(err)),
    );
    return () => {
      live = false;
    };
  }, [source]);

  /* while a request waits for an answer, look for it */
  const waiting = mine.some((b) => b.status === "requested");
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(
      () => source.bookings().then(took, () => {}),
      POLL_MS,
    );
    return () => clearInterval(t);
  }, [source, waiting]);

  const venue = (id: string) => venues?.find((v) => v.id === id) ?? null;
  const open_ = mine.filter(
    (b) =>
      b.status === "requested" ||
      b.status === "awaiting_payment" ||
      b.status === "confirmed",
  ).length;

  if (failed && !venues)
    return (
      <section className={r.stay}>
        <h2>{s("Food and hotels")}</h2>
        <p className={r.lead}>{s("Cannot load the places just now.")}</p>
        <button type="button" className={r.plain} onClick={onBack}>
          {s("Back")}
        </button>
      </section>
    );
  if (!venues) return <p className={r.quiet}>…</p>;

  if (screen.name === "venue" || screen.name === "book") {
    const v = venue(screen.id);
    if (!v) return null;
    if (screen.name === "book")
      return (
        <BookForm
          v={v}
          lang={lang}
          sample={source.kind === "mock"}
          onBack={() =>
            setScreen(
              v.kind === "attraction" && open
                ? { name: "list" }
                : { name: "venue", id: v.id },
            )
          }
          onSend={async (b) => {
            const x = await source.book(b);
            took(x);
            setSent(
              s(
                "Request sent. The answer comes here, usually within the hour.",
              ),
            );
            setTab("mine");
            setScreen({ name: "list" });
          }}
        />
      );
    return (
      <VenueDetail
        v={v}
        lang={lang}
        sample={source.kind === "mock"}
        onBook={() => setScreen({ name: "book", id: v.id })}
        onBack={() => setScreen({ name: "list" })}
      />
    );
  }

  if (screen.name === "pay") {
    const b = mine.find((x) => x.id === screen.id);
    if (!b) return null;
    return (
      <PaySheet
        b={b}
        lang={lang}
        payments={payments}
        onBack={() => setScreen({ name: "list" })}
        onPay={async (card) => {
          took(await source.pay(b.id, card));
          setSent(s("Paid. Your booking is confirmed."));
          setScreen({ name: "list" });
        }}
      />
    );
  }

  const shown = venues
    .filter((v) => v.kind === tab && v.city === city)
    .filter((v) =>
      tab === "hotel"
        ? !stars.length || stars.includes(v.stars ?? 0)
        : !levels.length || levels.includes(v.price_level ?? 0),
    )
    .filter(
      (v) =>
        tab !== "hotel" ||
        !wheelchair ||
        !!v.accessibility?.includes("wheelchair_room"),
    )
    .sort((a, b) => {
      if (
        sort === "near" &&
        a.lat != null &&
        a.lon != null &&
        b.lat != null &&
        b.lon != null
      )
        return (
          metres(MOSQUE[city], { lat: a.lat, lon: a.lon }) -
          metres(MOSQUE[city], { lat: b.lat, lon: b.lon })
        );
      if (sort === "price")
        return (a.price_from ?? 1e9) - (b.price_from ?? 1e9);
      return (b.rating ?? 0) - (a.rating ?? 0);
    });
  const sample = venues.some((v) => v.rating_source === "Sample");

  return (
    <section className={r.stay}>
      <h2>{s("Food and hotels")}</h2>
      <div className={r.seg} role="group" aria-label={s("Food and hotels")}>
        {(["restaurant", "hotel", "mine"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "restaurant" ? (
              <>
                <span aria-hidden="true">🍽 </span>
                {s("Restaurants")}
              </>
            ) : t === "hotel" ? (
              <>
                <span aria-hidden="true">🏨 </span>
                {s("Hotels")}
              </>
            ) : (
              `${s("My bookings")}${open_ ? ` (${open_})` : ""}`
            )}
          </button>
        ))}
      </div>
      {sent && (
        <p className={r.done} role="status">
          {sent}
        </p>
      )}
      {tab === "mine" ? (
        <MyBookings
          list={mine}
          lang={lang}
          payments={payments}
          sample={source.kind === "mock"}
          onPay={(id) => {
            setSent(null);
            setScreen({ name: "pay", id });
          }}
          onCancel={async (id) => {
            try {
              took(await source.cancelBooking(id));
              setSent(s("Your booking is cancelled."));
            } catch (err) {
              setSent(problem(err));
            }
          }}
        />
      ) : (
        <>
          <div className={r.seg} role="group" aria-label={s("City")}>
            {(["makkah", "madinah"] as City[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={city === c}
                onClick={() => setCity(c)}
              >
                {s(c === "makkah" ? "Makkah" : "Madinah")}
              </button>
            ))}
          </div>
          <div className={r.filters}>
            {tab === "hotel"
              ? [2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={r.filter}
                    aria-pressed={stars.includes(n)}
                    onClick={() =>
                      setStars((xs) =>
                        xs.includes(n) ? xs.filter((x) => x !== n) : [...xs, n],
                      )
                    }
                  >
                    {ltr(`${n}★`)}
                  </button>
                ))
              : [1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={r.filter}
                    aria-pressed={levels.includes(n)}
                    onClick={() =>
                      setLevels((xs) =>
                        xs.includes(n) ? xs.filter((x) => x !== n) : [...xs, n],
                      )
                    }
                  >
                    {s(PRICE_WORD[n])}
                  </button>
                ))}
            {tab === "hotel" && (
              <button
                type="button"
                className={r.filter}
                aria-pressed={wheelchair}
                onClick={() => setWheelchair((x) => !x)}
              >
                <span aria-hidden="true">♿ </span>
                {s("Wheelchair rooms")}
              </button>
            )}
            <select
              className={r.select}
              aria-label={s("Sort")}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              {(Object.keys(SORT_WORD) as Sort[]).map((k) => (
                <option key={k} value={k}>
                  {s(SORT_WORD[k])}
                </option>
              ))}
            </select>
          </div>
          {sample && (
            <p className={r.quiet}>
              {s("Sample places: the names and ratings are invented.")}
            </p>
          )}
          {tab === "hotel" && (
            <p className={r.quiet}>
              {s("Stars are the official Saudi hotel rating, up to 5.")}
            </p>
          )}
          {shown.length === 0 ? (
            <p className={r.lead}>{s("No places match. Try fewer filters.")}</p>
          ) : (
            <ul className={r.venueList}>
              {shown.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className={r.venueCard}
                    onClick={() => setScreen({ name: "venue", id: v.id })}
                  >
                    <CardPhoto v={v} lang={lang} />
                    <VenueHead v={v} lang={lang} city={city} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <button type="button" className={r.plain} onClick={onBack}>
        {s("Back")}
      </button>
    </section>
  );
}

/** The place's main picture on its card; an example photo says so. */
function CardPhoto({ v, lang }: { v: Venue; lang: RafeeqLang }) {
  const first = picturesOf(v)[0];
  if (!first) return null;
  return (
    <span className={r.cardPhoto}>
      <img src={first.src} alt="" loading="lazy" decoding="async" />
      {first.example && <span className={r.exampleTag}>{say("Example photo", lang)}</span>}
    </span>
  );
}

/** The place's pictures, swiped sideways, with who took each example photo. */
function Gallery({ pictures, lang, name }: { pictures: Picture[]; lang: RafeeqLang; name: string }) {
  const [at, setAt] = useState(0);
  if (!pictures.length) return null;
  const now = pictures[Math.min(at, pictures.length - 1)];
  return (
    <figure className={r.gallery}>
      <div
        className={r.galleryTrack}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        }}
      >
        {pictures.map((p, i) => (
          <img key={p.src} src={p.src} alt={i === 0 ? name : ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
        ))}
      </div>
      {pictures.length > 1 && (
        <span className={r.galleryCount} dir="ltr">
          {at + 1} / {pictures.length}
        </span>
      )}
      {now.example && (
        <figcaption className={r.credit} dir="ltr">
          {say("Example photo", lang)}
          {now.credit && (
            <>
              {" · "}
              {now.credit.author} ·{" "}
              <a href={now.credit.url} target="_blank" rel="noreferrer">
                {now.credit.license}
              </a>
              , resized
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className={r.stars} aria-hidden="true" dir="ltr">
      {"★".repeat(n)}
      <span className={r.starsOff}>{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

function VenueHead({
  v,
  lang,
  city,
}: {
  v: Venue;
  lang: RafeeqLang;
  city: City;
}) {
  const s = (en: string, vars?: Record<string, string | number>) =>
    say(en, lang, vars);
  const far =
    v.lat != null && v.lon != null
      ? metres(MOSQUE[city], { lat: v.lat, lon: v.lon })
      : null;
  const rtl = lang === "ar" || lang === "ur";
  return (
    <span className={r.venueHead}>
      <span className={r.venueIcon} aria-hidden="true">
        {v.kind === "hotel" ? "🏨" : v.kind === "restaurant" ? "🍽" : "🏛"}
      </span>
      <span className={r.venueWords}>
        <b dir="auto">{rtl && v.name_ar ? v.name_ar : v.name}</b>
        {v.kind === "hotel" && v.stars && (
          <span>
            <Stars n={v.stars} />{" "}
            <span className={r.srOnly}>{s("{n} stars", { n: v.stars })}</span>
            {v.accessibility?.includes("wheelchair_room") && (
              <span
                className={r.wcBadge}
                title={s("Wheelchair-accessible room")}
              >
                ♿
                <span className={r.srOnly}>
                  {s("Wheelchair-accessible room")}
                </span>
              </span>
            )}
          </span>
        )}
        {v.kind === "restaurant" && (
          <span className={r.quiet}>
            {v.price_level ? s(PRICE_WORD[v.price_level]) : ""}
            {v.cuisine ? (
              <>
                {" · "}
                <bdi>{v.cuisine}</bdi>
              </>
            ) : null}
          </span>
        )}
        {v.rating != null && (
          <span className={r.rating}>
            <b>{ltr(v.rating.toFixed(1))}</b> ★{" "}
            {v.rating_count ? (
              <span className={r.quiet}>
                ({ltr(v.rating_count.toLocaleString("en-US"))})
              </span>
            ) : null}
            <small className={r.quiet}>
              {" "}
              · {s("Rating: {source}", { source: ltr(v.rating_source ?? "") })}
            </small>
          </span>
        )}
        <span className={r.quiet}>
          {far != null &&
            s(
              city === "makkah"
                ? "{d} from the Haram"
                : "{d} from the Prophet's Mosque",
              { d: ltr(distanceText(far)) },
            )}
          {v.price_from != null && v.kind === "hotel" && (
            <> · {s("From {price} a night", { price: sar(v.price_from) })}</>
          )}
          {v.price_from != null && v.kind !== "hotel" && (
            <> · {s("About {price} a person", { price: sar(v.price_from) })}</>
          )}
        </span>
      </span>
    </span>
  );
}

function VenueDetail({
  v,
  lang,
  sample,
  onBook,
  onBack,
}: {
  v: Venue;
  lang: RafeeqLang;
  sample: boolean;
  onBook: () => void;
  onBack: () => void;
}) {
  const s = (en: string, vars?: Record<string, string | number>) =>
    say(en, lang, vars);
  const wa = v.whatsapp?.replace(/[^\d]/g, "");
  const msg = encodeURIComponent(
    `Assalamu alaikum. I would like to book. / السلام عليكم، أرغب في الحجز.`,
  );
  return (
    <article className={r.stay}>
      <Gallery pictures={picturesOf(v)} lang={lang} name={v.name} />
      <div className={r.venueTop}>
        <VenueHead v={v} lang={lang} city={v.city} />
      </div>
      {v.address && (
        <p className={r.quiet} dir="auto">
          {v.address}
        </p>
      )}
      {v.kind === "hotel" && (
        <section className={r.venueFacts}>
          <h3>{s("Rooms")}</h3>
          <p>
            {(v.room_types?.length ? v.room_types : [...ROOM_TYPES])
              .map((x) => s(ROOM_LABEL[x]))
              .join(lang === "ar" || lang === "ur" ? "، " : ", ")}
          </p>
          <h3>
            <span aria-hidden="true">♿ </span>
            {s("Accessibility")}
          </h3>
          {v.accessibility?.length ? (
            <ul className={r.accessList}>
              {v.accessibility.map((a) => (
                <li key={a}>{s(ACCESS_LABEL[a])}</li>
              ))}
            </ul>
          ) : (
            <p className={r.quiet}>
              {s(
                "This hotel lists no accessibility. Write what you need in your request.",
              )}
            </p>
          )}
        </section>
      )}
      {v.bookable && (
        <button type="button" className={`${r.big} ${r.yes}`} onClick={onBook}>
          {v.kind === "hotel"
            ? s("Book a room")
            : v.kind === "restaurant"
              ? s("Book a table")
              : s("Book a visit")}
        </button>
      )}
      <div className={r.contact}>
        {v.phone && (
          <a className={r.plain} href={`tel:${v.phone.replace(/[^\d+]/g, "")}`}>
            {s("Call")}
          </a>
        )}
        {wa && (
          <a
            className={r.plain}
            href={`https://wa.me/${wa}?text=${msg}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        )}
        {v.email && (
          <a
            className={r.plain}
            href={`mailto:${v.email}?subject=${encodeURIComponent("Booking / حجز")}&body=${msg}`}
          >
            {s("Email")}
          </a>
        )}
        {v.website && (
          <a
            className={r.plain}
            href={v.website}
            target="_blank"
            rel="noreferrer"
          >
            {s("Website")}
          </a>
        )}
        {v.lat != null && v.lon != null && (
          <a
            className={r.plain}
            href={`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lon}`}
            target="_blank"
            rel="noreferrer"
          >
            {s("Directions")}
          </a>
        )}
      </div>
      {sample && !v.phone && (
        <p className={r.quiet}>
          {s(
            "Sample: no real phone numbers. In the real app you can call or message the place.",
          )}
        </p>
      )}
      <button type="button" className={r.plain} onClick={onBack}>
        {s("Back")}
      </button>
    </article>
  );
}

function BookForm({
  v,
  lang,
  sample,
  onSend,
  onBack,
}: {
  v: Venue;
  lang: RafeeqLang;
  sample: boolean;
  onSend: (b: NewBooking) => Promise<void>;
  onBack: () => void;
}) {
  const s = (en: string, vars?: Record<string, string | number>) =>
    say(en, lang, vars);
  const today = saudiToday();
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(v.kind === "restaurant" ? "20:00" : "");
  const [nights, setNights] = useState(2);
  const [people, setPeople] = useState(2);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* hotels: the room */
  const hotel = v.kind === "hotel";
  const types = v.room_types?.length
    ? ROOM_TYPES.filter((x) => v.room_types!.includes(x))
    : [...ROOM_TYPES];
  const [roomType, setRoomType] = useState<RoomType>(
    types.includes("double") ? "double" : types[0],
  );
  const [rooms, setRooms] = useState(1);
  const [bed, setBed] = useState<Bed | null>(null);
  const [needs, setNeeds] = useState<Access[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const sleeps = rooms * SLEEPS[roomType];
  const fits = !hotel || sleeps >= people;
  const toggle = <T,>(xs: T[], x: T) =>
    xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSend({
        venue_id: v.id,
        for_date: date,
        at_time: time || null,
        nights: hotel ? nights : null,
        people,
        note: note.trim() || null,
        ...(hotel
          ? {
              rooms,
              room_type: roomType,
              bed: HAS_BED_CHOICE.includes(roomType) ? bed : null,
              access_needs: ACCESS.filter((a) => needs.includes(a)),
              extras: EXTRAS.filter((x) => extras.includes(x)),
            }
          : {}),
      });
    } catch (e) {
      setErr(problem(e));
    } finally {
      setBusy(false);
    }
  };
  const rtl = lang === "ar" || lang === "ur";
  return (
    <section className={r.stay}>
      <h2 dir="auto">{rtl && v.name_ar ? v.name_ar : v.name}</h2>
      <p className={r.quiet}>
        {s("Your group's staff check with the place and answer here.")}
      </p>
      <label className={r.field}>
        <span>{v.kind === "hotel" ? s("Arriving on") : s("Day")}</span>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {v.kind === "hotel" ? (
        <Stepper
          label={s("Nights")}
          value={nights}
          min={1}
          max={30}
          onChange={setNights}
        />
      ) : (
        <label className={r.field}>
          <span>
            {v.kind === "restaurant" ? s("Time") : s("Time (if you have one)")}
          </span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      )}
      <Stepper
        label={s("People")}
        value={people}
        min={1}
        max={50}
        onChange={setPeople}
      />
      {hotel && (
        <>
          <fieldset className={r.options}>
            <legend>{s("Room type")}</legend>
            <div className={r.roomGrid}>
              {types.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={r.roomCard}
                  aria-pressed={roomType === x}
                  onClick={() => setRoomType(x)}
                >
                  {roomPicture(x) ? (
                    <img className={r.roomPhoto} src={roomPicture(x)!.src} alt="" decoding="async" />
                  ) : (
                    <BedsPicture n={SLEEPS[x]} suite={x === "suite"} />
                  )}
                  <b>{s(ROOM_LABEL[x])}</b>
                  <small>{s("Sleeps {n}", { n: SLEEPS[x] })}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <Stepper
            label={s("Rooms")}
            value={rooms}
            min={1}
            max={20}
            onChange={setRooms}
          />
          {!fits && (
            <p className={r.warning} role="status">
              {s(
                "{rooms} rooms sleep {n}. Add a room or choose a bigger room.",
                { rooms, n: sleeps },
              )}{" "}
              <button
                type="button"
                className={r.linkButton}
                onClick={() => setRooms(Math.ceil(people / SLEEPS[roomType]))}
              >
                {s("Add rooms")}
              </button>
            </p>
          )}
          {HAS_BED_CHOICE.includes(roomType) && (
            <fieldset className={r.options}>
              <legend>{s("Bed size")}</legend>
              <div className={r.filters}>
                <button
                  type="button"
                  className={r.filter}
                  aria-pressed={bed === null}
                  onClick={() => setBed(null)}
                >
                  {s("No preference")}
                </button>
                {BEDS.filter((b) => b !== "single").map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={r.filter}
                    aria-pressed={bed === b}
                    onClick={() => setBed(b)}
                  >
                    {s(BED_LABEL[b])}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className={r.options}>
            <legend>
              <span aria-hidden="true">♿ </span>
              {s("Accessibility")}
            </legend>
            <p className={r.quiet}>
              {s(
                "Tell the hotel what you need. Staff check before they confirm.",
              )}
            </p>
            {ACCESS.map((a) => {
              const has = v.accessibility?.includes(a);
              return (
                <label key={a} className={r.check}>
                  <input
                    type="checkbox"
                    checked={needs.includes(a)}
                    onChange={() => setNeeds((xs) => toggle(xs, a))}
                  />
                  <span>
                    {s(ACCESS_LABEL[a])}
                    <small className={has ? r.has : r.quiet}>
                      {has
                        ? s("This hotel has it")
                        : s("Staff will ask the hotel")}
                    </small>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <fieldset className={r.options}>
            <legend>{s("Extras")}</legend>
            {EXTRAS.map((x) => (
              <label key={x} className={r.check}>
                <input
                  type="checkbox"
                  checked={extras.includes(x)}
                  onChange={() => setExtras((xs) => toggle(xs, x))}
                />
                <span>{s(EXTRA_LABEL[x])}</span>
              </label>
            ))}
          </fieldset>
        </>
      )}
      <label className={r.field}>
        <span>{s("Anything they should know? (optional)")}</span>
        <textarea
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          dir="auto"
        />
      </label>
      {err && (
        <p className={r.warning} role="alert" dir="auto">
          {err}
        </p>
      )}
      <button
        type="button"
        className={`${r.big} ${r.yes}`}
        disabled={busy || !fits || (v.kind === "restaurant" && !time)}
        onClick={() => void send()}
      >
        {busy ? s("Sending…") : s("Send request")}
      </button>
      {sample && (
        <p className={r.quiet}>
          {s("Sample: the operator's answer is simulated after a few seconds.")}
        </p>
      )}
      <button type="button" className={r.plain} onClick={onBack}>
        {s("Back")}
      </button>
    </section>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className={r.field}>
      <span>{label}</span>
      <span className={r.stepper}>
        <button
          type="button"
          aria-label="−"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <b aria-live="polite">{value}</b>
        <button
          type="button"
          aria-label="+"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </span>
    </div>
  );
}

/** A small picture of the beds in a room: one bed for each two people, a sofa for a suite. */
function BedsPicture({ n, suite }: { n: number; suite?: boolean }) {
  const beds = suite ? 1 : n === 1 ? 1 : n === 2 ? 1 : Math.ceil(n / 2);
  const big = n === 2 || suite;
  return (
    <svg viewBox="0 0 64 28" className={r.bedsPic} aria-hidden="true">
      {Array.from({ length: Math.min(beds, 3) }, (_, i) => {
        const w = big ? 30 : 18;
        const x = 4 + i * (w + 4);
        return (
          <g key={i}>
            <rect
              x={x}
              y={10}
              width={w}
              height={12}
              rx={3}
              fill="currentColor"
            />
            <rect
              x={x + 2}
              y={6}
              width={big ? 12 : 8}
              height={6}
              rx={2}
              fill="currentColor"
              opacity={0.55}
            />
            {big && (
              <rect
                x={x + 16}
                y={6}
                width={12}
                height={6}
                rx={2}
                fill="currentColor"
                opacity={0.55}
              />
            )}
          </g>
        );
      })}
      {suite && (
        <path
          d="M40 22v-8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8z"
          fill="currentColor"
          opacity={0.7}
        />
      )}
    </svg>
  );
}

/** "2 × Double room · King bed" */
function roomLine(b: Booking, lang: RafeeqLang): string | null {
  if (!b.room_type) return null;
  const parts = [`${b.rooms ?? 1} × ${say(ROOM_LABEL[b.room_type], lang)}`];
  if (b.bed) parts.push(say(BED_LABEL[b.bed], lang));
  return parts.join(" · ");
}

function when(b: Booking, lang: RafeeqLang): string {
  const day = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(`${b.for_date}T12:00:00+03:00`));
  const parts = [day];
  if (b.at_time) parts.push(ltr(b.at_time.slice(0, 5)));
  if (b.nights)
    parts.push(
      say(b.nights === 1 ? "1 night" : "{n} nights", lang, { n: b.nights }),
    );
  parts.push(
    say(b.people === 1 ? "1 person" : "{n} people", lang, { n: b.people }),
  );
  return parts.join(" · ");
}

function MyBookings({
  list,
  lang,
  payments,
  sample,
  onPay,
  onCancel,
}: {
  list: Booking[];
  lang: RafeeqLang;
  payments: Payments;
  sample: boolean;
  onPay: (id: string) => void;
  onCancel: (id: string) => Promise<void>;
}) {
  const s = (en: string, vars?: Record<string, string | number>) =>
    say(en, lang, vars);
  const [asking, setAsking] = useState<string | null>(null);
  if (!list.length)
    return (
      <p className={r.lead}>
        {s("No bookings yet. Choose a restaurant, hotel or place to visit.")}
      </p>
    );
  const rtl = lang === "ar" || lang === "ur";
  return (
    <ul className={r.bookingList}>
      {list.map((b) => (
        <li key={b.id} className={`${r.booking} ${r[`bk_${b.status}`] ?? ""}`}>
          <p className={r.bookingHead}>
            <b dir="auto">
              {rtl && b.venue.name_ar ? b.venue.name_ar : b.venue.name}
            </b>
            <span className={r.bookingStatus}>{s(STATUS_WORD[b.status])}</span>
          </p>
          <p className={r.quiet}>
            {when(b, lang)} · {s("Number {ref}", { ref: ltr(`#${b.ref}`) })}
          </p>
          {roomLine(b, lang) && <p>{roomLine(b, lang)}</p>}
          {!!b.access_needs?.length && (
            <p className={r.needs}>
              <span aria-hidden="true">♿ </span>
              {b.access_needs
                .map((a) => say(ACCESS_LABEL[a], lang))
                .join(lang === "ar" || lang === "ur" ? "، " : ", ")}
            </p>
          )}
          {!!b.extras?.length && (
            <p className={r.quiet}>
              {b.extras
                .map((x) => say(EXTRA_LABEL[x], lang))
                .join(lang === "ar" || lang === "ur" ? "، " : ", ")}
            </p>
          )}
          {b.staff_note && (
            <p className={r.staffNote} dir="auto">
              {b.staff_note}
            </p>
          )}
          {b.status === "awaiting_payment" && b.amount != null && (
            <>
              <p>
                {s("The place has room. Pay {price} to confirm.", {
                  price: sar(b.amount),
                })}
              </p>
              {payments.online ? (
                <button
                  type="button"
                  className={`${r.big} ${r.yes}`}
                  onClick={() => onPay(b.id)}
                >
                  {s("Pay {price}", { price: sar(b.amount) })}
                </button>
              ) : (
                <p className={r.warning}>
                  {s(
                    "Online payment is not set up yet. Ask your group leader how to pay.",
                  )}
                </p>
              )}
            </>
          )}
          {b.status === "confirmed" &&
            (b.payment_status === "paid" ? (
              <p className={r.paid}>
                {s("Paid {price}", { price: sar(b.amount ?? 0) })} ·{" "}
                <span dir="ltr">{b.payment_ref}</span>
                {b.payment_ref?.startsWith("TEST-") && (
                  <small> · {s("Test payment: no money moved.")}</small>
                )}
              </p>
            ) : (
              <p>
                {b.amount
                  ? s("Pay {price} at the place.", { price: sar(b.amount) })
                  : s("Pay at the place.")}
              </p>
            ))}
          {b.status === "requested" && (
            <p className={r.quiet}>
              {sample
                ? s(
                    "Sample: the operator's answer is simulated after a few seconds.",
                  )
                : s("Staff are checking with the place.")}
            </p>
          )}
          {b.payment_status === "refund_due" && (
            <p className={r.warning}>
              {s(
                "Your money will be returned. Your group leader will tell you how.",
              )}
            </p>
          )}
          {(b.status === "requested" || b.status === "awaiting_payment") &&
            (asking === b.id ? (
              <div className={r.twoButtons}>
                <button
                  type="button"
                  className={r.plain}
                  onClick={() => {
                    setAsking(null);
                    void onCancel(b.id);
                  }}
                >
                  {s("Yes, cancel it")}
                </button>
                <button
                  type="button"
                  className={r.plain}
                  onClick={() => setAsking(null)}
                >
                  {s("No")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={r.plain}
                onClick={() => setAsking(b.id)}
              >
                {s("Cancel booking")}
              </button>
            ))}
          {b.status === "confirmed" && b.venue.phone && (
            <a
              className={r.plain}
              href={`tel:${b.venue.phone.replace(/[^\d+]/g, "")}`}
            >
              {s("Call the place")}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function PaySheet({
  b,
  lang,
  payments,
  onPay,
  onBack,
}: {
  b: Booking;
  lang: RafeeqLang;
  payments: Payments;
  onPay: (card: string) => Promise<void>;
  onBack: () => void;
}) {
  const s = (en: string, vars?: Record<string, string | number>) =>
    say(en, lang, vars);
  const test = payments.online === "sandbox";
  const [card, setCard] = useState(test ? "4242 4242 4242 4242" : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pay = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await onPay(card);
    } catch (e) {
      setErr(problem(e));
    } finally {
      setBusy(false);
    }
  }, [card, onPay]);
  const rtl = lang === "ar" || lang === "ur";
  const amount = useMemo(() => sar(b.amount ?? 0), [b.amount]);
  return (
    <section className={r.stay}>
      <h2>{s("Pay to confirm")}</h2>
      <div className={r.payBox}>
        <b dir="auto">
          {rtl && b.venue.name_ar ? b.venue.name_ar : b.venue.name}
        </b>
        <span className={r.quiet}>{when(b, lang)}</span>
        <span className={r.payAmount}>{amount}</span>
      </div>
      {test && (
        <p className={r.warning}>
          {s("Test payment: no money moves. Use the card 4242 4242 4242 4242.")}
        </p>
      )}
      <label className={r.field}>
        <span>{s("Card number")}</span>
        <input
          inputMode="numeric"
          autoComplete="cc-number"
          dir="ltr"
          value={card}
          onChange={(e) => setCard(e.target.value)}
        />
      </label>
      {err && (
        <p className={r.warning} role="alert" dir="auto">
          {err}
        </p>
      )}
      <button
        type="button"
        className={`${r.big} ${r.yes}`}
        disabled={busy || card.replace(/\s/g, "").length < 12}
        onClick={() => void pay()}
      >
        {busy ? s("Paying…") : s("Pay {price}", { price: amount })}
      </button>
      {!test && (
        <p className={r.quiet}>
          {s(
            "mada, Visa and Mastercard. Your card is checked by the payment company, not by Rafeeq.",
          )}
        </p>
      )}
      <button type="button" className={r.plain} onClick={onBack}>
        {s("Back")}
      </button>
    </section>
  );
}
