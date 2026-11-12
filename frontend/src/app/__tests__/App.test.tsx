import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
});
