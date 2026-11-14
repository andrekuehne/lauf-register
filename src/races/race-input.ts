// Validation of the "new Race" form.

export const MAX_RACE_NAME_LENGTH = 100;

export type RaceInput = { name: string; date: string };
export type RaceInputErrors = Partial<Record<keyof RaceInput, string>>;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateRaceInput(raw: { name?: unknown; date?: unknown }): { input: RaceInput; errors: RaceInputErrors } {
  const input = {
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    date: typeof raw.date === "string" ? raw.date.trim() : "",
  };
  const errors: RaceInputErrors = {};
  if (!input.name) errors.name = "Bitte einen Namen eingeben.";
  else if (input.name.length > MAX_RACE_NAME_LENGTH) errors.name = `Höchstens ${MAX_RACE_NAME_LENGTH} Zeichen.`;
  if (!isIsoDate(input.date)) errors.date = "Bitte ein gültiges Datum wählen.";
  return { input, errors };
}
