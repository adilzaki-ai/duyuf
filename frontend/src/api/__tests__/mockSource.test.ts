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
    expect(o.arriving.find((g) => g.code === "U-EG-0207")!.on_date).toBe("2026-11-13");
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

  it("has flights on the board for the next two days, with their briefs", async () => {
    const m = new MockSource(NOW);
    const board = await m.arrivals(48);
    /* at 09:00 on day 0: PK 743 (05:40) is past and unconfirmed; SV 3304 (day 2, 13:05) is beyond 48 hours */
    expect(board.flights.map((f) => [f.number, f.state])).toEqual([
      ["PK 743", "due"],
      ["SV 705", "on_time"],
      ["MS 683", "on_time"],
      ["GA 980", "delayed"],
      ["6E 63", "on_time"],
    ]);
    const ga = board.flights.find((f) => f.number === "GA 980")!;
    expect(ga.delay_minutes).toBe(95);
    expect(ga.brief.pilgrims).toBe(44);
    expect(ga.brief.languages[0]).toMatchObject({ language: "id", pilgrims: 44, interpreters: 2 });
    /* the wave counts everyone on a flight not yet confirmed down, from the 09:00 block on */
    const waved = board.waves.reduce((n, w) => n + Object.values(w.by_airport).reduce((a, b) => a + b, 0), 0);
    expect(waved).toBe(24 + 30 + 44 + 34);
    expect(board.waves[0].start).toBe("2026-11-12T09:00:00+03:00");
    const week = await m.arrivals(168);
    expect(week.unplanned.map((g) => g.code)).toEqual(["U-NG-0090"]);
  });

  it("lands a flight: those with a visa arrive, the rest are held", async () => {
    const m = new MockSource(NOW);
    const ms = (await m.arrivals(48)).flights.find((f) => f.number === "MS 683")!;
    expect(ms.brief.no_visa).toBe(1);
    const landed = await m.landFlight(ms.id);
    expect([landed.arrived, landed.no_visa, landed.state]).toEqual([29, 1, "landed"]);
    const { items } = await m.pilgrims({ flight_id: ms.id, status: "arrived", limit: 1 });
    expect((await m.pilgrim(items[0].id)).history.at(-1)).toMatchObject({ to_status: "arrived", note: "Flight MS 683 landed" });
    await expect(m.landFlight(ms.id)).rejects.toThrow(/already marked landed/);
    await expect(m.updateFlight(ms.id, { estimated_at: null })).rejects.toThrow(/has landed/);
  });

  it("plans a new flight and fills it from a group", async () => {
    const m = new MockSource(NOW);
    const f = await m.createFlight({
      number: "sv 811",
      origin_airport: "lag",
      arrival_airport: "MED",
      scheduled_at: "2026-11-18T10:00:00+03:00",
    });
    expect([f.number, f.origin_airport, f.state]).toEqual(["SV 811", "LAG", "on_time"]);
    const filled = await m.assignToFlight(f.id, { group_id: "g-U-NG-0090" });
    expect(filled.added).toBe(28);
    expect((await m.arrivals(168)).unplanned).toEqual([]);
    expect((await m.assignToFlight(f.id, { group_id: "g-U-NG-0090" })).added).toBe(0);
    await expect(
      m.createFlight({ number: "nope", origin_airport: "LAG", arrival_airport: "MED", scheduled_at: f.scheduled_at }),
    ).rejects.toThrow(/looks like SV 3102/);
  });
});
