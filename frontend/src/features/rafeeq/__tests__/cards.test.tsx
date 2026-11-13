import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MockSource } from "../../../api/mockSource";
import { App } from "../../../app/App";
import { mapLink } from "../../incidents/IncidentPanel";

const start = async () => {
  const source = new MockSource(new Date("2026-11-12T09:00:00+03:00"));
  return { source, me: await source.me() };
};

describe("Rafeeq cards", () => {
  it("are made from a pilgrim's panel, with a code that opens their page", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Pilgrims" }));
    await userEvent.selectOptions(await screen.findByDisplayValue("All stages"), "in_madinah");
    await userEvent.click((await screen.findAllByRole("row"))[1]);
    const panel = await screen.findByRole("complementary");
    expect(await within(panel).findByText("No card yet.")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Make a card" }));
    await userEvent.click(within(panel).getAllByRole("button", { name: "Make a card" }).at(-1)!);

    expect(await within(panel).findByRole("img", { name: /^Rafeeq card for / })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open page" }).getAttribute("href")).toMatch(/\/r#rfq_sample\.p-\d+\.\w\w$/);
    expect(within(panel).getByText("Print or send this now. The link is shown only once.")).toBeInTheDocument();
    expect(await within(panel).findByText(/^Card in use since /)).toBeInTheDocument();
  });

  it("are made for a whole group as one sheet", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Groups" }));
    await userEvent.click(await screen.findByText("Jakarta Umrah"));
    await userEvent.click(await screen.findByRole("button", { name: "Rafeeq cards" }));
    await userEvent.click(screen.getByRole("button", { name: "Make cards" }));
    expect(await screen.findByText(/^\d+ cards made\.$/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /^Rafeeq card for / }).length).toBeGreaterThan(1);
  });

  it("give dispatch a map only for a place the phone sent", () => {
    expect(mapLink("24.46720, 39.61120 (±25 m)")).toBe("https://www.google.com/maps/search/?api=1&query=24.46720,39.61120");
    expect(mapLink("Prophet's Mosque, door 21")).toBeNull();
    expect(mapLink(null)).toBeNull();
  });
});
