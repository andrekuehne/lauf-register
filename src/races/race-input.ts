// Validation of the Race form: "new Race" on the admin start page and the Race settings page.

import type { SingleOrPair } from "../domain/categories";
import { DEFAULT_FIRST_NUMBERS, FIRST_NUMBER_FIELDS, isInRange, NUMBER_RANGES, type FirstNumberField } from "../domain/numbers";

export const MAX_RACE_NAME_LENGTH = 100;

export type RaceInput = { name: string; date: string; firstSingleNumber: number; firstPairNumber: number };

/** The form as text, exactly as shown or posted. */
export type RaceFormValues = Record<keyof RaceInput, string>;
export type RaceInputErrors = Partial<Record<keyof RaceInput, string>>;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The form values for a stored Race or a new one (default First numbers). */
export function raceFormValues(race?: RaceInput): RaceFormValues {
  return {
    name: race?.name ?? "",
    date: race?.date ?? "",
    firstSingleNumber: String(race?.firstSingleNumber ?? DEFAULT_FIRST_NUMBERS.single),
    firstPairNumber: String(race?.firstPairNumber ?? DEFAULT_FIRST_NUMBERS.pair),
  };
}

const FIRST_NUMBER_FIELDS_LIST = Object.keys(FIRST_NUMBER_FIELDS) as FirstNumberField[];

/**
 * Checks a posted Race form. A First number left out of the post entirely is
 * the default; one posted empty is an error like any other non-number.
 */
export function validateRaceInput(raw: Record<string, unknown>): { ok: true; input: RaceInput } | { ok: false; values: RaceFormValues; errors: RaceInputErrors } {
  const text = (name: keyof RaceInput) => (typeof raw[name] === "string" ? (raw[name] as string).trim() : "");
  const values: RaceFormValues = { ...raceFormValues(), name: text("name"), date: text("date") };
  for (const field of FIRST_NUMBER_FIELDS_LIST) if (raw[field] !== undefined) values[field] = text(field);

  const errors: RaceInputErrors = {};
  if (!values.name) errors.name = "Bitte einen Namen eingeben.";
  else if (values.name.length > MAX_RACE_NAME_LENGTH) errors.name = `Höchstens ${MAX_RACE_NAME_LENGTH} Zeichen.`;
  if (!isIsoDate(values.date)) errors.date = "Bitte ein gültiges Datum wählen.";
  const firstNumbers: Partial<Record<FirstNumberField, number>> = {};
  for (const field of FIRST_NUMBER_FIELDS_LIST) {
    const number = firstNumber(values[field], FIRST_NUMBER_FIELDS[field]);
    if (number === null) errors[field] = rangeError(FIRST_NUMBER_FIELDS[field]);
    else firstNumbers[field] = number;
  }
  const { firstSingleNumber, firstPairNumber } = firstNumbers;
  if (Object.keys(errors).length > 0 || firstSingleNumber === undefined || firstPairNumber === undefined) return { ok: false, values, errors };
  return { ok: true, input: { name: values.name, date: values.date, firstSingleNumber, firstPairNumber } };
}

/** A First number of the series, or null when the text isn't a whole number within the series' range. */
function firstNumber(value: string, series: SingleOrPair): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return isInRange(number, series) ? number : null;
}

function rangeError(series: SingleOrPair): string {
  const { from, to } = NUMBER_RANGES[series];
  return `Bitte eine Zahl von ${from} bis ${to} eingeben.`;
}
