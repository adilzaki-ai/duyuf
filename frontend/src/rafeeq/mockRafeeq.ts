import sample from "../../../sample/demo.json";
import { DataSourceError } from "../api/dataSource";
import { isRafeeqLang, type HelpKind, type RafeeqLang } from "./help";
import type { NewReading, RafeeqAlert, RafeeqCall, RafeeqPage, RafeeqSource } from "./source";
import { assess, DANGER, RULES, type Reading } from "./vitals";

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

  async iAmOk(alertId: string) {
    this.fireIfDue();
    if (!this.alert || this.alert.id !== alertId)
      throw new DataSourceError("too late to stop it: help has already been called", { status: 409 });
    this.alert = null;
    this.quietUntil = Date.now() + RULES.QUIET_AFTER_OK_MIN * 60_000;
    return this.page();
  }
}
