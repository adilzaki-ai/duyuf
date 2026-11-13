import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DataSourceError } from "../../api/dataSource";
import sampleData from "../../../../sample/demo.json";
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
    /* "I am lost" shows the way first; sending for help is one press further */
    await userEvent.click(await screen.findByRole("button", { name: /^I am lost/ }));
    await userEvent.click(screen.getByRole("button", { name: "I am still lost: send for help" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, send" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your call was NOT sent. Call now:");
    expect(within(alert).getByText("Your group leader")).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Your call for help was received.")).not.toBeInTheDocument();
  });

  it("says when a card was stopped", async () => {
    const stopped: RafeeqSource = new MockRafeeq("rfq_any");
    stopped.me = async () => {
      throw new DataSourceError("this card no longer works", { status: 401 });
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
    expect(await screen.findByRole("button", { name: /^Je suis perdu\(e\)/ })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
    expect(localStorage.getItem("rafeeq.lang")).toBe('"fr"');
  });
});

describe("Find my way", () => {
  it("offers the way to the group, its meeting point and the holy sites, with help one press away", async () => {
    /* a Jakarta pilgrim: four others in the group share their place in the sample */
    const index = sampleData.pilgrims.findIndex((p, i, all) => p.group_code === "U-ID-0412" && all.slice(0, i).filter((x) => x.group_code === "U-ID-0412").length === 5);
    render(<RafeeqApp start={async () => new MockRafeeq(`rfq_sample.p-${index}.en`)} />);
    await userEvent.click(await screen.findByRole("button", { name: /^I am lost/ }));
    expect(screen.getByRole("heading", { name: "Find my way" })).toBeInTheDocument();
    const choices = within(screen.getByRole("group", { name: "Where do you want to go?" })).getAllByRole("button");
    expect(choices[0]).toHaveTextContent("Where most of your group is now4 people");
    expect(choices[0]).toHaveAttribute("aria-pressed", "true");
    expect(choices[1]).toHaveTextContent("Meeting pointHotel lobby, Al-Salam street");
    /* the sample pilgrim stands near the Prophet's Mosque, so the sites come with distances, Madinah's only */
    expect(choices.some((c) => /^The Prophet's Mosque\d+ m$/.test(c.textContent ?? ""))).toBe(true);
    expect(choices.some((c) => c.textContent?.startsWith("Mina"))).toBe(false);
    const walk = screen.getByRole("link", { name: "Open walking directions" });
    expect(walk.getAttribute("href")).toMatch(/destination=24\.4\d+,39\.6\d+&travelmode=walking/);
    await userEvent.click(choices[1]);
    expect(screen.getByRole("link", { name: "Open walking directions" }).getAttribute("href")).toContain("destination=24.4689,39.6081");
    await userEvent.click(screen.getByRole("button", { name: "I am still lost: send for help" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Send a call for help now?");
  });
});
