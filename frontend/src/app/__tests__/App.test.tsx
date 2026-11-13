import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MockSource } from "../../api/mockSource";
import { App } from "../App";

const start = async () => {
  const source = new MockSource(new Date("2026-11-12T09:00:00+03:00"));
  return { source, me: await source.me() };
};

describe("Duyuf on the sample", () => {
  it("opens on the overview, says it is the sample, and switches to Arabic", async () => {
    render(<App start={start} />);
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sample data");
    expect(screen.getByText("Cairo Umrah")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Language" }));
    expect(await screen.findByRole("heading", { name: "نظرة عامة" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    await userEvent.click(screen.getByRole("button", { name: "اللغة" }));
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("moves a pilgrim one step from the pilgrims screen", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Pilgrims" }));
    await userEvent.selectOptions(await screen.findByDisplayValue("All stages"), "registered");
    const rows = await screen.findAllByRole("row");
    await userEvent.click(rows[1]);
    const panel = await screen.findByRole("complementary");
    await userEvent.click(await within(panel).findByRole("button", { name: "Visa issued" }));
    expect(await within(panel).findAllByText("Visa issued")).not.toHaveLength(0);
    expect(await within(panel).findByRole("button", { name: "Arrived" })).toBeInTheDocument();
  });

  it("shows the arrivals board, opens a flight and marks it landed", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Arrivals" }));
    expect(await screen.findByRole("heading", { name: "Arrival wave" })).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    const attention = screen.getByText("should have landed. Confirm it.", { exact: false }).closest("li")!;
    expect(attention).toHaveTextContent("PK 743");
    await userEvent.click(screen.getAllByRole("link", { name: "MS 683" })[0]);
    expect(await screen.findByRole("heading", { name: "MS 683" })).toBeInTheDocument();
    expect(screen.getByText("1 with no visa yet. They will not move to Arrived.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mark landed" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, MS 683 is down" }));
    expect(await screen.findByText(/29 moved to Arrived\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark landed" })).not.toBeInTheDocument();
  });

  it("shows a gap, then a what-if that closes it", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Arrivals" }));
    expect(await screen.findByText(/short of Wheelchairs 1, Interpreters \(Indonesian\) 1\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "What if…" }));
    await userEvent.click(screen.getByRole("button", { name: "+ More resources" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Kind" }), "interpreter");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Language" }), "id");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Airport" }), "MED");
    await userEvent.click(screen.getByRole("button", { name: "Show what-if" }));
    const banner = await screen.findByText("What-if view. Nothing is saved.");
    expect(banner.closest("div")).toHaveTextContent("Gaps: 2 now, 1 with these changes.");
    expect(screen.getByText(/short of Wheelchairs 1\./)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Back to live" })[0]);
    expect(await screen.findByText(/Interpreters \(Indonesian\) 1\./)).toBeInTheDocument();
  });

  it("lists resources on shift and removes one", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Arrivals" }));
    await userEvent.click(await screen.findByRole("link", { name: "Resources" }));
    expect(await screen.findByRole("heading", { name: "Resources" })).toBeInTheDocument();
    const rows = () => screen.getAllByRole("row").length;
    const before = rows();
    await userEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    await vi.waitFor(() => expect(rows()).toBe(before - 1));
  });

  it("adds a group, then a pilgrim into it from the group's page", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Groups" }));
    await userEvent.click(await screen.findByRole("button", { name: "New group" }));
    await userEvent.type(screen.getByLabelText("Code"), "u-pk-0401");
    await userEvent.type(screen.getByLabelText("Name"), "Lahore Umrah");
    await userEvent.selectOptions(screen.getByLabelText("From"), "PK");
    await userEvent.click(screen.getByRole("button", { name: "Save group" }));
    expect(await screen.findByRole("heading", { name: "Lahore Umrah" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add pilgrim" }));
    const form = screen.getByRole("heading", { name: "Add a pilgrim" }).closest("section")!;
    await userEvent.type(within(form).getByLabelText("Name"), "Imran Khan");
    await userEvent.type(within(form).getByLabelText("Passport"), "AB1234567");
    await userEvent.click(within(form).getByLabelText("Wheelchair"));
    await userEvent.click(within(form).getByRole("button", { name: "Add pilgrim" }));
    expect(await within(form).findByText("Imran Khan added.")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "Imran Khan" })).toBeInTheDocument();
  });

  it("checks a CSV before adding it, and adds it when clean", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Groups" }));
    await userEvent.click(await screen.findByText("Dhaka Umrah"));
    await userEvent.click(await screen.findByRole("button", { name: "Import from CSV" }));
    const bad = new File(["full_name,gender,nationality,passport_no\nRahim Uddin,M,BD,BX1234567\n,Q,BD,1\n"], "g.csv", {
      type: "text/csv",
    });
    await userEvent.upload(screen.getByLabelText("CSV file"), bad);
    expect(await screen.findByText("1 of 2 rows are ready.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add pilgrims" })).toBeDisabled();
    const good = new File(["full_name,gender,nationality,passport_no\nRahim Uddin,M,BD,BX1234567\n"], "g.csv", {
      type: "text/csv",
    });
    await userEvent.upload(screen.getByLabelText("CSV file"), good);
    await userEvent.click(await screen.findByRole("button", { name: "Add 1 pilgrims" }));
    expect(await screen.findByText("1 pilgrims added to the group.")).toBeInTheDocument();
  });

  it("works an incident from the queue: give it to a team, then resolve it", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Incidents" }));
    expect(await screen.findByText("Pressed SOS. Not answering the phone.")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Pressed SOS. Not answering the phone."));
    const panel = await screen.findByRole("complementary");
    await userEvent.type(within(panel).getByRole("combobox", { name: "Team" }), "Makkah field team");
    await userEvent.click(within(panel).getByRole("button", { name: "Give to team" }));
    expect(await within(panel).findByText("Given to Makkah field team")).toBeInTheDocument();
    await userEvent.type(within(panel).getByRole("textbox", { name: "Note" }), "Found at gate 79, safe.");
    await userEvent.click(within(panel).getByRole("button", { name: "Resolve" }));
    expect(await within(panel).findByRole("button", { name: "Open again" })).toBeInTheDocument();
  });

  it("reports an incident for a pilgrim from the pilgrim's panel", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Pilgrims" }));
    const rows = await screen.findAllByRole("row");
    await userEvent.click(rows[1]);
    const panel = await screen.findByRole("complementary");
    await userEvent.click(await within(panel).findByRole("link", { name: "Report an incident" }));
    expect(await screen.findByRole("heading", { name: "Report an incident" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("What happened"), "Lost their bag at the hotel.");
    await userEvent.click(screen.getByRole("button", { name: "Raise incident" }));
    const opened = await screen.findByRole("complementary");
    expect(await within(opened).findByText("Lost their bag at the hotel.")).toBeInTheDocument();
  });
});
