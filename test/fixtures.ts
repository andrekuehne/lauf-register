// Sample Participants and Registration bodies, as the browser flow sends them.

let attempts = 0;
export const freshAttemptId = () => `attempt-${++attempts}-${crypto.randomUUID()}`;

export const anna = { gender: "F", title: "dr", firstName: "Anna", lastName: "Muster", birthYear: 1985, club: "LG Nord" };
export const clara = { gender: "F", title: "none", firstName: "Clara", lastName: "Muster", birthYear: 2015, club: "LG Nord" };
export const ben = { gender: "M", title: "none", firstName: "Ben", lastName: "Beispiel", birthYear: 1990, club: null };
export const emil = { gender: "M", title: "none", firstName: "Emil", lastName: "Beispiel", birthYear: 2017, club: null };

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
