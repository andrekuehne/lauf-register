// Reserved numbers (see GLOSSARY.md): what an Admin types to reserve some, and
// how a Race's Reserved numbers show as ranges (a single number is a range too).

import { NUMBER_RANGES } from "./numbers";

/** A single number (from = to) or a range of Reserved numbers, both ends included. */
export type ReservedRange = { from: number; to: number };

export type ParsedRange = ({ ok: true } & ReservedRange) | { ok: false; error: string };

/** Reserved numbers lie within the Registration number ranges, singles and Pairs alike. */
const LOWEST = NUMBER_RANGES.single.from;
const HIGHEST = NUMBER_RANGES.pair.to;

/** "13", or a range "900-950"; spaces around the numbers and an en dash allowed. */
const RANGE = /^\s*(\d{1,6})\s*(?:[-–]\s*(\d{1,6})\s*)?$/;

/** Reads what the Admin typed as a number or range, or says in German what is wrong with it. */
export function parseReservedRange(text: string): ParsedRange {
  const match = RANGE.exec(text);
  if (!match) return { ok: false, error: "Bitte eine Startnummer (z. B. 13) oder einen Bereich (z. B. 900-950) eingeben." };
  const from = Number(match[1]);
  const to = match[2] === undefined ? from : Number(match[2]);
  if (from < LOWEST || to > HIGHEST || to < LOWEST || from > HIGHEST) {
    return { ok: false, error: `Startnummern gehen von ${LOWEST} bis ${HIGHEST}.` };
  }
  if (from > to) return { ok: false, error: "Bei einem Bereich bitte die kleinere Zahl zuerst eingeben (z. B. 900-950)." };
  return { ok: true, from, to };
}

/**
 * A Race's Reserved numbers as ranges, sorted: each run of consecutive numbers
 * is one range, so overlapping and adjacent reservations show merged.
 */
export function reservedRanges(numbers: readonly number[]): ReservedRange[] {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const ranges: ReservedRange[] = [];
  for (const number of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && number === last.to + 1) last.to = number;
    else ranges.push({ from: number, to: number });
  }
  return ranges;
}

/** "13", or "900–950" for a range. */
export const formatRange = (range: ReservedRange) => (range.from === range.to ? String(range.from) : `${range.from}–${range.to}`);
