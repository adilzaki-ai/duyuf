import { describe, expect, it } from "vitest";
import { csvLine, parseCsv } from "../csv";

describe("reading a CSV", () => {
  it("reads what a spreadsheet writes", () => {
    const text =
      '﻿Full Name,gender,needs\r\n"Khan, Imran",M,"wheelchair; medical"\r\n\r\n"Said ""Abu"" Ali",m,\r\nلينا حداد,F,elderly\n';
    const { columns, rows } = parseCsv(text);
    expect(columns).toEqual(["full_name", "gender", "needs"]);
    expect(rows).toEqual([
      { full_name: "Khan, Imran", gender: "M", needs: "wheelchair; medical" },
      { full_name: 'Said "Abu" Ali', gender: "m", needs: "" },
      { full_name: "لينا حداد", gender: "F", needs: "elderly" },
    ]);
  });

  it("takes semicolons as the separator when the header uses them", () => {
    expect(parseCsv("full_name;gender\nImran;M").rows).toEqual([{ full_name: "Imran", gender: "M" }]);
  });

  it("keeps a line break inside quotes, and fills short lines with blanks", () => {
    expect(parseCsv('a,b,c\n"one\ntwo",x').rows).toEqual([{ a: "one\ntwo", b: "x", c: "" }]);
  });

  it("writes cells back so it reads them the same", () => {
    const cells = ["Khan, Imran", 'say "hi"', "plain"];
    expect(parseCsv(`a,b,c\n${csvLine(cells)}`).rows[0]).toEqual({ a: cells[0], b: cells[1], c: cells[2] });
    expect(parseCsv("")).toEqual({ columns: [], rows: [] });
  });
});
