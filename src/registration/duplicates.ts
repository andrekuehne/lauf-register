// Possible duplicates: the same person (first name, last name, birth year)
// appearing more than once in one Race's Registrations. Flagged, never blocked:
// someone may genuinely run twice, e.g. once single and once in a Pair.

import { normalizedText } from "../shared/same-text";
import type { ParticipantInput } from "./registration-input";
import type { StoredRegistration } from "./registrations";

/** Case, surrounding and doubled spaces don't make a different person. */
const personOf = (p: ParticipantInput) => `${normalizedText(p.firstName)}|${normalizedText(p.lastName)}|${p.birthYear}`;

/**
 * Looks up, for a Participant (Registration + slot index), the numbers of the
 * Registrations of the Race where the same person appears again: other
 * Registrations, or this one when both halves of a Pair are the same person.
 * An empty list means no duplicate.
 */
export function duplicatesOf(registrations: StoredRegistration[]): (registration: StoredRegistration, slot: number) => number[] {
  const appearances = new Map<string, { number: number; slot: number }[]>();
  for (const registration of registrations) {
    registration.participants.forEach((p, slot) => {
      const person = personOf(p);
      appearances.set(person, [...(appearances.get(person) ?? []), { number: registration.number, slot }]);
    });
  }
  return (registration, slot) => {
    const person = personOf(registration.participants[slot]!);
    const others = (appearances.get(person) ?? []).filter((a) => a.number !== registration.number || a.slot !== slot);
    return [...new Set(others.map((a) => a.number))].sort((a, b) => a - b);
  };
}
