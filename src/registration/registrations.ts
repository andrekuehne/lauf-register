// Registrations in D1: storing a submitted Registration with its Participants,
// listing a Race's Registrations, and deleting one.

import type { Duration } from "../domain/categories";
import type { ParticipantInput, RegistrationInput } from "./registration-input";

/** A Registration as stored: its Participants in entered order. */
export type StoredRegistration = {
  number: number;
  duration: Duration;
  /** ISO timestamp (UTC) of the submit. */
  createdAt: string;
  participants: ParticipantInput[];
};

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

type RegistrationRow = {
  number: number;
  duration: Duration;
  created_at: string;
  gender: ParticipantInput["gender"];
  title: ParticipantInput["title"];
  first_name: string;
  last_name: string;
  birth_year: number;
  club: string | null;
};

const REGISTRATIONS_WITH_PARTICIPANTS = `
  SELECT r.number, r.duration, r.created_at, p.gender, p.title, p.first_name, p.last_name, p.birth_year, p.club
  FROM registrations r JOIN participants p ON p.registration_id = r.id`;

/** One Registration per number, Participants in slot order (rows must come sorted by Registration, then slot). */
function groupRows(rows: RegistrationRow[]): StoredRegistration[] {
  const registrations: StoredRegistration[] = [];
  for (const row of rows) {
    let current = registrations[registrations.length - 1];
    if (!current || current.number !== row.number) {
      current = { number: row.number, duration: row.duration, createdAt: row.created_at, participants: [] };
      registrations.push(current);
    }
    current.participants.push({
      gender: row.gender,
      title: row.title,
      firstName: row.first_name,
      lastName: row.last_name,
      birthYear: row.birth_year,
      club: row.club,
    });
  }
  return registrations;
}

/** All Registrations of a Race, newest first. */
export async function listRegistrations(db: D1Database, raceId: number): Promise<StoredRegistration[]> {
  const { results } = await db
    .prepare(`${REGISTRATIONS_WITH_PARTICIPANTS} WHERE r.race_id = ? ORDER BY r.created_at DESC, r.id DESC, p.slot`)
    .bind(raceId)
    .all<RegistrationRow>();
  return groupRows(results);
}

export async function findRegistration(db: D1Database, raceId: number, number: number): Promise<StoredRegistration | null> {
  const { results } = await db
    .prepare(`${REGISTRATIONS_WITH_PARTICIPANTS} WHERE r.race_id = ? AND r.number = ? ORDER BY p.slot`)
    .bind(raceId, number)
    .all<RegistrationRow>();
  return groupRows(results)[0] ?? null;
}

/**
 * Deletes a Registration; its Participants go with it (ON DELETE CASCADE).
 * Its number is not given out again. False when the Race has no such Registration.
 */
export async function deleteRegistration(db: D1Database, raceId: number, number: number): Promise<boolean> {
  const result = await db.prepare("DELETE FROM registrations WHERE race_id = ? AND number = ?").bind(raceId, number).run();
  return result.meta.changes > 0;
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
