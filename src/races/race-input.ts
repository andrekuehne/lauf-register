// Validation of the Race forms: "Neuer Lauf" on the admin start page (name,
// date, First numbers) and the Race settings page (name and date).

import { DEFAULT_FIRST_NUMBERS, FIRST_NUMBER_FIELDS, numberInRange, rangeError, type FirstNumberField } from "../domain/numbers";

export const MAX_RACE_NAME_LENGTH = 100;

/** A Race's name and date: what its settings form changes. */
export type RaceInput = { name: string; date: string };
/** A new Race: its name and date, and where its series begin counting. */
export type NewRaceInput = RaceInput & Record<FirstNumberField, number>;

/** The form as text, exactly as shown or posted. */
export type RaceFormValues = Record<keyof RaceInput, string>;
export type NewRaceFormValues = Record<keyof NewRaceInput, string>;
export type RaceInputErrors = Partial<Record<keyof NewRaceInput, string>>;

/** Dates a Race form allows: from `today` (ISO, in the organizers' time zone), and the date `stored` for the Race, if any. */
type AllowedDates = { today: string; stored?: string };

type Checked<Input, Values> = { ok: true; input: Input } | { ok: false; values: Values; errors: RaceInputErrors };

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The settings form's values for a stored Race. */
export const raceFormValues = (race: RaceInput): RaceFormValues => ({ name: race.name, date: race.date });

/** The "Neuer Lauf" form as first shown: empty, with the default First numbers. */
export const newRaceFormValues = (): NewRaceFormValues => ({
  name: "",
  date: "",
  firstSingleNumber: String(DEFAULT_FIRST_NUMBERS.single),
  firstPairNumber: String(DEFAULT_FIRST_NUMBERS.pair),
});

const text = (raw: Record<string, unknown>, name: string) => (typeof raw[name] === "string" ? (raw[name] as string).trim() : "");

/**
 * Checks a posted settings form. A date before today is refused, as the daily
 * cleanup would soon delete the Race, except the date stored for the Race, so a
 * Race can still be renamed after its day.
 */
export function validateRaceInput(raw: Record<string, unknown>, dates: AllowedDates): Checked<RaceInput, RaceFormValues> {
  const values: RaceFormValues = { name: text(raw, "name"), date: text(raw, "date") };
  const errors: RaceInputErrors = {};
  if (!values.name) errors.name = "Bitte einen Namen eingeben.";
  else if (values.name.length > MAX_RACE_NAME_LENGTH) errors.name = `Höchstens ${MAX_RACE_NAME_LENGTH} Zeichen.`;
  if (!isIsoDate(values.date)) errors.date = "Bitte ein gültiges Datum wählen.";
  else if (values.date < dates.today && values.date !== dates.stored) errors.date = "Das Datum liegt in der Vergangenheit.";
  return Object.keys(errors).length > 0 ? { ok: false, values, errors } : { ok: true, input: values };
}

const FIRST_NUMBER_FIELDS_LIST = Object.keys(FIRST_NUMBER_FIELDS) as FirstNumberField[];

/**
 * Checks a posted "Neuer Lauf" form: name and date as on the settings form,
 * and the First numbers. A First number left out of the post entirely is the
 * default; one posted empty is an error like any other non-number.
 */
export function validateNewRaceInput(raw: Record<string, unknown>, today: string): Checked<NewRaceInput, NewRaceFormValues> {
  const race = validateRaceInput(raw, { today });
  const values: NewRaceFormValues = { ...newRaceFormValues(), ...(race.ok ? race.input : race.values) };
  for (const field of FIRST_NUMBER_FIELDS_LIST) if (raw[field] !== undefined) values[field] = text(raw, field);

  const errors: RaceInputErrors = race.ok ? {} : { ...race.errors };
  const firstNumbers: Partial<Record<FirstNumberField, number>> = {};
  for (const field of FIRST_NUMBER_FIELDS_LIST) {
    const number = numberInRange(values[field], FIRST_NUMBER_FIELDS[field]);
    if (number === null) errors[field] = rangeError(FIRST_NUMBER_FIELDS[field]);
    else firstNumbers[field] = number;
  }
  const { firstSingleNumber, firstPairNumber } = firstNumbers;
  if (!race.ok || firstSingleNumber === undefined || firstPairNumber === undefined) return { ok: false, values, errors };
  return { ok: true, input: { ...race.input, firstSingleNumber, firstPairNumber } };
}
