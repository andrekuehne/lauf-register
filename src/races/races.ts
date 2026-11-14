// Races in D1: creating, listing, looking up by public token, opening and closing Registration.

import type { RaceInput } from "./race-input";

export type Race = {
  id: number;
  token: string;
  name: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  createdAt: string;
  createdBy: string;
  /** Whether participants can register through the public link. New Races start closed. */
  registrationOpen: boolean;
};

export type RaceListItem = Race & { registrationCount: number };

type RaceRow = {
  id: number;
  token: string;
  name: string;
  date: string;
  created_at: string;
  created_by: string;
  registration_open: number;
};

const fromRow = (row: RaceRow): Race => ({
  id: row.id,
  token: row.token,
  name: row.name,
  date: row.date,
  createdAt: row.created_at,
  createdBy: row.created_by,
  registrationOpen: row.registration_open === 1,
});

// Lowercase letters and digits without look-alikes (no 0/o, 1/l/i): 31 characters.
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const TOKEN_LENGTH = 10; // 31^10 ≈ 8 · 10^14 possible links
// Bytes at or above the largest multiple of 31 are skipped, so every character is equally likely.
const UNBIASED_LIMIT = 256 - (256 % TOKEN_ALPHABET.length);

export function newRaceToken(): string {
  let token = "";
  while (token.length < TOKEN_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH))) {
      if (byte < UNBIASED_LIMIT && token.length < TOKEN_LENGTH) token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
    }
  }
  return token;
}

export async function createRace(db: D1Database, input: RaceInput & { createdBy: string }): Promise<Race> {
  for (let attempt = 0; ; attempt++) {
    try {
      const row = await db
        .prepare("INSERT INTO races (token, name, date, created_by) VALUES (?, ?, ?, ?) RETURNING *")
        .bind(newRaceToken(), input.name, input.date, input.createdBy)
        .first<RaceRow>();
      return fromRow(row!);
    } catch (error) {
      // A token collision is astronomically unlikely; retry a couple of times, then give up.
      if (attempt < 2 && String(error).includes("UNIQUE")) continue;
      throw error;
    }
  }
}

/** All Races, newest race day first. Every Admin sees every Race. */
export async function listRaces(db: D1Database): Promise<RaceListItem[]> {
  const { results } = await db
    .prepare(
      `SELECT races.*, (SELECT COUNT(*) FROM registrations WHERE race_id = races.id) AS registration_count
       FROM races ORDER BY date DESC, id DESC`,
    )
    .all<RaceRow & { registration_count: number }>();
  return results.map((row) => ({ ...fromRow(row), registrationCount: row.registration_count }));
}

/** Opens or closes Registration for a Race. False when there is no Race with that token. */
export async function setRegistrationOpen(db: D1Database, token: string, open: boolean): Promise<boolean> {
  const result = await db.prepare("UPDATE races SET registration_open = ? WHERE token = ?").bind(open ? 1 : 0, token).run();
  return result.meta.changes > 0;
}

export async function findRaceByToken(db: D1Database, token: string): Promise<Race | null> {
  const row = await db.prepare("SELECT * FROM races WHERE token = ?").bind(token).first<RaceRow>();
  return row ? fromRow(row) : null;
}
