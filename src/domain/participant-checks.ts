// Rules for a Participant's details. Shared by the browser (inline feedback)
// and the Worker (authoritative validation, src/registration/registration-input.ts).

export const OLDEST_PLAUSIBLE_BIRTH_YEAR = 1920;
export const YOUNGEST_PLAUSIBLE_AGE = 3;

/** Longest accepted name or club; the form fields stop typing there. */
export const MAX_TEXT_LENGTH = 100;

/** Below this a four-digit "year" is a typo, not a birth year. */
export const OLDEST_VALID_BIRTH_YEAR = 1800;

export type BirthYearError = "format" | "too-early" | "future";

/** Why a birth year can't be accepted at all, or null if it can (it may still be implausible). */
export function birthYearError(input: string, raceYear: number): BirthYearError | null {
  const trimmed = input.trim();
  if (!/^\d{4}$/.test(trimmed)) return "format";
  if (Number(trimmed) < OLDEST_VALID_BIRTH_YEAR) return "too-early";
  if (Number(trimmed) > raceYear) return "future";
  return null;
}

export function parseBirthYear(input: string, raceYear: number): number | null {
  return birthYearError(input, raceYear) === null ? Number(input.trim()) : null;
}

/** Age reached in the Race's year. */
export function ageInRaceYear(birthYear: number, raceYear: number): number {
  return raceYear - birthYear;
}

/** A valid but unlikely birth year: worth a gentle "please check", never a block. */
export function isImplausibleBirthYear(birthYear: number, raceYear: number): boolean {
  return (
    birthYear < OLDEST_PLAUSIBLE_BIRTH_YEAR ||
    ageInRaceYear(birthYear, raceYear) < YOUNGEST_PLAUSIBLE_AGE
  );
}
