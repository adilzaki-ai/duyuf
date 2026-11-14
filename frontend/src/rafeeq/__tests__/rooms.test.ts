import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCESS, BEDS, EXTRAS, ROOM_TYPES, SLEEPS } from "../rooms";

const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/bookings/flow.py"), "utf8");
const tuple = (name: string) => [...new RegExp(`^${name} = \\(([^)]*)\\)`, "ms").exec(py)![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);

describe("hotel room options", () => {
  it("are the platform's exactly", () => {
    expect([...ROOM_TYPES]).toEqual(tuple("ROOM_TYPES"));
    expect([...BEDS]).toEqual(tuple("BEDS"));
    expect([...ACCESS]).toEqual(tuple("ACCESS"));
    expect([...EXTRAS]).toEqual(tuple("EXTRAS"));
    const sleeps = Object.fromEntries([.../^SLEEPS = \{([^}]*)\}/m.exec(py)![1].matchAll(/"(\w+)": (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(sleeps).toEqual(SLEEPS);
  });
});
