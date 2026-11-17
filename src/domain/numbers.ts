// The ranges Registration numbers come from (see GLOSSARY.md: Registration number, First number).
// Singles and Pairs each count in a series of their own.

import type { SingleOrPair } from "./categories";

/** Singles are numbered within 1–999, Pairs within 1000–1999 (fixed for now). */
export const NUMBER_RANGES: Record<SingleOrPair, { from: number; to: number }> = {
  single: { from: 1, to: 999 },
  pair: { from: 1000, to: 1999 },
};

/** A new Race's First numbers unless the Admin sets others, as on the organizers' lists. */
export const DEFAULT_FIRST_NUMBERS: Record<SingleOrPair, number> = { single: 1, pair: 1001 };

/** The Race form's First number fields, and the series each one starts. */
export const FIRST_NUMBER_FIELDS = { firstSingleNumber: "single", firstPairNumber: "pair" } as const satisfies Record<string, SingleOrPair>;
export type FirstNumberField = keyof typeof FIRST_NUMBER_FIELDS;

export function isInRange(number: number, series: SingleOrPair): boolean {
  const range = NUMBER_RANGES[series];
  return Number.isInteger(number) && number >= range.from && number <= range.to;
}

/** A number of the series' range typed into a form (spaces around don't matter), or null when the text is none. */
export function numberInRange(text: string, series: SingleOrPair): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return isInRange(number, series) ? number : null;
}

/** The series of a Registration with these Participants: one is a single, two are a Pair. */
export const seriesOf = (participants: readonly unknown[]): SingleOrPair => (participants.length === 2 ? "pair" : "single");
