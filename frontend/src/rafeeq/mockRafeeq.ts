import sample from "../../../sample/demo.json";
import { DataSourceError } from "../api/dataSource";
import { isRafeeqLang, type HelpKind, type RafeeqLang } from "./help";
import type { RafeeqCall, RafeeqPage, RafeeqSource } from "./source";

/**
 * Rafeeq on the sample, with no backend: one invented pilgrim from
 * sample/demo.json. A card made in the staff app's sample mode names its
 * pilgrim (rfq_sample.p-12); any other card opens the first pilgrim in
 * Madinah. Calls live until the page is reloaded and reach nobody, which the
 * page says.
 */
export class MockRafeeq implements RafeeqSource {
  readonly kind = "mock" as const;
  private readonly base: Omit<RafeeqPage, "calls">;
  private calls: RafeeqCall[] = [];

  constructor(token: string) {
    const named = /^rfq_sample\.p-(\d+)(?:\.(\w\w))?$/.exec(token);
    const index = named ? Number(named[1]) : sample.pilgrims.findIndex((p) => p.status === "in_madinah");
    const p = sample.pilgrims[index] ?? sample.pilgrims[0];
    const g = sample.groups.find((x) => x.code === p.group_code)!;
    const lang = named?.[2];
    this.base = {
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
    return { ...this.base, calls: this.calls.map((c) => ({ ...c })) };
  }

  async me() {
    return this.page();
  }

  async help(kind: HelpKind, _location: string | null, _language: RafeeqLang) {
    const same = this.calls.find((c) => c.kind === kind && c.status !== "resolved");
    if (same) return { ...this.page(), call: same.id, repeated: true };
    const call: RafeeqCall = {
      id: `c-${this.calls.length}`,
      ref: 2001 + this.calls.length,
      kind,
      status: "open",
      opened_at: new Date().toISOString(),
      assigned_at: null,
      resolved_at: null,
      pilgrim_ok_at: null,
    };
    this.calls = [call, ...this.calls];
    return { ...this.page(), call: call.id, repeated: false };
  }

  async fine(callId: string) {
    const c = this.calls.find((x) => x.id === callId && x.status !== "resolved");
    if (!c) throw new DataSourceError("no such call for help, or it is already closed", { status: 404 });
    c.pilgrim_ok_at ??= new Date().toISOString();
    return this.page();
  }
}
