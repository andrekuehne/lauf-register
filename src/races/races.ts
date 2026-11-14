// Races in D1: creating, listing and looking up by public token.

import type { RaceInput } from "./race-input";

export type Race = {
  id: number;
  token: string;
  name: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  createdAt: string;
  createdBy: string;
};

export type RaceListItem = Race & { registrationCount: number };

type RaceRow = { id: number; token: string; name: string; date: string; created_at: string; created_by: string };

const fromRow = (row: RaceRow): Race => ({
  id: row.id,
  token: row.token,
  name: row.name,
  date: row.date,
  createdAt: row.created_at,
  createdBy: row.created_by,
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
  const { results } = await db.prepare("SELECT * FROM races ORDER BY date DESC, id DESC").all<RaceRow>();
  // Registrations arrive with #5; until then every Race has none.
  return results.map((row) => ({ ...fromRow(row), registrationCount: 0 }));
}

export async function findRaceByToken(db: D1Database, token: string): Promise<Race | null> {
  const row = await db.prepare("SELECT * FROM races WHERE token = ?").bind(token).first<RaceRow>();
  return row ? fromRow(row) : null;
}
