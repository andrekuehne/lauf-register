// Validation of the „Nächste Startnummern“ form on the Race settings page,
// where an Admin sets where each series' count continues (see GLOSSARY.md: Next number).

import { SINGLE_OR_PAIR, type SingleOrPair } from "../domain/categories";
import { NUMBER_RANGES, numberInRange } from "../domain/numbers";
import { firstNumberOf, type Race } from "./races";

/**
 * The form's fields per series: the Next number typed, the one the field
 * showed when the page was opened, and the free numbers the Admin confirmed
 * are handed out again.
 */
export const NEXT_NUMBER_FIELDS = {
  single: { typed: "nextSingleNumber", shown: "shownSingleNumber", confirmed: "confirmedSingle" },
  pair: { typed: "nextPairNumber", shown: "shownPairNumber", confirmed: "confirmedPair" },
} as const satisfies Record<SingleOrPair, Record<string, string>>;

/** Something per series, for the series it applies to. */
export type PerSeries<T> = Partial<Record<SingleOrPair, T>>;

/** The form as posted, per series (see NEXT_NUMBER_FIELDS). */
export type PostedNextNumbers = {
  /** "" for a field not sent. */
  typed: Record<SingleOrPair, string>;
  shown: Record<SingleOrPair, string>;
  /** As listed on the confirmation, for the series the Admin confirmed. */
  confirmed: PerSeries<string>;
};

/** Reads the posted form; anything missing or not text counts as empty. */
export function postedNextNumbers(raw: Record<string, unknown>): PostedNextNumbers {
  const text = (name: string) => (typeof raw[name] === "string" ? (raw[name] as string) : "");
  const per = (field: "typed" | "shown") => ({ single: text(NEXT_NUMBER_FIELDS.single[field]), pair: text(NEXT_NUMBER_FIELDS.pair[field]) });
  const confirmed: PerSeries<string> = {};
  for (const series of SINGLE_OR_PAIR) {
    const value = raw[NEXT_NUMBER_FIELDS[series].confirmed];
    if (typeof value === "string") confirmed[series] = value;
  }
  return { typed: per("typed"), shown: per("shown"), confirmed };
}

/**
 * The Next numbers the Admin changed (a field still showing what it showed when
 * the page was opened is left alone), or why one can't be: each must be a
 * number from its series' First number to the top of its range.
 */
export function checkNextNumbers(
  posted: PostedNextNumbers,
  race: Race,
): { ok: true; changed: PerSeries<number> } | { ok: false; errors: PerSeries<string> } {
  const changed: PerSeries<number> = {};
  const errors: PerSeries<string> = {};
  for (const series of SINGLE_OR_PAIR) {
    const typed = posted.typed[series].trim();
    if (typed === posted.shown[series].trim()) continue;
    const first = firstNumberOf(race, series);
    const number = numberInRange(typed, series);
    if (number === null || number < first) errors[series] = `Bitte eine Zahl von ${first} bis ${NUMBER_RANGES[series].to} eingeben.`;
    else changed[series] = number;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, changed };
}
