// How the admin pages count Registrations in words, on the server and in the
// Anmeldetisch's live updates (src/client/desk-live.ts).

/** "1 Anmeldung", "12 Anmeldungen" */
export const registrationCount = (count: number) => `${count} ${count === 1 ? "Anmeldung" : "Anmeldungen"}`;
