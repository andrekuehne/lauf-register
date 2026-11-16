// Reading what an Admin types as a Reserved number or range, and showing a Race's
// Reserved numbers as ranges, each a single number or a run (see GLOSSARY.md: Reserved number).

import { describe, expect, it } from "vitest";
import { formatRange, parseReservedRange, reservedRanges } from "../src/domain/reserved-numbers";

describe("parseReservedRange", () => {
  it.each([
    ["13", 13, 13],
    [" 13 ", 13, 13],
    ["900-950", 900, 950],
    ["900–950", 900, 950],
    ["900 - 950", 900, 950],
    ["  900 – 950 ", 900, 950],
    ["1", 1, 1],
    ["1999", 1999, 1999],
    ["1000-1000", 1000, 1000],
  ])("reads %j as %i–%i", (text, from, to) => {
    expect(parseReservedRange(text)).toEqual({ ok: true, from, to });
  });

  it.each(["", "  ", "abc", "13a", "1,5", "-13", "13-", "1-2-3", "12 13", "1.5"])("refuses %j as unreadable", (text) => {
    expect(parseReservedRange(text)).toEqual({
      ok: false,
      error: "Bitte eine Startnummer (z. B. 13) oder einen Bereich (z. B. 900-950) eingeben.",
    });
  });

  it.each(["0", "2000", "0-5", "1990-2005", "99999"])("refuses %j as outside 1–1999", (text) => {
    expect(parseReservedRange(text)).toEqual({ ok: false, error: "Startnummern gehen von 1 bis 1999." });
  });

  it("refuses a range whose first number is the larger one", () => {
    expect(parseReservedRange("950-900")).toEqual({
      ok: false,
      error: "Bei einem Bereich bitte die kleinere Zahl zuerst eingeben (z. B. 900-950).",
    });
  });
});

describe("reservedRanges", () => {
  it("is empty without Reserved numbers", () => {
    expect(reservedRanges([])).toEqual([]);
  });

  it("shows single numbers and runs of consecutive numbers as ranges, sorted", () => {
    expect(reservedRanges([952, 13, 950, 951, 900])).toEqual([
      { from: 13, to: 13 },
      { from: 900, to: 900 },
      { from: 950, to: 952 },
    ]);
  });

  it("merges overlapping and adjacent numbers: 105 and 108–120, then 100–110, are 100–120", () => {
    const before = [105, ...range(108, 120)];
    expect(reservedRanges(before)).toEqual([
      { from: 105, to: 105 },
      { from: 108, to: 120 },
    ]);
    // Reserving a range adds its numbers; the same number twice counts once.
    expect(reservedRanges([...before, ...range(100, 110)])).toEqual([{ from: 100, to: 120 }]);
  });
});

describe("formatRange", () => {
  it("shows a single number as itself and a range with an en dash", () => {
    expect(formatRange({ from: 13, to: 13 })).toBe("13");
    expect(formatRange({ from: 900, to: 950 })).toBe("900–950");
  });
});

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
