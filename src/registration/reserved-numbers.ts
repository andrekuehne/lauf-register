// Reserved numbers in D1 (see GLOSSARY.md): listing a Race's, reserving a number
// or range (giving Registrations on it new numbers), and removing a range.

import type { ReservedRange } from "../domain/reserved-numbers";
import { isNoNumberLeft, isOnReservedNumber, listRegistrationsWithin, renumberStatements, type StoredRegistration } from "./registrations";

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

/**
 * The new numbers of the Registrations that were on the range; `noNumberLeft`
 * when nothing was reserved; or `toConfirm` (nothing reserved) when the
 * Registrations on the range are not those the Admin confirmed.
 */
export type ReserveResult = { moves: Move[] } | { noNumberLeft: true } | { toConfirm: StoredRegistration[] };

/**
 * Reserves every number of the range for the Race (numbers already Reserved
 * stay so) and gives each Registration on one of them the next automatic number
 * of its series, as if it registered now, in number order. Only when the
 * Registrations on the range are those the Admin confirmed (by id; none
 * confirmed when nobody was on it), otherwise `toConfirm`. When one of them
 * gets no number, nothing is kept: `noNumberLeft`.
 */
export async function reserveNumbers(db: D1Database, raceId: number, range: ReservedRange, confirmed: number[]): Promise<ReserveResult> {
  // A Registration that lands on the range between listing and storing makes
  // the database refuse the reservation; the next round lists it and asks again.
  for (let round = 0; round < 3; round++) {
    const taken = await listRegistrationsWithin(db, raceId, range);
    if (!sameIds(taken, confirmed)) return { toConfirm: taken };
    const result = await reserveAndRenumber(db, raceId, range, taken);
    if (result !== "landed meanwhile") return result;
  }
  return { toConfirm: await listRegistrationsWithin(db, raceId, range) };
}

const sameIds = (taken: StoredRegistration[], confirmed: number[]) =>
  taken.length === confirmed.length && taken.every((registration) => confirmed.includes(registration.id));

/**
 * One transaction: give each Registration on the range its new number outside
 * the range, then reserve the range. When one of them gets none, nothing is
 * kept; "landed meanwhile" (nothing kept) when another Registration is on the range by then.
 */
async function reserveAndRenumber(
  db: D1Database,
  raceId: number,
  range: ReservedRange,
  taken: StoredRegistration[],
): Promise<Exclude<ReserveResult, { toConfirm: unknown }> | "landed meanwhile"> {
  const statements: D1PreparedStatement[] = [];
  // Where in the batch's results each Registration's new number comes back.
  const answerAt = taken.map((registration) => {
    statements.push(...renumberStatements(db, raceId, registration, range));
    return statements.length - 1;
  });
  statements.push(
    db
      .prepare(
        `WITH RECURSIVE n(number) AS (SELECT ? UNION ALL SELECT number + 1 FROM n WHERE number < ?)
         INSERT OR IGNORE INTO reserved_numbers (race_id, number) SELECT ?, number FROM n`,
      )
      .bind(range.from, range.to, raceId),
  );
  try {
    const results = await db.batch<{ number: number }>(statements);
    const moves: Move[] = [];
    taken.forEach((registration, index) => {
      // None when the Registration was deleted or moved off the range meanwhile.
      const moved = results[answerAt[index]!]!.results[0];
      if (moved) moves.push({ registration, to: moved.number });
    });
    return { moves };
  } catch (error) {
    if (isNoNumberLeft(error)) return { noNumberLeft: true };
    if (isOnReservedNumber(error)) return "landed meanwhile";
    throw error;
  }
}
