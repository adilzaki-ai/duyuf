import { describe, expect, it } from "vitest";
import { calendarFile, localTime, reminders } from "../flightsHome";
import { MockRafeeq } from "../mockRafeeq";
import type { ReturnLeg } from "../source";

const leg = (departs: string, from = "MED", to = "JED"): ReturnLeg => ({
  seq: 1,
  flight_number: "SV 1466",
  from_airport: from,
  to_airport: to,
  departs_at: departs,
  arrives_at: new Date(Date.parse(departs) + 70 * 60_000).toISOString(),
});

describe("going home", () => {
  const now = new Date("2026-11-14T09:00:00+03:00");

  it("reminds from three days out, louder the day before and on the day", () => {
    expect(reminders([leg("2026-11-18T08:10:00+03:00")], null, now)).toEqual([]);
    expect(reminders([leg("2026-11-17T08:10:00+03:00")], null, now)).toEqual([{ level: "info", line: "Your flight home is in {n} days.", vars: { n: 3 } }]);
    const tomorrow = reminders([leg("2026-11-15T08:10:00+03:00")], null, now);
    expect(tomorrow[0]).toMatchObject({ level: "soon", vars: { time: "08:10" } });
    expect(tomorrow[1].line).toMatch(/bus/);
    expect(reminders([leg("2026-11-14T22:30:00+03:00")], null, now)[0].level).toBe("today");
    /* gone: nothing */
    expect(reminders([leg("2026-11-14T06:00:00+03:00")], null, now)).toEqual([]);
  });

  it("adds the visa when it has three days or fewer", () => {
    expect(reminders([], "2026-11-16", now)).toEqual([{ level: "soon", line: "Your visa ends in {n} days.", vars: { n: 2 } }]);
    expect(reminders([], "2026-11-14", now)[0].line).toBe("Your visa ends today.");
    expect(reminders([], "2026-11-30", now)).toEqual([]);
  });

  it("shows landing in the destination's own time", () => {
    expect(localTime("2026-11-20T10:40:00Z", "CGK", "en").time).toBe("17:40");
    expect(localTime("2026-11-20T10:40:00Z", "JED", "en")).toMatchObject({ time: "13:40", saudi: true });
  });

  it("writes a calendar file with two reminders a flight and one for the visa", () => {
    const ics = calendarFile([leg("2026-11-20T08:10:00+03:00")], "2026-12-01", { flight: () => "Flight home, MED to JED", visa: "Last day of your visa" });
    expect(ics).toContain("DTSTART:20261120T051000Z");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(3);
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261201");
    expect(ics).toContain("SUMMARY:Flight home\\, MED to JED");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});

describe("food and hotels on the sample", () => {
  it("lists the places, takes a request, answers it, and takes the test payment", async () => {
    const src = new MockRafeeq("rfq_any");
    const { venues, payments } = await src.venues("hotel", "madinah");
    expect(payments.online).toBe("sandbox");
    expect(venues.length).toBeGreaterThan(4);
    expect(venues.every((v) => v.stars! >= 2 && v.stars! <= 5 && v.rating_source === "Sample")).toBe(true);

    const hotel = venues[0];
    await expect(src.book({ venue_id: hotel.id, for_date: "2026-12-01", people: 3 })).rejects.toThrow(/nights/);
    await expect(src.book({ venue_id: hotel.id, for_date: "2026-12-01", nights: 2, people: 3 })).rejects.toThrow(/room type/);
    /* three people do not fit one double room */
    await expect(src.book({ venue_id: hotel.id, for_date: "2026-12-01", nights: 2, people: 3, room_type: "double" })).rejects.toThrow(/bigger room/);
    const { booking } = await src.book({
      venue_id: hotel.id,
      for_date: "2026-12-01",
      nights: 2,
      people: 3,
      rooms: 2,
      room_type: "double",
      bed: "king",
      access_needs: ["wheelchair_room"],
    });
    expect((await src.bookings()).bookings[0]).toMatchObject({ rooms: 2, room_type: "double", bed: "king", access_needs: ["wheelchair_room"] });
    expect((await src.bookings()).bookings[0].status).toBe("requested");

    /* the operator's simulated answer comes after a few seconds */
    const real = Date.now;
    Date.now = () => real() + 6_000;
    try {
      const b = (await src.bookings()).bookings.find((x) => x.id === booking)!;
      expect(b.status).toBe("awaiting_payment");
      /* two double rooms, two nights */
      expect(b.amount).toBe(hotel.price_from! * 2 * 2);
      await expect(src.pay(booking, "5555 5555 5555 4444")).rejects.toThrow(/test card/);
      const paid = (await src.pay(booking, "4242 4242 4242 4242")).bookings[0];
      expect(paid).toMatchObject({ status: "confirmed", payment_status: "paid" });
      await expect(src.cancelBooking(booking)).rejects.toThrow(/group leader/);
    } finally {
      Date.now = real;
    }
  });

  it("gives the sample pilgrim their group's flights home", async () => {
    const page = await new MockRafeeq("rfq_any").me();
    expect(page.return_legs?.map((l) => `${l.from_airport}-${l.to_airport}`)).toEqual(["MED-JED", "JED-CGK"]);
  });
});
