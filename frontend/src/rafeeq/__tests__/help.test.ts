import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_KINDS, RAFEEQ_LANGUAGES } from "../help";
import { RAFEEQ_TABLE_LINES } from "../RafeeqApp";
import { WORDS } from "../words";

/* The platform's tables, read from its own source, so the two cannot drift. */
const py = readFileSync(resolve(__dirname, "../../../../backend/api/duyuf/rafeeq/help.py"), "utf8");

describe("Rafeeq's tables", () => {
  it("offer the platform's languages and calls exactly", () => {
    const langs = /LANGUAGES = \(([^)]*)\)/.exec(py)![1];
    expect([...langs.matchAll(/"(\w+)"/g)].map((m) => m[1])).toEqual([...RAFEEQ_LANGUAGES]);
    const help = py.slice(py.indexOf("HELP:"), py.indexOf("}", py.indexOf("HELP:")));
    expect([...help.matchAll(/^\s+"(\w+)":/gm)].map((m) => m[1])).toEqual([...HELP_KINDS]);
  });
});

describe("Rafeeq's words", () => {
  it("say every line in all six languages", () => {
    const files = [resolve(__dirname, ".."), resolve(__dirname, "../../features/rafeeq")].flatMap((dir) =>
      readdirSync(dir)
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => join(dir, f)),
    );
    const used = new Set(RAFEEQ_TABLE_LINES);
    for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/\b(?:say|s)\(\s*"([^"]+)"/g)) used.add(m[1]);
    const missing = [...used].filter((en) => !(en in WORDS));
    expect(missing).toEqual([]);
    for (const [en, others] of Object.entries(WORDS))
      for (const l of RAFEEQ_LANGUAGES.filter((x) => x !== "en"))
        expect(others[l as Exclude<typeof l, "en">]?.trim(), `${en} in ${l}`).toBeTruthy();
  });

  it("keep each {placeholder} in every language", () => {
    for (const [en, others] of Object.entries(WORDS)) {
      const want = [...en.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
      for (const [l, text] of Object.entries(others))
        expect([...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(), `${en} in ${l}`).toEqual(want);
    }
  });
});
