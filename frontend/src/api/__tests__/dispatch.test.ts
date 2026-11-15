import { afterEach, describe, expect, it, vi } from "vitest";
import { MockSource } from "../mockSource";

afterEach(() => vi.useRealTimers());

describe("the sample's dispatcher", () => {
  it("plans, is approved, hears answers, and replaces a no", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T06:00:00+03:00"));
    const src = new MockSource();
    let v = await src.runDispatch();
    expect(v.settings.mode).toBe("approve");
    const items = v.plan!.items;
    /* the demo roster has no Hausa speaker: that gap is for a supervisor */
    expect(items.some((i) => i.language === "ha" && i.missing > 0 && i.people.length === 0)).toBe(true);
    const asks = items.reduce((n, i) => n + i.people.length, 0);
    expect(asks).toBeGreaterThan(0);

    const before = await src.arrivals(72);
    const shortBefore = before.load.reduce((n, r) => n + r.short.reduce((m, x) => m + x.short, 0), 0);
    const approved = await src.approvePlan(v.plan!.id);
    expect(approved.asked).toBe(asks);
    expect(approved.requests.every((r) => r.status === "asked" && r.link?.startsWith("#wk_sample."))).toBe(true);
    /* covered on paper, waiting for answers */
    const after = await src.arrivals(72);
    const shortAfter = after.load.reduce((n, r) => n + r.short.reduce((m, x) => m + x.short, 0), 0);
    expect(shortAfter).toBe(shortBefore - asks);
    expect(after.load.some((r) => (r.waiting ?? []).length > 0)).toBe(true);

    /* answers come in */
    vi.setSystemTime(new Date("2026-11-15T06:00:10+03:00"));
    v = await src.dispatch();
    expect(v.requests.every((r) => r.status !== "asked")).toBe(true);
    const no = v.requests.find((r) => r.status === "declined");
    if (no) {
      /* the next round finds someone else for that same shift */
      v = await src.runDispatch();
      const again = v.plan!.items.find((i) => i.shift_id === no.shift_id)!;
      expect(again.people.length + again.missing).toBe(1);
      expect(again.people.every((p) => p.id !== no.worker_id)).toBe(true);
    }
  });

  it("asks at once when automatic, and nothing when there is nothing to cover", async () => {
    const src = new MockSource();
    await src.setDispatchSettings({ mode: "auto", horizon_hours: 72, answer_minutes: 30 });
    const v = await src.runDispatch();
    expect(v.plan).toBeNull();
    expect(v.requests.length).toBeGreaterThan(0);
  });
});
