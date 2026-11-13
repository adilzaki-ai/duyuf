import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DataSourceError } from "../../api/dataSource";
import { MockRafeeq } from "../mockRafeeq";
import { RafeeqApp } from "../RafeeqApp";
import type { RafeeqSource } from "../source";

afterEach(() => localStorage.clear());

const sample = (token = "rfq_any") => async () => new MockRafeeq(token);

/** The sample page, except that calls for help never get through. */
class NoSignal extends MockRafeeq {
  async help(): Promise<never> {
    throw new DataSourceError("the platform cannot be reached");
  }
}

const tel = (n: string) => screen.getAllByRole("link").filter((a) => a.getAttribute("href") === `tel:${n}`);

describe("Rafeeq", () => {
  it("without a card, says how to open it and still gives the emergency numbers", async () => {
    render(<RafeeqApp start={async () => null} />);
    expect(await screen.findByText("Scan the QR code on your Rafeeq card to open this page.")).toBeInTheDocument();
    expect(tel("911")).toHaveLength(1);
    expect(tel("997")).toHaveLength(1);
  });

  it("sends a call for help after one check, follows it, and hears that they are fine", async () => {
    render(<RafeeqApp start={sample()} />);
    expect(await screen.findByRole("heading", { name: /^Assalamu alaikum, / })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sample: nothing is sent to anyone.");
    expect(tel("911")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /SOS/ }));
    const ask = screen.getByRole("alertdialog");
    expect(ask).toHaveTextContent("Send a call for help now?");
    await userEvent.click(within(ask).getByRole("button", { name: "Yes, send" }));

    const call = (await screen.findByText("Your call for help was received.")).closest("section")!;
    expect(call).toHaveTextContent("#2001");
    await userEvent.click(within(call).getByRole("button", { name: "I am fine now" }));
    expect(await within(call).findByText("You said you are fine.")).toBeInTheDocument();
  });

  it("never says a call went out when it did not, and shows who to call", async () => {
    render(<RafeeqApp start={async () => new NoSignal("rfq_any")} />);
    await userEvent.click(await screen.findByRole("button", { name: "I am lost" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, send" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your call was NOT sent. Call now:");
    expect(within(alert).getByText("Your group leader")).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Your call for help was received.")).not.toBeInTheDocument();
  });

  it("says when a card was stopped", async () => {
    const stopped: RafeeqSource = {
      kind: "platform",
      me: async () => {
        throw new DataSourceError("this card no longer works", { status: 401 });
      },
      help: async () => {
        throw new Error("unused");
      },
      fine: async () => {
        throw new Error("unused");
      },
    };
    render(<RafeeqApp start={async () => stopped} />);
    expect(await screen.findByText("This card no longer works. Ask your group leader for a new one.")).toBeInTheDocument();
    expect(tel("911")).toHaveLength(1);
  });

  it("with no signal, shows what was saved on the phone, leader's number included", async () => {
    const first = render(<RafeeqApp start={sample()} />);
    await screen.findByRole("heading", { name: /^Assalamu alaikum, / });
    first.unmount();
    const offline = new MockRafeeq("rfq_any");
    offline.me = async () => {
      throw new DataSourceError("the platform cannot be reached");
    };
    render(<RafeeqApp start={async () => offline} />);
    expect(await screen.findByText("No connection. This is what was saved on your phone.")).toBeInTheDocument();
    expect(screen.getByText("Your group leader")).toBeInTheDocument();
  });

  it("opens in the card's language, right to left for Urdu, and the pilgrim can change it", async () => {
    render(<RafeeqApp start={sample("rfq_sample.p-3.ur")} />);
    expect(await screen.findByRole("heading", { name: /^السلام علیکم، / })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("button", { name: /ایمرجنسی/ })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "زبان" }), "fr");
    expect(await screen.findByRole("button", { name: "Je suis perdu(e)" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
    expect(localStorage.getItem("rafeeq.lang")).toBe('"fr"');
  });
});
