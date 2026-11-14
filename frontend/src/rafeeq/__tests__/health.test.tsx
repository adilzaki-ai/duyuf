import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockSource } from "../../api/mockSource";
import { App } from "../../app/App";
import { MockRafeeq } from "../mockRafeeq";
import { RafeeqApp } from "../RafeeqApp";
import { series } from "../vitals";

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("Rafeeq health", () => {
  it("asks first, then shows heart, temperature and water in words", async () => {
    render(<RafeeqApp start={async () => new MockRafeeq("rfq_any")} />);
    const ask = await screen.findByRole("region", { name: "Your health" });
    expect(ask).toHaveTextContent("Share your heart rate and temperature with the medical team?");
    await userEvent.click(within(ask).getByRole("button", { name: "Yes, share" }));
    /* then the place, one question at a time */
    expect(await screen.findByText("Share where you are with your group's team, all the time?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Share where you are with your group's team, all the time?")).not.toBeInTheDocument();
    expect(screen.getByText("Not sharing where you are")).toBeInTheDocument();

    const panel = screen.getByRole("region", { name: "Your health" });
    expect(within(panel).getByText("Your watch has not sent readings lately.")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Try it (demonstration)"));
    await userEvent.click(screen.getByRole("button", { name: "Fever" }));
    expect(await within(panel).findByText(/^38\.\d °C$/)).toBeInTheDocument();
    expect(within(panel).getByText("Fever")).toBeInTheDocument();
    expect(within(panel).getByText("Rest in the shade and drink water. Tell your group leader.")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "I drank water" }));
    expect(await within(panel).findByText("Drank recently")).toBeInTheDocument();
  });

  it("counts down on dangerous readings, and I AM OK stops it", async () => {
    render(<RafeeqApp start={async () => new MockRafeeq("rfq_any")} />);
    await userEvent.click(await screen.findByRole("button", { name: "Yes, share" }));
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    await userEvent.click(screen.getByText("Try it (demonstration)"));
    await userEvent.click(screen.getByRole("button", { name: "Fever and fast heart" }));
    const count = await screen.findByRole("alertdialog");
    expect(count).toHaveTextContent("Your readings look dangerous.");
    expect(count).toHaveTextContent(/Calling medical help in (29|30) seconds\./);
    await userEvent.click(within(count).getByRole("button", { name: "I AM OK" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SOS/ })).toBeInTheDocument();
  });

  it("a countdown nobody stops becomes a medical call", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T09:00:00Z"));
    const m = new MockRafeeq("rfq_any");
    await m.consent({ health: true });
    const page = await m.readings(series(35, 5, 132, 38.7), "simulated");
    expect(page.alert?.reasons).toEqual(["fever_and_heart"]);
    vi.setSystemTime(new Date("2026-11-14T09:00:31Z"));
    const after = await m.me();
    expect(after.alert).toBeNull();
    expect(after.calls[0]).toMatchObject({ kind: "medical", status: "open" });
    await expect(m.iAmOk(page.alert!.id)).rejects.toThrow("too late");
  });
});

describe("the Health screen", () => {
  it("shows the demonstration's readings, the most serious first", async () => {
    const start = async () => {
      const source = new MockSource(new Date());
      return { source, me: await source.me() };
    };
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Health" }));
    expect(await screen.findByRole("heading", { name: "Health" })).toBeInTheDocument();
    expect(screen.getByText(/^Danger levels are proposed\. A doctor has not agreed them yet\./)).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toHaveTextContent("Warning");
    await userEvent.click(screen.getByRole("button", { name: "Fever" }));
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2);
    await userEvent.click(screen.getAllByRole("row")[1]);
    const panel = await screen.findByRole("complementary");
    expect(await within(panel).findByText("Latest readings")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open map" })).toBeInTheDocument();
  });
});

describe("the health panel's pictures", () => {
  it("shows the pulse on a gauge, beats at that pulse, and warns of heat exhaustion", async () => {
    render(<RafeeqApp start={async () => new MockRafeeq("rfq_any")} />);
    await userEvent.click(await screen.findByRole("button", { name: "Yes, share" }));
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    await userEvent.click(screen.getByText("Try it (demonstration)"));
    await userEvent.click(screen.getByRole("button", { name: "Heat exhaustion signs" }));
    const gauge = await screen.findByRole("meter", { name: "Heart" });
    expect(Number(gauge.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(110);
    const beat = document.querySelector("[style*='--beat']") as HTMLElement;
    expect(beat.style.getPropertyValue("--beat")).toMatch(/^0\.5\d*s$/);
    const panel = screen.getByRole("region", { name: "Your health" });
    expect(within(panel).getByText("Heat exhaustion signs")).toBeInTheDocument();
    /* heat and its warning are one: the Heat row opens by itself with the advice, said once */
    const heat = within(panel).getByRole("button", { name: /^Heat/ });
    expect(heat).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText(/Your body is getting too hot/)).toHaveLength(1);
    expect(screen.queryAllByRole("status").some((x) => x.textContent?.startsWith("Heat warning"))).toBe(false);
    /* any row opens with a tap to say more */
    const water = within(panel).getByRole("button", { name: /^Water/ });
    await userEvent.click(water);
    expect(water).toHaveAttribute("aria-expanded", "true");
    expect(within(panel).getByText("You have not told Rafeeq you drank yet.")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: /^Heart/ }));
    expect(within(panel).getByText("At rest, 60 to 100 is normal.")).toBeInTheDocument();
    expect(within(panel).getByText("Recent readings")).toBeInTheDocument();
  });

  it("knows the hottest hours on the Saudi clock", async () => {
    const { hotHours } = await import("../HealthParts");
    expect(hotHours(new Date("2026-11-14T09:30:00Z"))).toBe(true); /* 12:30 in Makkah */
    expect(hotHours(new Date("2026-11-14T14:30:00Z"))).toBe(false); /* 17:30 */
  });
});
