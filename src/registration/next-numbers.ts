// The count of Registration numbers (see GLOSSARY.md: Registration number,
// First number, Next number): the SQL rule each series counts by, and where a
// Race's series continue.

import { SINGLE_OR_PAIR, type SingleOrPair } from "../domain/categories";
import { NUMBER_RANGES } from "../domain/numbers";
import { formatNumbers } from "../domain/reserved-numbers";
import type { PerSeries } from "../races/next-number-input";

/** The column holding the number a Race's series handed out last (0: none yet). */
export const lastNumberColumn = (series: SingleOrPair) => `last_${series}_number`;

/**
 * SQL for the numbers the count can't hand out in the Race of the enclosing
 * query's `races` row: taken by a Registration, Reserved, or a Previous number
 * (a confirmation screen may still show it).
 */
const UNAVAILABLE_NUMBERS = `
  SELECT number FROM registrations WHERE race_id = races.id
  UNION SELECT number FROM reserved_numbers WHERE race_id = races.id
  UNION SELECT p.number FROM previous_numbers p JOIN registrations r ON r.id = p.registration_id WHERE r.race_id = races.id`;

/** SQL for where a series' count starts looking: its First number, or above the number it handed out last. */
const startSql = (series: SingleOrPair) => `MAX(races.first_${series}_number, races.${lastNumberColumn(series)} + 1)`;

/**
 * SQL for the next automatic number of a series in the Race of the enclosing
 * query's `races` row, NULL when there is none: the smallest number that is at
 * least the series' First number, above the number it handed out last, within
 * its range, and available (not taken, Reserved or a Previous number). With
 * `beingReserved`, also outside a range about to be Reserved, whose last,
 * first and last number the SQL then takes as parameters, in that order.
 */
export function nextNumberSql(series: SingleOrPair, beingReserved = false): string {
  const { to } = NUMBER_RANGES[series];
  const start = startSql(series);
  // The smallest free number is the start itself or right after an unavailable one, or after the range about to be.
  return `(
    SELECT MIN(candidate) FROM (
      SELECT ${start} AS candidate
      UNION SELECT number + 1 FROM (${UNAVAILABLE_NUMBERS})
      ${beingReserved ? "UNION SELECT ? + 1" : ""}
    )
    WHERE candidate >= ${start} AND candidate <= ${to}
      AND candidate NOT IN (${UNAVAILABLE_NUMBERS})
      ${beingReserved ? "AND candidate NOT BETWEEN ? AND ?" : ""}
  )`;
}

/** Per series, the number its count hands out next; null when it has none left. */
export type NextNumbers = Record<SingleOrPair, number | null>;

/**
 * Sets where the series' counts continue: each hands out the number given next,
 * or the next available one after it. Going back over free numbers hands them out
 * again; most of them belonged to a deleted Registration, whose bib may be out.
 * So when a series would, nothing is set unless the Admin confirmed exactly
 * those numbers (as listed, see formatNumbers): `toConfirm` lists them for
 * every such series. `saved` false when there is no such Race.
 */
export async function setNextNumbers(
  db: D1Database,
  raceId: number,
  changed: PerSeries<number>,
  confirmed: PerSeries<string> = {},
): Promise<{ saved: boolean } | { toConfirm: PerSeries<string> }> {
  const series = SINGLE_OR_PAIR.filter((s) => changed[s] !== undefined);
  // A number in between that becomes free or taken while this runs makes the
  // update change nothing; the next round lists it, asking again if it is free.
  for (let round = 0; round < 3; round++) {
    const passed = await Promise.all(series.map((s) => passedOver(db, raceId, s, changed[s]!)));
    const listed: PerSeries<string> = {};
    passed.forEach((p, i) => {
      if (p.free.length > 0) listed[series[i]!] = formatNumbers(p.free);
    });
    if (SINGLE_OR_PAIR.some((s) => listed[s] !== undefined && confirmed[s] !== listed[s])) return { toConfirm: listed };
    if (series.length === 0) return { saved: await raceExists(db, raceId) };
    // The count starts looking above the number it handed out last.
    const result = await db
      .prepare(
        `UPDATE races SET ${series.map((s) => `${lastNumberColumn(s)} = ?`).join(", ")}
         WHERE id = ? ${series.map(() => `AND (SELECT COUNT(*) FROM (${UNAVAILABLE_NUMBERS}) WHERE number BETWEEN ? AND ?) = ?`).join(" ")}`,
      )
      .bind(...series.map((s) => changed[s]! - 1), raceId, ...passed.flatMap((p, i) => [changed[series[i]!]!, p.last, p.unavailable]))
      .run();
    if (result.meta.changes > 0) return { saved: true };
    if (!(await raceExists(db, raceId))) return { saved: false };
  }
  return { saved: false };
}

const raceExists = async (db: D1Database, raceId: number) => (await db.prepare("SELECT 1 FROM races WHERE id = ?").bind(raceId).first()) !== null;

/**
 * What a series' count would go back over, from `from` up to the number it
 * handed out last (`last`): the free numbers it would hand out again, and how
 * many in between are unavailable. The count has passed the free ones, so most
 * belonged to a Registration that was deleted.
 */
async function passedOver(db: D1Database, raceId: number, series: SingleOrPair, from: number): Promise<{ free: number[]; last: number; unavailable: number }> {
  const last = lastNumberColumn(series);
  const row = await db
    .prepare(
      `SELECT races.${last} AS last,
         (SELECT group_concat(number) FROM (${UNAVAILABLE_NUMBERS}) WHERE number BETWEEN ? AND races.${last}) AS unavailable
       FROM races WHERE id = ?`,
    )
    .bind(from, raceId)
    .first<{ last: number; unavailable: string | null }>();
  if (!row) return { free: [], last: 0, unavailable: 0 };
  const unavailable = new Set((row.unavailable ?? "").split(",").filter(Boolean).map(Number));
  const free: number[] = [];
  for (let number = from; number <= row.last; number++) if (!unavailable.has(number)) free.push(number);
  return { free, last: row.last, unavailable: unavailable.size };
}

/**
 * Per series, how many numbers its count can still hand out: from its Next
 * number to the top of its range, the available ones. Null when there is no such Race.
 */
export function numbersLeft(db: D1Database, raceId: number): Promise<Record<SingleOrPair, number> | null> {
  return perSeries<number>(db, raceId, (series) => {
    const start = startSql(series);
    const { to } = NUMBER_RANGES[series];
    return `MAX(0, ${to} - ${start} + 1 - (SELECT COUNT(*) FROM (${UNAVAILABLE_NUMBERS}) WHERE number BETWEEN ${start} AND ${to}))`;
  });
}

/** The Race's Next numbers; null when there is no such Race. */
export function nextNumbers(db: D1Database, raceId: number): Promise<NextNumbers | null> {
  return perSeries<number | null>(db, raceId, (series) => nextNumberSql(series));
}

/** One value per series of the Race, each the result of the series' SQL; null when there is no such Race. */
async function perSeries<T>(db: D1Database, raceId: number, sql: (series: SingleOrPair) => string): Promise<Record<SingleOrPair, T> | null> {
  const row = await db
    .prepare(`SELECT ${SINGLE_OR_PAIR.map((series) => `${sql(series)} AS ${series}`).join(", ")} FROM races WHERE id = ?`)
    .bind(raceId)
    .first<Record<SingleOrPair, T>>();
  return row ? { single: row.single, pair: row.pair } : null;
}
