import sample from "../../../sample/demo.json";
import { DataSourceError } from "../api/dataSource";
import { isRafeeqLang, type HelpKind, type RafeeqLang } from "./help";
import { prompt } from "./askRules";
import {
  ASK_ACTIONS,
  type AskAnswer,
  type AskAction,
  type Booking,
  type NewBooking,
  type NewReading,
  type RafeeqAlert,
  type RafeeqCall,
  type RafeeqPage,
  type RafeeqSource,
  type ReturnLeg,
  type Venue,
  type VenueKind,
} from "./source";
import { say } from "./words";
import { assess, DANGER, RULES, type Reading } from "./vitals";
import { SLEEPS, type Access, type RoomType } from "./rooms";
import { sampleWeather } from "./weatherRules";

/**
 * Rafeeq on the sample, with no backend: one invented pilgrim from
 * sample/demo.json. A card made in the staff app's sample mode names its
 * pilgrim (rfq_sample.p-12); any other card opens the first pilgrim in
 * Madinah. Calls, readings and countdowns live until the page is reloaded and
 * reach nobody, which the page says.
 */
export class MockRafeeq implements RafeeqSource {
  readonly kind = "mock" as const;
  private readonly base: Omit<RafeeqPage, "calls" | "consent" | "health" | "alert" | "location_at" | "recent">;
  private calls: RafeeqCall[] = [];
  private agreed = { health: false, location: false };
  private vitals: Reading[] = [];
  private waterAt: string | null = null;
  private placeAt: string | null = null;
  private alert: RafeeqAlert | null = null;
  private quietUntil = 0;

  constructor(token: string) {
    const named = /^rfq_sample\.p-(\d+)(?:\.(\w\w))?$/.exec(token);
    /* no pilgrim named: one in the Jakarta group, whose others share their place, so "Find my way" has a group to show */
    const sharing = new Set(sample.vitals.filter((v) => v.group_code === "U-ID-0412").map((v) => v.pilgrim_index));
    const jakarta = sample.pilgrims.map((p, i) => [p, i] as const).filter(([p]) => p.group_code === "U-ID-0412");
    const index = named ? Number(named[1]) : (jakarta.find(([p], k) => p.status === "in_madinah" && !sharing.has(k))?.[1] ?? 0);
    const p = sample.pilgrims[index] ?? sample.pilgrims[0];
    const g = sample.groups.find((x) => x.code === p.group_code)!;
    const lang = named?.[2];
    /* the rest of the group sharing their place in the sample: their middle, when three or more */
    const self = sample.pilgrims.filter((x) => x.group_code === g.code).indexOf(p);
    const others = sample.vitals.filter((v) => v.group_code === g.code && v.pilgrim_index !== self).map((v) => v.place);
    const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    this.base = {
      meeting: g.meeting ?? null,
      group_now:
        others.length >= 3
          ? { lat: mid(others.map((o) => o.lat)), lon: mid(others.map((o) => o.lon)), count: others.length, at: new Date().toISOString() }
          : null,
      full_name: p.full_name,
      full_name_ar: p.full_name_ar,
      group_code: g.code,
      group_name: g.name,
      leader_name: g.leader_name,
      leader_phone: g.leader_phone,
      operator: sample.operator.name,
      operator_ar: sample.operator.name_ar,
      language: isRafeeqLang(lang) ? lang : "en",
      is_demo: true,
      status: p.status,
      visa_expires_on: p.visa_ends_in_days == null ? null : daysFromToday(p.visa_ends_in_days),
      leaving_on: daysFromToday(g.depart_in_days),
      return_legs: legsOf(g.code, g.depart_in_days),
    };
  }

  private page(): RafeeqPage {
    this.fireIfDue();
    const health = this.agreed.health ? assess(this.vitals, this.waterAt, new Date()) : null;
    if (health) health.simulated = true;
    const alert = this.alert && {
      ...this.alert,
      seconds_left: Math.max(0, Math.ceil((Date.parse(this.alert.fires_at) - Date.now()) / 1000)),
    };
    return {
      ...this.base,
      calls: this.calls.map((c) => ({ ...c })),
      consent: { ...this.agreed },
      health,
      alert,
      location_at: this.agreed.location ? this.placeAt : null,
      recent: this.agreed.health
        ? [...this.vitals]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 12)
            .map(([at, heart_rate, temperature]) => ({ at, heart_rate, temperature }))
        : [],
    };
  }

  /* the count ran out: a medical call, as the platform's job would raise */
  private fireIfDue() {
    if (!this.alert || Date.parse(this.alert.fires_at) > Date.now()) return;
    this.alert = null;
    this.calls = [this.newCall("medical"), ...this.calls];
  }

  private newCall(kind: RafeeqCall["kind"]): RafeeqCall {
    return {
      id: `c-${this.calls.length}`,
      ref: 2001 + this.calls.length,
      kind,
      status: "open",
      opened_at: new Date().toISOString(),
      assigned_at: null,
      resolved_at: null,
      pilgrim_ok_at: null,
    };
  }

  async me() {
    return this.page();
  }

  async help(kind: HelpKind, _location: string | null, _language: RafeeqLang) {
    const same = this.calls.find((c) => c.kind === kind && c.status !== "resolved");
    if (same) return { ...this.page(), call: same.id, repeated: true };
    const call = this.newCall(kind);
    this.calls = [call, ...this.calls];
    return { ...this.page(), call: call.id, repeated: false };
  }

  async fine(callId: string) {
    const c = this.calls.find((x) => x.id === callId && x.status !== "resolved");
    if (!c) throw new DataSourceError("no such call for help, or it is already closed", { status: 404 });
    c.pilgrim_ok_at ??= new Date().toISOString();
    return this.page();
  }

  async consent(c: { health?: boolean; location?: boolean }) {
    if (c.health != null) this.agreed.health = c.health;
    if (c.location != null) this.agreed.location = c.location;
    if (c.health === false) {
      this.vitals = [];
      this.waterAt = null;
      this.alert = null;
    }
    if (c.location === false) this.placeAt = null;
    return this.page();
  }

  async readings(r: NewReading[], source: "device" | "simulated") {
    if (!this.agreed.health) throw new DataSourceError("the pilgrim has not agreed to share health readings", { status: 409 });
    const now = new Date().toISOString();
    /* a demonstration button replaces the last one's readings, as on the platform */
    if (source === "simulated") this.vitals = [];
    this.vitals.push(...r.map((x) => [x.at ?? now, x.heart_rate ?? null, x.temperature ?? null] as Reading));
    const h = assess(this.vitals, this.waterAt, new Date());
    const medicalOpen = this.calls.some((c) => c.kind === "medical" && c.status !== "resolved");
    if (h.level === "danger" && !this.alert && !medicalOpen && Date.now() >= this.quietUntil) {
      this.alert = {
        id: `a-${Date.now()}`,
        reasons: h.reasons.filter((x) => (DANGER as readonly string[]).includes(x)),
        heart_rate: h.heart.bpm,
        temperature: h.temperature.c,
        started_at: now,
        fires_at: new Date(Date.now() + RULES.COUNTDOWN_S * 1000).toISOString(),
        seconds_left: RULES.COUNTDOWN_S,
      };
    }
    return this.page();
  }

  async water() {
    if (!this.agreed.health) throw new DataSourceError("the pilgrim has not agreed to share health readings", { status: 409 });
    this.waterAt = new Date().toISOString();
    return this.page();
  }

  async location(_lat: number, _lon: number, _accuracy: number | null, _source: "phone" | "simulated") {
    if (!this.agreed.location) throw new DataSourceError("the pilgrim has not agreed to share where they are", { status: 409 });
    this.placeAt = new Date().toISOString();
  }

  /**
   * In the Claude viewer (the client demo) the question goes to Claude through the viewer, on the
   * viewer's own account, with the server's own rules. Anywhere else the sample says it cannot answer.
   */
  async ask(question: string, language: RafeeqLang, history: { question: string; answer: string }[]): Promise<AskAnswer> {
    const viewer = (globalThis as { claude?: { use(name: "sample"): Promise<SampleFn | null> } }).claude;
    const sampleFn = viewer?.use ? await viewer.use("sample").catch(() => null) : null;
    if (!sampleFn) return { outcome: "answered", answer: say("Sample: Ask Rafeeq answers in the real app.", language), action: "none" };
    try {
      const out = await sampleFn.json(prompt(question, language, this.page(), history), { modelTier: "quick", cache: false });
      const o = (out ?? {}) as { answer?: unknown; action?: unknown };
      const answer = typeof o.answer === "string" ? o.answer.trim() : "";
      const action = (ASK_ACTIONS as readonly string[]).includes(String(o.action)) ? (o.action as AskAction) : "none";
      return answer ? { outcome: "answered", answer, action } : { outcome: "failed", answer: null, action: "none" };
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "refused") return { outcome: "declined", answer: null, action: "none" };
      if (code === "invalid_json" || code === "empty_completion") return { outcome: "failed", answer: null, action: "none" };
      throw new DataSourceError(`Ask Rafeeq is not available here (${code ?? "unknown"})`, { status: code === "rate_limited" ? 429 : 503 });
    }
  }

  /* ---- places and bookings: the operator's answer is simulated a few seconds after a request ---- */

  private booked: Booking[] = [];
  private static readonly ANSWER_MS = 5_000;
  private static readonly TEST_CARD = "4242424242424242";

  private answerDue() {
    const now = Date.now();
    for (const b of this.booked) {
      if (b.status !== "requested" || now - Date.parse(b.requested_at) < MockRafeeq.ANSWER_MS) continue;
      const v = VENUES.find((x) => x.id === b.venue.id)!;
      b.updated_at = new Date().toISOString();
      if (v.kind === "hotel" && v.price_from) {
        /* a hotel asks for payment first: the room type's price (the sample's own guess) for each room and night */
        b.status = "awaiting_payment";
        b.pay_at = "online";
        const factor = ROOM_PRICE[b.room_type ?? "double"] ?? 1;
        b.amount = Math.round(v.price_from * factor * (b.rooms ?? 1) * (b.nights ?? 1));
      } else {
        b.status = "confirmed";
        b.pay_at = "venue";
        b.amount = v.price_from ? v.price_from * b.people : null;
      }
    }
  }

  private mine() {
    this.answerDue();
    return { bookings: this.booked.map((b) => ({ ...b, venue: { ...b.venue } })), payments: { online: "sandbox" } };
  }

  async venues(kind?: VenueKind, city?: "makkah" | "madinah") {
    return { venues: VENUES.filter((v) => (!kind || v.kind === kind) && (!city || v.city === city)), payments: { online: "sandbox" } };
  }

  async bookings() {
    return this.mine();
  }

  async book(n: NewBooking) {
    const v = VENUES.find((x) => x.id === n.venue_id);
    if (!v) throw new DataSourceError("no such place", { status: 404 });
    if (v.kind === "hotel" && !n.nights) throw new DataSourceError("say how many nights", { status: 422 });
    if (v.kind === "restaurant" && !n.at_time) throw new DataSourceError("say what time", { status: 422 });
    const hotel = v.kind === "hotel";
    if (hotel && !n.room_type) throw new DataSourceError("choose a room type", { status: 422 });
    if (hotel && v.room_types?.length && !v.room_types.includes(n.room_type!))
      throw new DataSourceError("this hotel does not have that room type", { status: 422 });
    if (hotel && (n.rooms ?? 1) * SLEEPS[n.room_type!] < n.people)
      throw new DataSourceError("add rooms or choose a bigger room", { status: 422 });
    const now = new Date().toISOString();
    const b: Booking = {
      id: `b-${this.booked.length}`,
      ref: 3001 + this.booked.length,
      venue: { id: v.id, kind: v.kind, city: v.city, name: v.name, name_ar: v.name_ar, phone: v.phone, site_id: v.site_id },
      for_date: n.for_date,
      at_time: n.at_time ?? null,
      nights: v.kind === "hotel" ? (n.nights ?? null) : null,
      people: n.people,
      note: n.note ?? null,
      rooms: hotel ? (n.rooms ?? 1) : null,
      room_type: hotel ? (n.room_type ?? null) : null,
      bed: hotel ? (n.bed ?? null) : null,
      access_needs: hotel ? (n.access_needs ?? []) : [],
      extras: hotel ? (n.extras ?? []) : [],
      status: "requested",
      amount: null,
      currency: "SAR",
      pay_at: null,
      payment_status: "none",
      payment_ref: null,
      staff_note: null,
      requested_at: now,
      updated_at: now,
    };
    this.booked.push(b);
    return { booking: b.id, ...this.mine() };
  }

  async cancelBooking(id: string) {
    this.answerDue();
    const b = this.booked.find((x) => x.id === id);
    if (!b) throw new DataSourceError("no such booking", { status: 404 });
    if (b.status !== "requested" && b.status !== "awaiting_payment")
      throw new DataSourceError("this booking is confirmed; ask your group leader to cancel it", { status: 409 });
    b.status = "cancelled";
    b.updated_at = new Date().toISOString();
    return this.mine();
  }

  async pay(id: string, cardNumber: string) {
    this.answerDue();
    const b = this.booked.find((x) => x.id === id);
    if (!b) throw new DataSourceError("no such booking", { status: 404 });
    if (b.status !== "awaiting_payment") throw new DataSourceError("cannot pay a booking that is not waiting for payment", { status: 409 });
    if (cardNumber.replace(/\s/g, "") !== MockRafeeq.TEST_CARD)
      throw new DataSourceError("use the test card 4242 4242 4242 4242: this is a test payment", { status: 402 });
    b.status = "confirmed";
    b.payment_status = "paid";
    b.payment_ref = `TEST-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
    b.updated_at = new Date().toISOString();
    return this.mine();
  }

  /** The month's typical weather, marked as a sample: the demo cannot reach a forecast. */
  async weather() {
    return sampleWeather();
  }

  async iAmOk(alertId: string) {
    this.fireIfDue();
    if (!this.alert || this.alert.id !== alertId)
      throw new DataSourceError("too late to stop it: help has already been called", { status: 409 });
    this.alert = null;
    this.quietUntil = Date.now() + RULES.QUIET_AFTER_OK_MIN * 60_000;
    return this.page();
  }
}

/** The sample's simulated answer prices a room type against the hotel's cheapest (double) room. Invented. */
const ROOM_PRICE: Record<string, number> = { single: 0.85, double: 1, twin: 1, triple: 1.3, quad: 1.55, family: 1.8, suite: 2.6 };

/** The sample's places, with ids the page can hold. Invented names; ratings marked "Sample". */
const VENUES: Venue[] = sample.venues.map((v, i) => ({
  ...v,
  id: `v-${i}`,
  kind: v.kind as VenueKind,
  city: v.city as Venue["city"],
  room_types: v.room_types as RoomType[],
  accessibility: v.accessibility as Access[],
  photos: [],
  phone: null,
  whatsapp: null,
  email: null,
  website: null,
  address: null,
  bookable: true,
}));

/** A group's flights home on its departure day, in Saudi time. */
function legsOf(code: string, departInDays: number): ReturnLeg[] {
  const legs = (sample.return_legs as Record<string, { flight_number: string; from_airport: string; to_airport: string; time: string; minutes: number }[]>)[code] ?? [];
  return legs.map((l, i) => {
    const departs = new Date(`${daysFromToday(departInDays)}T${l.time}:00+03:00`);
    return {
      seq: i + 1,
      flight_number: l.flight_number,
      from_airport: l.from_airport,
      to_airport: l.to_airport,
      departs_at: departs.toISOString(),
      arrives_at: new Date(departs.getTime() + l.minutes * 60_000).toISOString(),
    };
  });
}

/** Today in Saudi Arabia plus n days, as 2026-11-14. */
function daysFromToday(n: number): string {
  return new Date(Date.now() + 3 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);
}

/** The Claude viewer's `sample` capability, as much of it as the demo uses. */
interface SampleFn {
  json(input: string, options?: { modelTier?: "quick" | "default" | "complex"; cache?: boolean }): Promise<unknown>;
}
