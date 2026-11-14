// Registrations in D1: storing a submitted Registration with its Participants.

import type { RegistrationInput } from "./registration-input";

export type SubmitResult = { number: number } | { closed: true };

/**
 * Stores a Registration and returns its Registration number, or `closed` when
 * Registration for the Race is closed. Idempotent per Race and attempt ID:
 * repeating an attempt returns the number it already got and stores nothing
 * new, even after Registration has been closed in between (the phone may
 * never have received the first answer).
 */
export async function submitRegistration(db: D1Database, raceId: number, input: RegistrationInput): Promise<SubmitResult> {
  for (let retry = 0; ; retry++) {
    const existing = await findNumberByAttempt(db, raceId, input.attemptId);
    if (existing !== null) return { number: existing };
    try {
      const number = await insertRegistration(db, raceId, input);
      return number === null ? { closed: true } : { number };
    } catch (error) {
      // A concurrent submit of the same attempt (double tap) won the race: the
      // lookup above now finds it. Anything else is a real error.
      if (retry < 2 && String(error).includes("UNIQUE")) continue;
      throw error;
    }
  }
}

async function findNumberByAttempt(db: D1Database, raceId: number, attemptId: string): Promise<number | null> {
  return db
    .prepare("SELECT number FROM registrations WHERE race_id = ? AND attempt_id = ?")
    .bind(raceId, attemptId)
    .first<number>("number");
}

/** Pair numbers start above any realistic count of singles, as on the organizers' lists. */
const FIRST_PAIR_NUMBER = 1001;

/**
 * One transaction: count the Race's single or Pair counter up, store the
 * Registration with the resulting number, then its Participants. If any step
 * fails (e.g. the attempt ID is already stored), nothing is kept, the counter included.
 * Every step only touches a Race whose Registration is open, so a Race closed
 * a moment ago stores nothing and the result is null.
 */
async function insertRegistration(db: D1Database, raceId: number, input: RegistrationInput): Promise<number | null> {
  const isPair = input.participants.length === 2;
  const counter = isPair ? "last_pair_number" : "last_single_number";
  const number = isPair ? `${FIRST_PAIR_NUMBER - 1} + last_pair_number` : "last_single_number";
  const nextNumber = db
    .prepare(`UPDATE races SET ${counter} = ${counter} + 1 WHERE id = ? AND registration_open = 1`)
    .bind(raceId);
  const registration = db
    .prepare(
      `INSERT INTO registrations (race_id, number, duration, attempt_id)
       SELECT id, ${number}, ?, ? FROM races WHERE id = ? AND registration_open = 1
       RETURNING number`,
    )
    .bind(input.duration, input.attemptId, raceId);
  const participants = input.participants.map((p, index) =>
    db
      .prepare(
        `INSERT INTO participants (registration_id, slot, gender, title, first_name, last_name, birth_year, club)
         SELECT id, ?, ?, ?, ?, ?, ?, ? FROM registrations WHERE race_id = ? AND attempt_id = ?`,
      )
      .bind(index + 1, p.gender, p.title, p.firstName, p.lastName, p.birthYear, p.club, raceId, input.attemptId),
  );
  const [, inserted] = await db.batch<{ number: number }>([nextNumber, registration, ...participants]);
  return inserted!.results[0]?.number ?? null;
}
