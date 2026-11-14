import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  useBooking,
  useBookings,
  useDecideBooking,
  useSaveVenue,
  useVenues,
} from "../../api/queries";
import { useCan, useSession } from "../../app/SessionContext";
import { Failed, Loading, PageHead, u } from "../../design/ui";
import {
  bookingStatusLabel,
  priceLabel,
  staffActions,
  venueKindLabel,
  VENUE_KINDS,
  type StaffAction,
  type VenueKind,
} from "../../domain/bookings";
import type { NewVenue, StaffBooking, Venue } from "../../domain/types";
import { fmtDate, fmtDateTime, getLang, t } from "../../i18n";
import {
  ACCESS,
  ACCESS_LABEL,
  BED_LABEL,
  EXTRA_LABEL,
  ROOM_LABEL,
  ROOM_TYPES,
} from "../../rafeeq/rooms";
import b from "./bookings.module.css";

/**
 * Bookings: what pilgrims asked for on Rafeeq, to answer after checking with
 * the place, and the places offered to them. Online payment needs a payment
 * provider; until one is signed, only a demonstration operator can ask for it
 * (as a test payment), and real bookings are confirmed to be paid at the place.
 */

export const EVENT: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  awaiting_payment: "Asked to pay online",
  paid: "Paid",
  declined: "Declined",
  cancelled: "Cancelled",
  note: "Note",
};

const sar = (n: number | null) =>
  n == null ? "—" : `${n.toLocaleString("en-US")} SAR`;

function when(x: StaffBooking): string {
  const parts = [fmtDate(x.for_date)];
  if (x.at_time) parts.push(x.at_time.slice(0, 5));
  if (x.nights)
    parts.push(
      x.nights === 1 ? t("1 night") : t("{n} nights", { n: x.nights }),
    );
  if (x.room_type)
    parts.push(`${x.rooms ?? 1} × ${t(ROOM_LABEL[x.room_type])}`);
  return parts.join(" · ");
}

export function BookingsPage() {
  const [tab, setTab] = useState<"requests" | "places">("requests");
  return (
    <>
      <PageHead
        title={t("Bookings")}
        sub={t("Pilgrims' requests from Rafeeq, and the places offered.")}
      >
        <div className={b.tabs} role="group" aria-label={t("Bookings")}>
          <button
            type="button"
            aria-pressed={tab === "requests"}
            onClick={() => setTab("requests")}
          >
            {t("Requests")}
          </button>
          <button
            type="button"
            aria-pressed={tab === "places"}
            onClick={() => setTab("places")}
          >
            {t("Places")}
          </button>
        </div>
      </PageHead>
      {tab === "requests" ? <Requests /> : <Places />}
    </>
  );
}

function Requests() {
  const q = useBookings();
  const [open, setOpen] = useState<string | null>(null);
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const list = q.data.bookings;
  return (
    <div className={b.split}>
      <section className={u.card}>
        <h2>
          {q.data.waiting
            ? t("{n} waiting for an answer", { n: q.data.waiting })
            : t("Nothing waiting")}
        </h2>
        {list.length === 0 ? (
          <p className={u.muted}>
            {t("No bookings yet. Pilgrims book from Rafeeq.")}
          </p>
        ) : (
          <div className={b.scroll}>
            <table className={u.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("Pilgrim")}</th>
                  <th>{t("Place")}</th>
                  <th>{t("When")}</th>
                  <th>{t("People")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr
                    key={x.id}
                    className={open === x.id ? u.selected : undefined}
                    onClick={() => setOpen(x.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className={u.mono}>{x.ref}</td>
                    <td>
                      <bdi dir="auto">
                        {getLang() === "ar" && x.full_name_ar
                          ? x.full_name_ar
                          : x.full_name}
                      </bdi>
                      <div className={u.muted}>
                        <bdi>{x.group_code}</bdi>
                      </div>
                    </td>
                    <td>
                      <bdi dir="auto">
                        {getLang() === "ar" && x.venue.name_ar
                          ? x.venue.name_ar
                          : x.venue.name}
                      </bdi>
                      <div className={u.muted}>
                        {venueKindLabel(x.venue.kind)}
                        {x.access_needs.length > 0 && (
                          <span title={t("Accessibility needs")}> · ♿</span>
                        )}
                      </div>
                    </td>
                    <td>{when(x)}</td>
                    <td>{x.people}</td>
                    <td>
                      <span className={`${b.status} ${b[`s_${x.status}`]}`}>
                        {bookingStatusLabel(x.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <BookingPanel key={open} id={open} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function BookingPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useBooking(id);
  const decide = useDecideBooking(id);
  const canAnswer = useCan("booking:write");
  const { me } = useSession();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const x = q.data;
  const actions = canAnswer ? staffActions(x.status) : [];
  const online = me.tenant.is_demo;
  const go = (action: StaffAction) =>
    decide.mutate(
      {
        action,
        amount: amount ? Number(amount) : null,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
        },
      },
    );
  const LABEL: Record<StaffAction, string> = {
    confirm: t("Confirm: pay at the place"),
    ask_payment: t("Confirm: ask to pay online"),
    decline: t("Decline"),
    cancel: t("Cancel booking"),
  };
  return (
    <section className={`${u.card} ${b.panel}`}>
      <div className={b.panelHead}>
        <h2>
          #{x.ref} ·{" "}
          <bdi dir="auto">
            {getLang() === "ar" && x.venue.name_ar
              ? x.venue.name_ar
              : x.venue.name}
          </bdi>
        </h2>
        <button
          type="button"
          className={`${u.button} ${u.quiet}`}
          onClick={onClose}
        >
          {t("Close")}
        </button>
      </div>
      <ul className={u.list}>
        <li>
          <span>{t("Pilgrim")}</span>
          <span>
            <bdi dir="auto">{x.full_name}</bdi> ·{" "}
            <Link to={`/groups/${x.group_id}`}>{x.group_code}</Link>
          </span>
        </li>
        <li>
          <span>{t("When")}</span>
          <span>{when(x)}</span>
        </li>
        <li>
          <span>{t("People")}</span>
          <span>{x.people}</span>
        </li>
        {x.room_type && (
          <li>
            <span>{t("Room")}</span>
            <span>
              {x.rooms ?? 1} × {t(ROOM_LABEL[x.room_type])}
              {x.bed ? ` · ${t(BED_LABEL[x.bed])}` : ""}
            </span>
          </li>
        )}
        {x.extras.length > 0 && (
          <li>
            <span>{t("Extras")}</span>
            <span>
              {x.extras
                .map((e) => t(EXTRA_LABEL[e]))
                .join(getLang() === "ar" ? "، " : ", ")}
            </span>
          </li>
        )}
        <li>
          <span>{t("Status")}</span>
          <span className={`${b.status} ${b[`s_${x.status}`]}`}>
            {bookingStatusLabel(x.status)}
          </span>
        </li>
        {x.amount != null && (
          <li>
            <span>{t("Amount")}</span>
            <span>
              {sar(x.amount)} ·{" "}
              {x.pay_at === "online" ? t("Online") : t("At the place")}
            </span>
          </li>
        )}
        {x.payment_status !== "none" && (
          <li>
            <span>{t("Payment")}</span>
            <span>
              {x.payment_status === "paid"
                ? t("Paid")
                : x.payment_status === "refund_due"
                  ? t("Refund due")
                  : t("Refunded")}
              {x.payment_ref && (
                <span className={u.mono} dir="ltr">
                  {" "}
                  {x.payment_ref}
                </span>
              )}
            </span>
          </li>
        )}
        {x.venue.phone && (
          <li>
            <span>{t("Place's phone")}</span>
            <a
              href={`tel:${x.venue.phone.replace(/[^\d+]/g, "")}`}
              className={u.mono}
              dir="ltr"
            >
              {x.venue.phone}
            </a>
          </li>
        )}
      </ul>
      {x.access_needs.length > 0 && (
        <div className={b.access}>
          <b>
            <span aria-hidden="true">♿ </span>
            {t("Accessibility needs")}
          </b>
          <ul>
            {x.access_needs.map((a) => (
              <li key={a}>{t(ACCESS_LABEL[a])}</li>
            ))}
          </ul>
          <span className={u.muted}>
            {t("Check each one with the hotel before you confirm.")}
          </span>
        </div>
      )}
      {x.note && (
        <p className={b.note}>
          <b>{t("From the pilgrim")}:</b> <span dir="auto">{x.note}</span>
        </p>
      )}
      {x.staff_note && (
        <p className={b.note}>
          <b>{t("Told the pilgrim")}:</b> <span dir="auto">{x.staff_note}</span>
        </p>
      )}
      {actions.length > 0 && (
        <div className={u.form} style={{ gridTemplateColumns: "1fr" }}>
          <p className={u.muted} style={{ margin: 0 }}>
            {t(
              "Check with the place first, then answer. The pilgrim sees it on Rafeeq.",
            )}
          </p>
          {(actions.includes("confirm") || actions.includes("ask_payment")) && (
            <label>
              {t("Amount (SAR)")}
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^\d.]/g, ""))
                }
                dir="ltr"
              />
            </label>
          )}
          <label>
            {t("Note to the pilgrim (optional)")}
            <input
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              dir="auto"
            />
          </label>
          <div className={u.formActions}>
            {actions.map((a) => (
              <button
                key={a}
                type="button"
                className={
                  a === "decline" || a === "cancel"
                    ? `${u.button} ${u.quiet}`
                    : u.button
                }
                disabled={
                  decide.isPending ||
                  (a === "ask_payment" && (!online || !Number(amount)))
                }
                onClick={() => go(a)}
              >
                {LABEL[a]}
              </button>
            ))}
          </div>
          {actions.includes("ask_payment") && !online && (
            <p className={u.muted}>
              {t(
                "Online payment is not set up for your company yet. Confirm to be paid at the place.",
              )}
            </p>
          )}
          {actions.includes("ask_payment") && online && (
            <p className={u.muted}>
              {t("Demonstration: online payment is a test. No money moves.")}
            </p>
          )}
          {decide.isError && <p className={u.error}>{decide.error.message}</p>}
        </div>
      )}
      {x.history && x.history.length > 0 && (
        <>
          <h3>{t("History")}</h3>
          <ul className={b.history}>
            {x.history.map((h, i) => (
              <li key={i}>
                <span className={u.muted}>{fmtDateTime(h.at)}</span> ·{" "}
                {t(EVENT[h.kind] ?? h.kind)} · <bdi>{h.actor}</bdi>
                {h.note && (
                  <div dir="auto" className={u.muted}>
                    {h.note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

const BLANK: NewVenue = {
  kind: "restaurant",
  city: "makkah",
  name: "",
  name_ar: null,
  stars: null,
  price_level: 2,
  cuisine: null,
  rating: null,
  rating_count: null,
  rating_source: null,
  site_id: null,
  phone: null,
  whatsapp: null,
  email: null,
  website: null,
  address: null,
  lat: null,
  lon: null,
  price_from: null,
  bookable: true,
  active: true,
  room_types: [],
  accessibility: [],
  photos: [],
};

function Places() {
  const q = useVenues();
  const canEdit = useCan("venue:write");
  const [editing, setEditing] = useState<Venue | "new" | null>(null);
  const [kind, setKind] = useState<VenueKind | "all">("all");
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const list = q.data.filter((v) => kind === "all" || v.kind === kind);
  return (
    <div className={b.split}>
      <section className={u.card}>
        <div className={b.panelHead}>
          <div className={b.tabs} role="group" aria-label={t("Kind")}>
            {(["all", ...VENUE_KINDS] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {k === "all" ? t("All") : venueKindLabel(k)}
              </button>
            ))}
          </div>
          {canEdit && (
            <button
              type="button"
              className={u.button}
              onClick={() => setEditing("new")}
            >
              {t("Add a place")}
            </button>
          )}
        </div>
        <p className={u.muted}>
          {t(
            "Every rating says where it comes from. Hotel stars are the official rating, 1 to 5.",
          )}
        </p>
        <div className={b.scroll}>
          <table className={u.table}>
            <thead>
              <tr>
                <th>{t("Place")}</th>
                <th>{t("City")}</th>
                <th>{t("Class")}</th>
                <th>{t("Rating")}</th>
                <th>{t("From")}</th>
                <th>{t("Phone")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => canEdit && setEditing(v)}
                  style={{
                    cursor: canEdit ? "pointer" : undefined,
                    opacity: v.active ? 1 : 0.5,
                  }}
                >
                  <td>
                    <bdi dir="auto">
                      {getLang() === "ar" && v.name_ar ? v.name_ar : v.name}
                    </bdi>
                    <div className={u.muted}>
                      {venueKindLabel(v.kind)}
                      {v.cuisine ? ` · ${v.cuisine}` : ""}
                      {!v.active ? ` · ${t("Off")}` : ""}
                    </div>
                  </td>
                  <td>{t(v.city === "makkah" ? "Makkah" : "Madinah")}</td>
                  <td>
                    {v.kind === "hotel"
                      ? v.stars
                        ? `${v.stars}★`
                        : "—"
                      : v.kind === "restaurant"
                        ? priceLabel(v.price_level)
                        : "—"}
                  </td>
                  <td>
                    {v.rating != null
                      ? `${v.rating.toFixed(1)} (${(v.rating_count ?? 0).toLocaleString("en-US")})`
                      : "—"}
                    {v.rating_source && (
                      <div className={u.muted}>{v.rating_source}</div>
                    )}
                  </td>
                  <td>{sar(v.price_from)}</td>
                  <td className={u.mono} dir="ltr">
                    {v.phone ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <VenueForm
          key={editing === "new" ? "new" : editing.id}
          venue={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function VenueForm({
  venue,
  onClose,
}: {
  venue: Venue | null;
  onClose: () => void;
}) {
  const save = useSaveVenue();
  const [f, setF] = useState<NewVenue>(() =>
    venue ? { ...venue } : { ...BLANK },
  );
  /* the photo links as typed; split into links when saved */
  const [photoText, setPhotoText] = useState(() => (venue?.photos ?? []).join("\n"));
  const set = <K extends keyof NewVenue>(k: K, v: NewVenue[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const str = (s: string) => (s.trim() === "" ? null : s.trim());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const photos = photoText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);
    const body = { ...f, photos, stars: f.kind === "hotel" ? f.stars : null };
    if (venue) {
      const { kind: _k, city: _c, site_id: _s, ...change } = body;
      save.mutate({ id: venue.id, v: change }, { onSuccess: onClose });
    } else save.mutate({ v: body }, { onSuccess: onClose });
  };
  return (
    <section className={`${u.card} ${b.panel}`}>
      <div className={b.panelHead}>
        <h2>{venue ? t("Edit place") : t("Add a place")}</h2>
        <button
          type="button"
          className={`${u.button} ${u.quiet}`}
          onClick={onClose}
        >
          {t("Close")}
        </button>
      </div>
      <form
        className={u.form}
        onSubmit={submit}
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        <label>
          {t("Kind")}
          <select
            value={f.kind}
            disabled={!!venue}
            onChange={(e) => set("kind", e.target.value as VenueKind)}
          >
            {VENUE_KINDS.map((k) => (
              <option key={k} value={k}>
                {venueKindLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("City")}
          <select
            value={f.city}
            disabled={!!venue}
            onChange={(e) => set("city", e.target.value as NewVenue["city"])}
          >
            <option value="makkah">{t("Makkah")}</option>
            <option value="madinah">{t("Madinah")}</option>
          </select>
        </label>
        <label>
          {t("Name")}
          <input
            required
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label>
          {t("Name in Arabic")}
          <input
            dir="rtl"
            value={f.name_ar ?? ""}
            onChange={(e) => set("name_ar", str(e.target.value))}
          />
        </label>
        {f.kind === "hotel" ? (
          <label>
            {t("Stars (official)")}
            <select
              value={f.stars ?? ""}
              onChange={(e) => set("stars", num(e.target.value))}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}★
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            {t("Price level")}
            <select
              value={f.price_level ?? ""}
              onChange={(e) => set("price_level", num(e.target.value))}
            >
              <option value="">—</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {priceLabel(n)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {f.kind === "hotel"
            ? t("From (SAR a night)")
            : t("From (SAR a person)")}
          <input
            inputMode="decimal"
            dir="ltr"
            value={f.price_from ?? ""}
            onChange={(e) => set("price_from", num(e.target.value))}
          />
        </label>
        {f.kind === "restaurant" && (
          <label>
            {t("Food")}
            <input
              value={f.cuisine ?? ""}
              onChange={(e) => set("cuisine", str(e.target.value))}
            />
          </label>
        )}
        {f.kind === "attraction" && !venue && (
          <label>
            {t("Rafeeq guide place (id)")}
            <input
              dir="ltr"
              placeholder="kiswa"
              value={f.site_id ?? ""}
              onChange={(e) => set("site_id", str(e.target.value))}
            />
          </label>
        )}
        <label>
          {t("Rating (0–5)")}
          <input
            inputMode="decimal"
            dir="ltr"
            value={f.rating ?? ""}
            onChange={(e) => set("rating", num(e.target.value))}
          />
        </label>
        <label>
          {t("Number of reviews")}
          <input
            inputMode="numeric"
            dir="ltr"
            value={f.rating_count ?? ""}
            onChange={(e) => set("rating_count", num(e.target.value))}
          />
        </label>
        <label>
          {t("Rating from")}
          <input
            placeholder="Google"
            value={f.rating_source ?? ""}
            onChange={(e) => set("rating_source", str(e.target.value))}
            required={f.rating != null}
          />
        </label>
        <label>
          {t("Phone")}
          <input
            type="tel"
            dir="ltr"
            value={f.phone ?? ""}
            onChange={(e) => set("phone", str(e.target.value))}
          />
        </label>
        <label>
          WhatsApp
          <input
            type="tel"
            dir="ltr"
            placeholder="+966 5…"
            value={f.whatsapp ?? ""}
            onChange={(e) => set("whatsapp", str(e.target.value))}
          />
        </label>
        <label>
          {t("Email")}
          <input
            type="email"
            dir="ltr"
            value={f.email ?? ""}
            onChange={(e) => set("email", str(e.target.value))}
          />
        </label>
        <label>
          {t("Website")}
          <input
            type="url"
            dir="ltr"
            placeholder="https://"
            value={f.website ?? ""}
            onChange={(e) => set("website", str(e.target.value))}
          />
        </label>
        <label>
          {t("Address")}
          <input
            dir="auto"
            value={f.address ?? ""}
            onChange={(e) => set("address", str(e.target.value))}
          />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          {t("Photo links (one per line, https://, up to 8)")}
          <textarea
            rows={3}
            dir="ltr"
            placeholder="https://"
            value={photoText}
            onChange={(e) => setPhotoText(e.target.value)}
          />
          <span className={u.muted}>{t("Use only photos you have the right to show. Without photos, pilgrims see an example photo.")}</span>
        </label>
        <label>
          {t("Latitude")}
          <input
            inputMode="decimal"
            dir="ltr"
            value={f.lat ?? ""}
            onChange={(e) => set("lat", num(e.target.value))}
          />
        </label>
        <label>
          {t("Longitude")}
          <input
            inputMode="decimal"
            dir="ltr"
            value={f.lon ?? ""}
            onChange={(e) => set("lon", num(e.target.value))}
          />
        </label>
        {f.kind === "hotel" && (
          <>
            <fieldset className={b.boxes}>
              <legend>{t("Room types it has")}</legend>
              {ROOM_TYPES.map((r) => (
                <label key={r} className={b.check}>
                  <input
                    type="checkbox"
                    checked={f.room_types.includes(r)}
                    onChange={() =>
                      set(
                        "room_types",
                        f.room_types.includes(r)
                          ? f.room_types.filter((x) => x !== r)
                          : ROOM_TYPES.filter(
                              (x) => x === r || f.room_types.includes(x),
                            ),
                      )
                    }
                  />
                  {t(ROOM_LABEL[r])}
                </label>
              ))}
            </fieldset>
            <fieldset className={b.boxes}>
              <legend>♿ {t("Accessibility it offers")}</legend>
              {ACCESS.map((a) => (
                <label key={a} className={b.check}>
                  <input
                    type="checkbox"
                    checked={f.accessibility.includes(a)}
                    onChange={() =>
                      set(
                        "accessibility",
                        f.accessibility.includes(a)
                          ? f.accessibility.filter((x) => x !== a)
                          : ACCESS.filter(
                              (x) => x === a || f.accessibility.includes(x),
                            ),
                      )
                    }
                  />
                  {t(ACCESS_LABEL[a])}
                </label>
              ))}
            </fieldset>
          </>
        )}
        <label className={b.check}>
          <input
            type="checkbox"
            checked={f.bookable}
            onChange={(e) => set("bookable", e.target.checked)}
          />
          {t("Takes bookings through Rafeeq")}
        </label>
        <label className={b.check}>
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          {t("Shown to pilgrims")}
        </label>
        <div className={u.formActions} style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className={u.button} disabled={save.isPending}>
            {t("Save")}
          </button>
          {save.isError && (
            <span className={u.error}>{save.error.message}</span>
          )}
        </div>
      </form>
    </section>
  );
}
