import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { prompt, RULES } from "../askRules";
import { MockRafeeq } from "../mockRafeeq";
import { RafeeqApp } from "../RafeeqApp";

afterEach(() => {
  localStorage.clear();
  delete (globalThis as { claude?: unknown }).claude;
});

describe("the cover", () => {
  it("lets the pilgrim pick a language, then Start opens Rafeeq", async () => {
    render(<RafeeqApp start={async () => new MockRafeeq("rfq_any")} cover />);
    expect(screen.getByRole("heading", { name: "Your companion for Hajj and Umrah." })).toBeInTheDocument();
    expect(screen.getByText("Hajj and Umrah companion")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "العربية" }));
    expect(screen.getByRole("heading", { name: "رفيقك في الحج والعمرة." })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ابدأ" }));
    expect(await screen.findByRole("heading", { name: /^السلام عليكم/ })).toBeInTheDocument();
    expect(localStorage.getItem("rafeeq.welcomed")).toBe("true");
  });
});

describe("Ask Rafeeq", () => {
  it("reads its rules from the server's own file", () => {
    expect(RULES).toMatch(/^You are Rafeeq, a companion on a pilgrim's phone/);
    expect(RULES).toContain("You give no religious rulings");
    expect(RULES).not.toContain("\\\n");
  });

  it("asks Claude through the viewer, shows the answer and the button it suggests", async () => {
    const sent: string[] = [];
    (globalThis as { claude?: unknown }).claude = {
      use: async (name: string) =>
        name === "sample"
          ? {
              json: async (input: string) => {
                sent.push(input);
                return { answer: "Your group gathers in the hotel lobby. Let me show you the way.", action: "find_my_way" };
              },
            }
          : null,
    };
    render(<RafeeqApp start={async () => new MockRafeeq("rfq_any")} />);
    await userEvent.click(await screen.findByRole("button", { name: /^Ask Rafeeq/ }));
    await userEvent.click(screen.getByRole("button", { name: "Where is my group?" }));
    expect(await screen.findByText("Your group gathers in the hotel lobby. Let me show you the way.")).toBeInTheDocument();
    /* the same rules, the pilgrim's own page, in their language; never their passport */
    expect(sent[0]).toContain("You are Rafeeq");
    expect(sent[0]).toContain("Answer in English.");
    expect(sent[0]).toContain('"meeting_point":"Hotel lobby, Al-Salam street"');
    expect(sent[0]).not.toMatch(/passport/i);
    await userEvent.click(screen.getByRole("button", { name: "Find my way" }));
    expect(screen.getByRole("heading", { name: "Find my way" })).toBeInTheDocument();
  });

  it("outside the viewer, the sample says plainly that answers come in the real app", async () => {
    render(<RafeeqApp start={async () => new MockRafeeq("rfq_any")} />);
    await userEvent.click(await screen.findByRole("button", { name: /^Ask Rafeeq/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Type your question" }), "Where is the water?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    const chat = screen.getByText("Where is the water?").closest("div")!;
    expect(await within(chat).findByText("Sample: Ask Rafeeq answers in the real app.")).toBeInTheDocument();
  });

  it("a prompt carries only the last three turns", () => {
    const page = { full_name: "Agus Hidayat", group_name: "G", leader_name: "L", leader_phone: null, meeting: null, group_now: null,
      consent: { health: false, location: false }, health: null, calls: [], alert: null } as never;
    const history = [1, 2, 3, 4].map((n) => ({ question: `q${n}`, answer: `a${n}` }));
    const p = prompt("now?", "fr", page, history);
    expect(p).not.toContain("q1");
    expect(p).toContain("q4");
    expect(p).toContain("Answer in French.");
    expect(p).not.toContain("Hidayat");
  });
});
