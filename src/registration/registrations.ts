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

/**
 * One transaction: count the Race's Registration number up, store the
 * Registration with it, then its Participants. If any step fails (e.g. the
 * attempt ID is already stored), nothing is kept, the counter included.
 */
async function insertRegistration(db: D1Database, raceId: number, input: RegistrationInput): Promise<number> {
  const nextNumber = db
    .prepare("UPDATE races SET last_registration_number = last_registration_number + 1 WHERE id = ?")
    .bind(raceId);
  const registration = db
    .prepare(
      `INSERT INTO registrations (race_id, number, division, duration, attempt_id)
       SELECT id, last_registration_number, ?, ?, ? FROM races WHERE id = ?
       RETURNING number`,
    )
    .bind(input.division, input.duration, input.attemptId, raceId);
  const participants = input.participants.map((p, index) =>
    db
      .prepare(
        `INSERT INTO participants (registration_id, slot, title, first_name, last_name, birth_year, club)
         SELECT id, ?, ?, ?, ?, ?, ? FROM registrations WHERE race_id = ? AND attempt_id = ?`,
      )
      .bind(index + 1, p.title, p.firstName, p.lastName, p.birthYear, p.club, raceId, input.attemptId),
  );
  const [, inserted] = await db.batch<{ number: number }>([nextNumber, registration, ...participants]);
  return inserted!.results[0]!.number;
}
