// Sample Participants and Registration bodies, as the browser flow sends them.

let attempts = 0;
export const freshAttemptId = () => `attempt-${++attempts}-${crypto.randomUUID()}`;

export const anna = { gender: "F", title: "dr", firstName: "Anna", lastName: "Muster", birthYear: 1985, club: "LG Nord" };
export const clara = { gender: "F", title: "none", firstName: "Clara", lastName: "Muster", birthYear: 2015, club: "LG Nord" };
export const ben = { gender: "M", title: "none", firstName: "Ben", lastName: "Beispiel", birthYear: 1990, club: null };
export const emil = { gender: "M", title: "none", firstName: "Emil", lastName: "Beispiel", birthYear: 2017, club: null };

export type Participant = { gender: string; title: string; firstName: string; lastName: string; birthYear: number | string; club: string | null };

/** The admin edit form's fields as the browser posts them: Registration number, Duration, then the Participants (two for a Pair). */
export function editForm(number: number, duration: number, participants: Participant[]): Record<string, string> {
  const fields: Record<string, string> = { number: String(number), duration: String(duration) };
  participants.forEach((p, i) => {
    const prefix = `p${i + 1}.`;
    fields[`${prefix}gender`] = p.gender;
    fields[`${prefix}title`] = p.title;
    fields[`${prefix}firstName`] = p.firstName;
    fields[`${prefix}lastName`] = p.lastName;
    fields[`${prefix}birthYear`] = String(p.birthYear);
    fields[`${prefix}club`] = p.club ?? "";
  });
  return fields;
}

/** A valid Pair Registration for Anna and Ben in the Stundenlauf, with a fresh attempt ID. */
export const pairRegistration = () => registration({ participants: [anna, ben] });

/** A valid single Registration for Anna in the Stundenlauf, with a fresh attempt ID; override any field. */
export function registration(overrides: Record<string, unknown> = {}) {
  return {
    attemptId: freshAttemptId(),
    duration: 60,
    consent: true,
    participants: [anna],
    ...overrides,
  };
}
