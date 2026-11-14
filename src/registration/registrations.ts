// Registrations in D1: storing a submitted Registration with its Participants.

import type { RegistrationInput } from "./registration-input";

/**
 * Stores a Registration and returns its Registration number. Idempotent per
 * Race and attempt ID: repeating an attempt returns the number it already got
 * and stores nothing new.
 */
export async function submitRegistration(db: D1Database, raceId: number, input: RegistrationInput): Promise<number> {
  for (let retry = 0; ; retry++) {
    const existing = await findNumberByAttempt(db, raceId, input.attemptId);
    if (existing !== null) return existing;
    try {
      return await insertRegistration(db, raceId, input);
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
 */
async function insertRegistration(db: D1Database, raceId: number, input: RegistrationInput): Promise<number> {
  const isPair = input.participants.length === 2;
  const counter = isPair ? "last_pair_number" : "last_single_number";
  const number = isPair ? `${FIRST_PAIR_NUMBER - 1} + last_pair_number` : "last_single_number";
  const nextNumber = db.prepare(`UPDATE races SET ${counter} = ${counter} + 1 WHERE id = ?`).bind(raceId);
  const registration = db
    .prepare(
      `INSERT INTO registrations (race_id, number, duration, attempt_id)
       SELECT id, ${number}, ?, ? FROM races WHERE id = ?
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
  return inserted!.results[0]!.number;
}
