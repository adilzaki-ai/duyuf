import { describe, expect, it } from "vitest";
import sample from "../../../../sample/demo.json";
import { MockSource } from "../mockSource";

const NOW = new Date("2026-11-12T09:00:00+03:00");

describe("the sample", () => {
  it("counts every pilgrim once, and has a group landing this week", async () => {
    const o = await new MockSource(NOW).overview();
    expect(o.today).toBe("2026-11-12");
    expect(o.pilgrims).toBe(sample.pilgrims.length);
    expect(Object.values(o.by_status).reduce((a, b) => a + b, 0)).toBe(sample.pilgrims.length);
    expect(o.arriving.map((g) => g.code)).toContain("U-EG-0207");
    expect(o.arriving[0].on_date).toBe("2026-11-13");
  });

  it("dates move with today", async () => {
    const later = await new MockSource(new Date("2027-01-01T09:00:00+03:00")).groups();
    expect(later.find((g) => g.code === "U-EG-0207")!.arrival_date).toBe("2027-01-02");
  });

  it("refuses what the platform refuses, and records what it allows", async () => {
    const m = new MockSource(NOW);
    const { items } = await m.pilgrims({ status: "registered", limit: 1 });
    await expect(m.movePilgrim(items[0].id, "in_makkah")).rejects.toThrow(/allowed: visa_issued/);
    const moved = await m.movePilgrim(items[0].id, "visa_issued", "papers in");
    expect(moved.status).toBe("visa_issued");
    expect(moved.history.at(-1)).toMatchObject({ from_status: "registered", to_status: "visa_issued", note: "papers in" });
    expect((await m.overview()).by_status.visa_issued).toBe((await new MockSource(NOW).overview()).by_status.visa_issued + 1);
  });
});
