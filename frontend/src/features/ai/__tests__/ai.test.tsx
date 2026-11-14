import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MockSource } from "../../../api/mockSource";
import { App } from "../../../app/App";
import { instruction } from "../../../ai/viewerAi";

const start = async () => {
  const source = new MockSource(new Date("2026-11-12T09:00:00+03:00"));
  return { source, me: await source.me() };
};

/* a stand-in for the Claude viewer: answers each helper by its instructions */
function viewer() {
  const sent: string[] = [];
  (globalThis as { claude?: unknown }).claude = {
    use: async (name: string) =>
      name === "sample"
        ? {
            json: async (input: string) => {
              sent.push(input);
              if (input.startsWith("You write the shift briefing"))
                return {
                  headline: "Madinah is short of wheelchairs for the morning wave.",
                  points: [
                    { text: "Madinah short 1 wheelchair, Thu 06:00.", tone: "act", screen: "arrivals" },
                    { text: "An SOS is waiting for a team.", tone: "act", screen: "incidents" },
                    { text: "Most pilgrims are settled in Madinah.", tone: "ok", screen: "overview" },
                  ],
                  first_action: { text: "Give the SOS to a team.", screen: "incidents" },
                };
              if (input.startsWith("You help the operations desk"))
                return {
                  summary: "SOS at gate 79; the pilgrim is not answering.",
                  priority_ok: true,
                  suggested_priority: "urgent",
                  team: "Makkah field team",
                  next_step: "Send the field team to gate 79 now.",
                  message_to_leader: { language: "ur", text: "براہ کرم فوراً رابطہ کریں۔", english: "Please get in touch at once." },
                  message_to_pilgrim: { language: "ur", text: "اپنی جگہ پر رہیں۔", english: "Stay where you are." },
                };
              return {
                summary: "Two gaps at Madinah in the morning.",
                items: [{ gap: 1, explain: "More wheelchair users than on shift.", fix: "Add one wheelchair at Madinah.", extra: { airport: "MED", kind: "wheelchair", language: null, quantity: 1 } }],
              };
            },
          }
        : null,
  };
  return sent;
}

afterEach(() => {
  delete (globalThis as { claude?: unknown }).claude;
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("the AI helpers", () => {
  it("brief the shift on the Overview, from totals only, by the server's own instructions", async () => {
    const sent = viewer();
    render(<App start={start} />);
    expect(await screen.findByText("Madinah is short of wheelchairs for the morning wave.")).toBeInTheDocument();
    expect(screen.getAllByText("Act now")).toHaveLength(2);
    expect(screen.getByText(/Give the SOS to a team\./).closest("a")).toHaveAttribute("href", "/incidents");
    expect(sent[0].startsWith(instruction("BRIEF"))).toBe(true);
    expect(sent[0]).not.toMatch(/passport/i);
  });

  it("help with an incident and give it to the suggested team in one press", async () => {
    viewer();
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Incidents" }));
    await userEvent.click((await screen.findAllByRole("row"))[1]);
    const panel = await screen.findByRole("complementary");
    await userEvent.click(await within(panel).findByRole("button", { name: "Ask the co-pilot" }));
    expect(await within(panel).findByText("SOS at gate 79; the pilgrim is not answering.")).toBeInTheDocument();
    expect(within(panel).getByText("اپنی جگہ پر رہیں۔")).toBeInTheDocument();
    await userEvent.click(within(panel).getAllByRole("button", { name: "Show in English" })[1]);
    expect(within(panel).getByText("Stay where you are.")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Give to Makkah field team" }));
    expect(await within(panel).findByText(/Suggested by the co-pilot/)).toBeInTheDocument();
  });

  it("explain the arrival gaps, and preview a fix on the board", async () => {
    viewer();
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("link", { name: "Arrivals" }));
    await userEvent.click(await screen.findByRole("button", { name: "Explain the gaps" }));
    expect(await screen.findByText("Two gaps at Madinah in the morning.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview this fix" }));
    expect(await screen.findByText("What-if view. Nothing is saved.")).toBeInTheDocument();
  });

  it("say plainly when there is no AI, and still find a group from the Ask bar", async () => {
    render(<App start={start} />);
    expect(await screen.findByText(/The AI helpers are not set up on this server yet/)).toBeInTheDocument();
    const bar = screen.getByRole("combobox", { name: "Ask anything, or find a name" });
    await userEvent.type(bar, "Lahore");
    await userEvent.click(await screen.findByRole("option", { name: /Lahore Umrah/ }));
    expect(await screen.findByRole("heading", { name: "Lahore Umrah" })).toBeInTheDocument();
  });

  it("switch to the dark operations room and back", async () => {
    render(<App start={start} />);
    await userEvent.click(await screen.findByRole("button", { name: "Dark screen" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await userEvent.click(screen.getByRole("button", { name: "Light screen" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
