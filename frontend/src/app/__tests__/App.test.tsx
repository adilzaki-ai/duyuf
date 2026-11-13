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
});
