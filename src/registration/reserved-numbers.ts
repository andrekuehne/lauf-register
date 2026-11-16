// Reserved numbers in D1 (see GLOSSARY.md): listing a Race's, reserving a number
// or range (giving Registrations on it new numbers), and removing a range.

import type { ReservedRange } from "../domain/reserved-numbers";
import { isNoNumberLeft, listRegistrationsWithin, renumberStatements, type StoredRegistration } from "./registrations";

/** A Race's Reserved numbers, ascending. */
export async function listReservedNumbers(db: D1Database, raceId: number): Promise<number[]> {
  const { results } = await db
    .prepare("SELECT number FROM reserved_numbers WHERE race_id = ? ORDER BY number")
    .bind(raceId)
    .all<{ number: number }>();
  return results.map((row) => row.number);
}

/** Removes the range's numbers from the Race's Reserved numbers. Registrations keep the numbers they have. */
export async function removeReservedNumbers(db: D1Database, raceId: number, range: ReservedRange): Promise<void> {
  await db.prepare("DELETE FROM reserved_numbers WHERE race_id = ? AND number BETWEEN ? AND ?").bind(raceId, range.from, range.to).run();
}

/** A Registration that had a number just reserved, and the number it has now. */
export type Move = { registration: StoredRegistration; to: number };

/** The new numbers of the Registrations that were on the range, or `noNumberLeft` when nothing was reserved. */
export type ReserveResult = { moves: Move[] } | { noNumberLeft: true };

/**
 * Reserves every number of the range for the Race (numbers already Reserved
 * stay so) and gives each Registration on one of them the next automatic number
 * of its series, as if it registered now, in number order. When one of them
 * gets no number, nothing is kept: `noNumberLeft`.
 *
 * A Registration submitted between finding the taken numbers and storing the
 * reservation may still land on the range, even when nobody was on it before;
 * a second round moves it. After the first round nobody new can land there.
 */
export async function reserveNumbers(db: D1Database, raceId: number, range: ReservedRange): Promise<ReserveResult> {
  const first = await reserveAndRenumber(db, raceId, range);
  if ("noNumberLeft" in first) return first;
  const latecomers = await reserveAndRenumber(db, raceId, range);
  // A latecomer that gets no number keeps its own, like any Registration on a Reserved number.
  return { moves: "noNumberLeft" in latecomers ? first.moves : [...first.moves, ...latecomers.moves] };
}

/**
 * One transaction: reserve the range, then give each Registration on it its
 * new number. When one of them gets none, nothing is kept.
 */
async function reserveAndRenumber(db: D1Database, raceId: number, range: ReservedRange): Promise<ReserveResult> {
  const taken = await listRegistrationsWithin(db, raceId, range);
  const statements = [
    db
      .prepare(
        `WITH RECURSIVE n(number) AS (SELECT ? UNION ALL SELECT number + 1 FROM n WHERE number < ?)
         INSERT OR IGNORE INTO reserved_numbers (race_id, number) SELECT ?, number FROM n`,
      )
      .bind(range.from, range.to, raceId),
  ];
  // Where in the batch's results each Registration's new number comes back.
  const answerAt = taken.map((registration) => {
    const [noteLast, move] = renumberStatements(db, raceId, registration);
    statements.push(noteLast, move);
    return statements.length - 1;
  });
  try {
    const results = await db.batch<{ number: number }>(statements);
    const moves: Move[] = [];
    taken.forEach((registration, index) => {
      // None when the Registration was deleted meanwhile.
      const moved = results[answerAt[index]!]!.results[0];
      if (moved) moves.push({ registration, to: moved.number });
    });
    return { moves };
  } catch (error) {
    if (isNoNumberLeft(error)) return { noNumberLeft: true };
    throw error;
  }
}
