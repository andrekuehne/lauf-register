// Registrations in D1: storing a submitted Registration with its Participants,
// listing a Race's Registrations, and editing or deleting one.

import type { Duration } from "../domain/categories";
import { NUMBER_RANGES } from "../domain/numbers";
import type { ParticipantInput, RegistrationContent, RegistrationInput } from "./registration-input";

/** A Registration as stored: its Participants in entered order. */
export type StoredRegistration = {
  number: number;
  duration: Duration;
  /** ISO timestamp (UTC) of the submit. */
  createdAt: string;
  participants: ParticipantInput[];
};

export type SubmitResult = { number: number } | { closed: true } | { full: true };

/**
 * Stores a Registration and returns its Registration number, `closed` when
 * Registration for the Race is closed, or `full` when the Registration's
 * series (singles or Pairs) has no number left. Idempotent per Race and attempt ID:
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
      if (number !== null) return { number };
      const open = await db.prepare("SELECT registration_open FROM races WHERE id = ?").bind(raceId).first<number>("registration_open");
      return open === 1 ? { full: true } : { closed: true };
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

/** All Registrations of a Race, in Registration-number order. */
export async function listRegistrations(db: D1Database, raceId: number): Promise<StoredRegistration[]> {
  const { results } = await db
    .prepare(`${REGISTRATIONS_WITH_PARTICIPANTS} WHERE r.race_id = ? ORDER BY r.number, p.slot`)
    .bind(raceId)
    .all<RegistrationRow>();
  return groupRows(results);
}

export async function countRegistrations(db: D1Database, raceId: number): Promise<number> {
  return (await db.prepare("SELECT COUNT(*) AS n FROM registrations WHERE race_id = ?").bind(raceId).first<number>("n")) ?? 0;
}

export async function findRegistration(db: D1Database, raceId: number, number: number): Promise<StoredRegistration | null> {
  const { results } = await db
    .prepare(`${REGISTRATIONS_WITH_PARTICIPANTS} WHERE r.race_id = ? AND r.number = ? ORDER BY p.slot`)
    .bind(raceId, number)
    .all<RegistrationRow>();
  return groupRows(results)[0] ?? null;
}

/**
 * Replaces a Registration's Duration and Participants in one transaction (a
 * Pair may become a single or the other way round). The Registration number
 * stays. False when the Race has no such Registration.
 */
export async function updateRegistration(db: D1Database, raceId: number, number: number, content: RegistrationContent): Promise<boolean> {
  const where = "race_id = ? AND number = ?";
  const [updated] = await db.batch([
    db.prepare(`UPDATE registrations SET duration = ? WHERE ${where}`).bind(content.duration, raceId, number),
    db.prepare(`DELETE FROM participants WHERE registration_id = (SELECT id FROM registrations WHERE ${where})`).bind(raceId, number),
    ...insertParticipants(db, content.participants, where, [raceId, number]),
  ]);
  return updated!.meta.changes > 0;
}

/** Statements storing Participants, in slot order, on the Registration that `where` (with `binds`) selects. */
function insertParticipants(db: D1Database, participants: ParticipantInput[], where: string, binds: unknown[]): D1PreparedStatement[] {
  return participants.map((p, index) =>
    db
      .prepare(
        `INSERT INTO participants (registration_id, slot, gender, title, first_name, last_name, birth_year, club)
         SELECT id, ?, ?, ?, ?, ?, ?, ? FROM registrations WHERE ${where}`,
      )
      .bind(index + 1, p.gender, p.title, p.firstName, p.lastName, p.birthYear, p.club, ...binds),
  );
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

/**
 * One transaction: store the Registration with the next number of its series
 * (singles or Pairs), note that number as the series' last one handed out,
 * then store the Participants. If any step fails (e.g. the attempt ID is
 * already stored), nothing is kept, the last handed-out number included.
 *
 * The next number is the smallest one that is at least the series' First
 * number, above the number it handed out last, within its range, and not
 * taken in the Race. When there is none, nothing is stored.
 *
 * Every step only touches a Race whose Registration is open, so a Race closed
 * a moment ago stores nothing. Null when nothing was stored.
 */
async function insertRegistration(db: D1Database, raceId: number, input: RegistrationInput): Promise<number | null> {
  const series = input.participants.length === 2 ? "pair" : "single";
  const lastColumn = `last_${series}_number`;
  const { to } = NUMBER_RANGES[series];
  const startSql = `MAX(races.first_${series}_number, races.${lastColumn} + 1)`;
  // The smallest free number is the start itself or right after a taken one.
  const nextNumberSql = `(
    SELECT MIN(candidate) FROM (
      SELECT ${startSql} AS candidate
      UNION SELECT number + 1 FROM registrations WHERE race_id = races.id
    )
    WHERE candidate >= ${startSql} AND candidate <= ${to}
      AND candidate NOT IN (SELECT number FROM registrations WHERE race_id = races.id)
  )`;
  const registration = db
    .prepare(
      `INSERT INTO registrations (race_id, number, duration, attempt_id)
       SELECT id, ${nextNumberSql}, ?, ? FROM races
       WHERE id = ? AND registration_open = 1 AND ${nextNumberSql} IS NOT NULL
       RETURNING number`,
    )
    .bind(input.duration, input.attemptId, raceId);
  const stored = "SELECT number FROM registrations WHERE race_id = ? AND attempt_id = ?";
  const lastHandedOut = db
    .prepare(`UPDATE races SET ${lastColumn} = (${stored}) WHERE id = ? AND EXISTS (${stored})`)
    .bind(raceId, input.attemptId, raceId, raceId, input.attemptId);
  const participants = insertParticipants(db, input.participants, "race_id = ? AND attempt_id = ?", [raceId, input.attemptId]);
  const [inserted] = await db.batch<{ number: number }>([registration, lastHandedOut, ...participants]);
  return inserted!.results[0]?.number ?? null;
}
