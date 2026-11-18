// Registrations in D1: storing a submitted Registration with its Participants
// (or one an Admin adds at the Race desk), listing a Race's Registrations, and editing or deleting one.

import type { Duration, SingleOrPair } from "../domain/categories";
import { seriesOf } from "../domain/numbers";
import type { ReservedRange } from "../domain/reserved-numbers";
import type { SubmitAnswer } from "./flow-config";
import { lastNumberColumn, nextNumberSql } from "./next-numbers";
import { divisionOfRegistration, type ParticipantInput, type RegistrationContent, type RegistrationInput } from "./registration-input";

/** A Registration as stored: its Participants in entered order. */
export type StoredRegistration = {
  /** Stays the same when the Registration number changes. */
  id: number;
  number: number;
  duration: Duration;
  /** ISO timestamp (UTC) of the submit. */
  createdAt: string;
  /** The numbers it had before its current one, oldest first. */
  previousNumbers: number[];
  participants: ParticipantInput[];
};

/** What the phone is answered, and the stored Registration's id; or why nothing was stored. */
export type SubmitResult = { answer: SubmitAnswer; id: number } | { closed: true } | { full: true };

/**
 * Stores a Registration and answers with it as stored, `closed` when
 * Registration for the Race is closed, or `full` when the Registration's
 * series (singles or Pairs) has no number left. Idempotent per Race and attempt ID:
 * repeating an attempt answers with the Registration it already stored and
 * stores nothing new, even after Registration has been closed in between (the
 * phone may never have received the first answer).
 */
export const submitRegistration = (db: D1Database, raceId: number, input: RegistrationInput): Promise<SubmitResult> =>
  storeRegistration(db, raceId, input, true);

/**
 * Stores a Registration an Admin adds at the Race desk, as `submitRegistration`
 * does, whether Registration for the Race is open or closed: open and closed
 * are about its link, which an Admin isn't using.
 */
export const addRegistration = (db: D1Database, raceId: number, input: RegistrationInput) =>
  storeRegistration(db, raceId, input, false) as Promise<Exclude<SubmitResult, { closed: true }>>;

async function storeRegistration(db: D1Database, raceId: number, input: RegistrationInput, onlyWhileOpen: boolean): Promise<SubmitResult> {
  for (let retry = 0; ; retry++) {
    const existing = await findByAttempt(db, raceId, input.attemptId);
    if (existing) return { answer: answerFor(existing.number, existing, !sameContent(existing, input)), id: existing.id };
    try {
      const stored = await insertRegistration(db, raceId, input, onlyWhileOpen);
      if (stored !== null) return { answer: answerFor(stored.number, input, false), id: stored.id };
      if (!onlyWhileOpen) return { full: true };
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

/** A Registration's own columns. */
type RegistrationColumns = {
  id: number;
  number: number;
  duration: Duration;
  created_at: string;
};

/** A Participant's columns. */
type ParticipantColumns = {
  gender: ParticipantInput["gender"];
  title: ParticipantInput["title"];
  first_name: string;
  last_name: string;
  birth_year: number;
  club: string | null;
};

type RegistrationRow = RegistrationColumns &
  ParticipantColumns & {
    /** "id:number" pairs, comma-separated, in no particular order; null when none. */
    previous_numbers: string | null;
  };

/** A Previous number as stored: the higher its id, the later it was recorded. */
type PreviousNumber = { id: number; number: number };

const participantOf = (row: ParticipantColumns): ParticipantInput => ({
  gender: row.gender,
  title: row.title,
  firstName: row.first_name,
  lastName: row.last_name,
  birthYear: row.birth_year,
  club: row.club,
});

/** A Registration from its columns, its Previous numbers (in any order: listed oldest first) and its Participants. */
const registrationOf = (row: RegistrationColumns, previous: PreviousNumber[], participants: ParticipantInput[]): StoredRegistration => ({
  id: row.id,
  number: row.number,
  duration: row.duration,
  createdAt: row.created_at,
  previousNumbers: [...previous].sort((a, b) => a.id - b.id).map((p) => p.number),
  participants,
});

const REGISTRATIONS_WITH_PARTICIPANTS = `
  SELECT r.id, r.number, r.duration, r.created_at,
    (SELECT group_concat(id || ':' || number) FROM previous_numbers WHERE registration_id = r.id) AS previous_numbers,
    p.gender, p.title, p.first_name, p.last_name, p.birth_year, p.club
  FROM registrations r JOIN participants p ON p.registration_id = r.id`;

/** Previous numbers from their "id:number" pairs. */
function previousNumbersIn(pairs: string | null): PreviousNumber[] {
  if (!pairs) return [];
  return pairs.split(",").map((pair) => {
    const [id, number] = pair.split(":").map(Number) as [number, number];
    return { id, number };
  });
}

/** One Registration per number, Participants in slot order (rows must come sorted by Registration, then slot). */
function groupRows(rows: RegistrationRow[]): StoredRegistration[] {
  const registrations: StoredRegistration[] = [];
  for (const row of rows) {
    let current = registrations[registrations.length - 1];
    if (!current || current.id !== row.id) {
      current = registrationOf(row, previousNumbersIn(row.previous_numbers), []);
      registrations.push(current);
    }
    current.participants.push(participantOf(row));
  }
  return registrations;
}

/**
 * All Registrations of a Race, in Registration-number order. The Race page is
 * reloaded all day, so this reads as few database rows as it can (on the
 * Workers Free plan, D1 allows only so many per day): the Registrations, then
 * their Participants as one stretch of Registration ids rather than one lookup
 * per Registration, then their Previous numbers. One batch, so all three see
 * the same state. Another Race's Registrations can have ids in between: their
 * Participants are read, then left out.
 */
export async function listRegistrations(db: D1Database, raceId: number): Promise<StoredRegistration[]> {
  const [registrations, participants, previousNumbers] = (await db.batch([
    db.prepare("SELECT id, number, duration, created_at FROM registrations WHERE race_id = ? ORDER BY number").bind(raceId),
    // The lowest and highest id as two lookups, each reading one row of the index
    // registrations_by_race_and_id; asked for in one SELECT, SQLite reads the
    // index rows of every Registration of the Race.
    db
      .prepare(
        `SELECT registration_id, gender, title, first_name, last_name, birth_year, club FROM participants
         WHERE registration_id BETWEEN (SELECT MIN(id) FROM registrations WHERE race_id = ?1)
           AND (SELECT MAX(id) FROM registrations WHERE race_id = ?1)
         ORDER BY registration_id, slot`,
      )
      .bind(raceId),
    // Previous numbers are few: go through them and look up each one's
    // Registration (CROSS JOIN keeps that order), rather than go through every
    // Registration of the Race.
    db
      .prepare(
        `SELECT p.registration_id, p.id, p.number FROM previous_numbers p CROSS JOIN registrations r ON r.id = p.registration_id
         WHERE r.race_id = ?`,
      )
      .bind(raceId),
    // D1 types a batch's results with one row type; these three each have their own.
  ])) as [D1Result<RegistrationColumns>, D1Result<ParticipantColumns & WithRegistrationId>, D1Result<PreviousNumber & WithRegistrationId>];
  const participantsByRegistration = byRegistration(participants.results, participantOf);
  const previousByRegistration = byRegistration(previousNumbers.results, (row) => ({ id: row.id, number: row.number }));
  return registrations.results.map((row) =>
    registrationOf(row, previousByRegistration.get(row.id) ?? [], participantsByRegistration.get(row.id) ?? []),
  );
}

type WithRegistrationId = { registration_id: number };

/** Each row's value, grouped by the Registration the row belongs to, in row order. */
function byRegistration<Row extends WithRegistrationId, Value>(rows: Row[], value: (row: Row) => Value): Map<number, Value[]> {
  const grouped = new Map<number, Value[]>();
  for (const row of rows) {
    const values = grouped.get(row.registration_id) ?? [];
    values.push(value(row));
    grouped.set(row.registration_id, values);
  }
  return grouped;
}

export async function countRegistrations(db: D1Database, raceId: number): Promise<number> {
  return (await db.prepare("SELECT COUNT(*) AS n FROM registrations WHERE race_id = ?").bind(raceId).first<number>("n")) ?? 0;
}

/** The Registrations of a Race whose numbers lie within the range, in number order. */
export async function listRegistrationsWithin(db: D1Database, raceId: number, range: ReservedRange): Promise<StoredRegistration[]> {
  const { results } = await db
    .prepare(`${REGISTRATIONS_WITH_PARTICIPANTS} WHERE r.race_id = ? AND r.number BETWEEN ? AND ? ORDER BY r.number, p.slot`)
    .bind(raceId, range.from, range.to)
    .all<RegistrationRow>();
  return groupRows(results);
}

/**
 * Two statements that move the Registration off a range about to be Reserved,
 * to the next automatic number of its series outside that range, as if it
 * registered now: the first notes that number as the series' last one handed
 * out (failing when there is none, see `isNoNumberLeft`), the second moves the
 * Registration there and returns its new number. Neither touches anything
 * when the Registration (found by its id) is no longer on the range.
 */
export function renumberStatements(
  db: D1Database,
  raceId: number,
  registration: StoredRegistration,
  beingReserved: ReservedRange,
): [D1PreparedStatement, D1PreparedStatement] {
  const series = seriesOf(registration.participants);
  const lastColumn = lastNumberColumn(series);
  const onRange = "race_id = ? AND id = ? AND number BETWEEN ? AND ?";
  const onRangeBinds = [raceId, registration.id, beingReserved.from, beingReserved.to];
  return [
    db
      .prepare(`UPDATE races SET ${lastColumn} = ${nextNumberSql(series, true)} WHERE id = ? AND EXISTS (SELECT 1 FROM registrations WHERE ${onRange})`)
      .bind(beingReserved.to, beingReserved.from, beingReserved.to, raceId, ...onRangeBinds),
    db
      .prepare(`UPDATE registrations SET number = (SELECT ${lastColumn} FROM races WHERE id = ?) WHERE ${onRange} RETURNING number`)
      .bind(raceId, ...onRangeBinds),
  ];
}

/** Whether a batch with `renumberStatements` failed because a Registration got no number (NULL into a NOT NULL column). */
export const isNoNumberLeft = (error: unknown) => String(error).includes("NOT NULL constraint failed");

/** Whether a write failed because another Registration of the Race has the number. */
const isNumberTaken = (error: unknown) => String(error).includes("UNIQUE constraint failed: registrations.race_id, registrations.number");

/** Whether a write failed because it would have put a Registration on a Reserved number (the database refuses that, docs/adr/0003). */
export const isOnReservedNumber = (error: unknown) => String(error).includes("Registration on a Reserved number");

/** The Race's Registration with this number; null when it has none. */
export const findRegistration = (db: D1Database, raceId: number, number: number) => findOne(db, raceId, "number", number);

/** The Race's Registration with this id, whatever its number is now; null when it has none such. */
export const findRegistrationById = (db: D1Database, raceId: number, id: number) => findOne(db, raceId, "id", id);

async function findOne(db: D1Database, raceId: number, by: "id" | "number", value: number): Promise<StoredRegistration | null> {
  const { results } = await db
    .prepare(`${REGISTRATIONS_WITH_PARTICIPANTS} WHERE r.race_id = ? AND r.${by} = ? ORDER BY p.slot`)
    .bind(raceId, value)
    .all<RegistrationRow>();
  return groupRows(results)[0] ?? null;
}

export type UpdateResult = "saved" | "not found" | "number taken" | "number reserved";

/**
 * Sets the Registration's number, Duration and Participants, in one
 * transaction; found by its id, as its number may change meanwhile. `not
 * found` when the Race has no such Registration; nothing saved and `number
 * taken` when another of its Registrations has `number`, `number reserved`
 * when it is Reserved. The count is left as
 * it is: it skips the new number when it gets there and never comes back to the old one.
 */
export async function updateRegistration(
  db: D1Database,
  raceId: number,
  registrationId: number,
  number: number,
  content: RegistrationContent,
): Promise<UpdateResult> {
  try {
    const [updated] = await db.batch([
      db.prepare("UPDATE registrations SET number = ?, duration = ? WHERE race_id = ? AND id = ?").bind(number, content.duration, raceId, registrationId),
      db.prepare("DELETE FROM participants WHERE registration_id = ?").bind(registrationId),
      ...insertParticipants(db, content.participants, "race_id = ? AND id = ?", [raceId, registrationId]),
    ]);
    return updated!.meta.changes > 0 ? "saved" : "not found";
  } catch (error) {
    if (isNumberTaken(error)) return "number taken";
    if (isOnReservedNumber(error)) return "number reserved";
    throw error;
  }
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
 * Deletes a Registration, found by its id; its Participants and Previous
 * numbers go with it (ON DELETE CASCADE). The count gives its number out again
 * only if it hasn't got there yet (a number given by hand), or after an Admin
 * sends it back over it (see setNextNumbers). False when the Race has no such
 * Registration.
 */
export async function deleteRegistration(db: D1Database, raceId: number, registrationId: number): Promise<boolean> {
  const result = await db.prepare("DELETE FROM registrations WHERE race_id = ? AND id = ?").bind(raceId, registrationId).run();
  return result.meta.changes > 0;
}

async function findByAttempt(db: D1Database, raceId: number, attemptId: string): Promise<StoredRegistration | null> {
  const { results } = await db
    .prepare(`${REGISTRATIONS_WITH_PARTICIPANTS} WHERE r.race_id = ? AND r.attempt_id = ? ORDER BY p.slot`)
    .bind(raceId, attemptId)
    .all<RegistrationRow>();
  return groupRows(results)[0] ?? null;
}

/** Whether two Registrations say exactly the same: Duration, and each Participant in the same slot. */
function sameContent(a: RegistrationContent, b: RegistrationContent): boolean {
  const same = (p: ParticipantInput, q: ParticipantInput) =>
    p.gender === q.gender && p.title === q.title && p.firstName === q.firstName && p.lastName === q.lastName && p.birthYear === q.birthYear && p.club === q.club;
  return a.duration === b.duration && a.participants.length === b.participants.length && a.participants.every((p, slot) => same(p, b.participants[slot]!));
}

/** What the confirmation screen shows of a stored Registration. */
function answerFor(number: number, stored: RegistrationContent, differs: boolean): SubmitAnswer {
  return {
    number,
    duration: stored.duration,
    division: divisionOfRegistration(stored),
    participants: stored.participants.map(({ title, firstName, lastName }) => ({ title, firstName, lastName })),
    differs,
  };
}

/**
 * One transaction: store the Registration with the next number of its series
 * (singles or Pairs, see `nextNumberSql` in next-numbers.ts), note that number as the series'
 * last one handed out, then store the Participants. If any step fails (e.g.
 * the attempt ID is already stored), nothing is kept, the last handed-out
 * number included. When there is no next number, nothing is stored.
 *
 * With `onlyWhileOpen`, it only stores for a Race whose Registration is open, so a
 * Race closed a moment ago stores nothing. Its number and id; null when nothing was stored.
 */
async function insertRegistration(
  db: D1Database,
  raceId: number,
  input: RegistrationInput,
  onlyWhileOpen: boolean,
): Promise<{ number: number; id: number } | null> {
  const series = seriesOf(input.participants);
  const lastColumn = lastNumberColumn(series);
  const nextNumber = nextNumberSql(series);
  const registration = db
    .prepare(
      `INSERT INTO registrations (race_id, number, duration, attempt_id)
       SELECT id, ${nextNumber}, ?, ? FROM races
       WHERE id = ? ${onlyWhileOpen ? "AND registration_open = 1" : ""} AND ${nextNumber} IS NOT NULL
       RETURNING number, id`,
    )
    .bind(input.duration, input.attemptId, raceId);
  const stored = "SELECT number FROM registrations WHERE race_id = ? AND attempt_id = ?";
  const lastHandedOut = db
    .prepare(`UPDATE races SET ${lastColumn} = (${stored}) WHERE id = ? AND EXISTS (${stored})`)
    .bind(raceId, input.attemptId, raceId, raceId, input.attemptId);
  const participants = insertParticipants(db, input.participants, "race_id = ? AND attempt_id = ?", [raceId, input.attemptId]);
  const [inserted] = await db.batch<{ number: number; id: number }>([registration, lastHandedOut, ...participants]);
  return inserted!.results[0] ?? null;
}
