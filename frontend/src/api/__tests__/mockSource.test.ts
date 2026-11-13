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

  it("shows Madinah short around GA 980, and a what-if that closes it without saving", async () => {
    const m = new MockSource(NOW);
    const board = await m.arrivals(48);
    const row = board.load.find((r) => r.flights.includes("GA 980"))!;
    expect(row).toMatchObject({ airport: "MED", start: "2026-11-13T09:00:00+03:00" });
    expect(row.short).toEqual([
      { kind: "wheelchair", language: null, short: 1 },
      { kind: "interpreter", language: "id", short: 1 },
    ]);
    expect(board.flights.find((f) => f.number === "GA 980")!.short).toBe(true);
    expect(board.flights.find((f) => f.number === "MS 683")!.short).toBe(false);

    const fixed = await m.whatIf({
      hours: 48,
      delays: [],
      extra: [
        { airport: "MED", kind: "wheelchair", language: null, quantity: 1 },
        { airport: "MED", kind: "interpreter", language: "id", quantity: 1 },
      ],
    });
    expect(fixed.what_if).toBe(true);
    expect(fixed.load.find((r) => r.flights.includes("GA 980"))!.short).toEqual([]);

    const ga = board.flights.find((f) => f.number === "GA 980")!;
    const later = await m.whatIf({ hours: 48, delays: [{ flight_id: ga.id, minutes: 180 }], extra: [] });
    expect(later.flights.find((f) => f.number === "GA 980")!.expected_at).toBe("2026-11-13T14:00:00+03:00");
    expect((await m.flight(ga.id)).expected_at).toBe("2026-11-13T11:00:00+03:00");
  });

  it("plans and removes shifts", async () => {
    const m = new MockSource(NOW);
    expect(await m.shifts()).toHaveLength(6);
    const s = await m.addShift({
      airport: "med",
      kind: "interpreter",
      language: "id",
      quantity: 1,
      starts_at: "2026-11-12T00:00:00+03:00",
      ends_at: "2026-11-15T00:00:00+03:00",
    });
    expect(s.airport).toBe("MED");
    const row = (await m.arrivals(48)).load.find((r) => r.flights.includes("GA 980"))!;
    expect(row.have.interpreter).toEqual({ id: 2 });
    await m.removeShift(s.id);
    await expect(m.removeShift(s.id)).rejects.toThrow(/no such shift/);
    await expect(
      m.addShift({ airport: "JED", kind: "interpreter", language: null, quantity: 1, starts_at: s.starts_at, ends_at: s.ends_at }),
    ).rejects.toThrow(/needs a language/);
  });

  it("adds a group and a pilgrim, edits them, and imports a sheet all or nothing", async () => {
    const m = new MockSource(NOW);
    const g = await m.createGroup({
      code: "U-PK-0401", name: "Lahore Umrah", kind: "umrah", season: "1448", origin_country: "PK",
      arrival_date: "2026-12-01", departure_date: "2026-12-14", leader_name: null, leader_phone: null,
    });
    await expect(m.createGroup({ ...g, name: "again" })).rejects.toThrow(/already exists/);
    expect((await m.updateGroup(g.id, { name: "Lahore Umrah — December" })).name).toBe("Lahore Umrah — December");

    const p = await m.createPilgrim({
      group_id: g.id, full_name: "Imran Khan", full_name_ar: null, gender: "male", date_of_birth: "1958-03-02",
      nationality: "PK", passport_no: "ab 123 4567", phone: null, language: "ur", needs: ["wheelchair"],
    });
    expect([p.passport_no, p.status, p.group_name]).toEqual(["AB1234567", "registered", "Lahore Umrah — December"]);
    expect((await m.updatePilgrim(p.id, { needs: [], phone: "+92 300" })).phone).toBe("+92 300");

    const rows: Record<string, string>[] = [
      { full_name: "Ayesha Malik", gender: "F", nationality: "pk", passport_no: "AB7654321", date_of_birth: "01/07/1980", needs: "medical" },
      { full_name: "", gender: "x", nationality: "PK", passport_no: "AB1234567" },
    ];
    const dry = await m.importPilgrims(g.id, rows, true);
    expect(dry.valid).toBe(1);
    expect(dry.errors).toEqual([
      { row: 2, field: "full_name", message: "required" },
      { row: 2, field: "gender", message: "male or female (M or F)" },
    ]);
    expect((await m.importPilgrims(g.id, rows, false)).saved).toBe(false);
    expect((await m.pilgrims({ group_id: g.id })).total).toBe(1);
    const ok = await m.importPilgrims(g.id, rows.slice(0, 1), false);
    expect(ok).toEqual({ rows: 1, valid: 1, errors: [], saved: true });
    const ayesha = (await m.pilgrims({ group_id: g.id, q: "ayesha" })).items[0];
    expect([ayesha.date_of_birth, ayesha.needs]).toEqual(["1980-07-01", ["medical"]]);
    expect((await m.importPilgrims(g.id, rows.slice(0, 1), true)).errors[0].message).toBe("already registered with this operator");
  });

  it("keeps a live incident queue: raise, assign, resolve, reopen, with every step", async () => {
    const m = new MockSource(NOW);
    const q = await m.incidents({});
    expect(q.items.map((i) => i.kind)).toEqual(["sos", "heat", "lost"]);
    expect(q.items[0]).toMatchObject({ status: "open", group_code: "U-PK-0318", allowed: ["assign", "resolve"] });
    expect(q.stats).toMatchObject({ open: 2, assigned: 1, urgent: 1 });
    expect(q.stats.minutes_to_assign).toBe(8);
    expect(q.teams[0]).toBe("Madinah field team");

    const { items } = await m.pilgrims({ status: "in_makkah", limit: 1 });
    const raised = await m.raiseIncident({
      kind: "medical", priority: "urgent", pilgrim_id: items[0].id, group_id: null, location: null, description: "Fell on the stairs.",
    });
    expect(raised.group_id).toBe(items[0].group_id);
    await m.assignIncident(raised.id, "Makkah field team");
    const done = await m.resolveIncident(raised.id, "Taken to the clinic.");
    expect(done.allowed).toEqual(["reopen"]);
    await expect(m.assignIncident(raised.id, "x")).rejects.toThrow(/cannot assign an incident that is resolved/);
    const again = await m.reopenIncident(raised.id, "Pain again");
    expect(again.history.map((h) => h.kind)).toEqual(["opened", "assigned", "resolved", "reopened"]);
    expect((await m.incidents({ pilgrim_id: items[0].id, status: "all" })).items).toHaveLength(1);
  });
});
