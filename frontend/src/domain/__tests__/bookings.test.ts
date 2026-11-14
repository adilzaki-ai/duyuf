import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOKING_MOVES, BOOKING_STATUSES, STAFF_ACTIONS, VENUE_KINDS, staffActions } from "../bookings";

const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/bookings/flow.py"), "utf8");
const tuple = (name: string) => [...new RegExp(`^${name} = \\(([^)]*)\\)`, "m").exec(py)![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);

describe("a booking's journey", () => {
  it("has the platform's statuses, kinds and staff actions", () => {
    expect([...BOOKING_STATUSES]).toEqual(tuple("STATUSES"));
    expect([...VENUE_KINDS]).toEqual(tuple("KINDS"));
    expect([...STAFF_ACTIONS]).toEqual(tuple("STAFF_ACTIONS"));
  });

  it("allows the platform's moves exactly", () => {
    const block = py.slice(py.indexOf("MOVES:"), py.indexOf("}", py.indexOf("MOVES:")));
    const moves = Object.fromEntries(
      [...block.matchAll(/"(\w+)": \(\(([^)]*)\), "(\w+)"\)/g)].map((m) => [m[1], { from: [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1]), to: m[3] }]),
    );
    expect(moves).toEqual(JSON.parse(JSON.stringify(BOOKING_MOVES)));
  });

  it("offers staff only what they can do from here", () => {
    expect(staffActions("requested")).toEqual(["confirm", "ask_payment", "decline", "cancel"]);
    expect(staffActions("confirmed")).toEqual(["cancel"]);
    expect(staffActions("declined")).toEqual([]);
  });
});
