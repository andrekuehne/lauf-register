// The RaceResult export: a Race's Registrations as rows in the layout the
// results software on the organizers' laptop imports (taken from their
// TeilnehmerEingabe workbook, sheet RaceResult-Liste). The whole mapping lives here.

import { GENDER_LETTER, type Duration, type Title } from "../domain/categories";
import type { Race } from "../races/races";
import type { ParticipantInput } from "../registration/registration-input";
import type { StoredRegistration } from "../registration/registrations";
import type { Cell } from "./xlsx";

export const RACERESULT_SHEET = "RaceResult-Liste";

const PERSON_COLUMNS = ["Nachname", "Vorname", "Titel", "Jahrgang", "Geschlecht", "Verein"];

/**
 * The second Participant of a Pair goes into the "Läufer 2 …" columns. TBC against a
 * real RaceResult import: an older sheet names them ZF10–ZF15 (same order).
 */
export const RACERESULT_HEADER = ["StartNr", "Wettbewerb", ...PERSON_COLUMNS, ...PERSON_COLUMNS.map((c) => `Läufer 2 ${c}`)];

const WETTBEWERB: Record<Duration, number> = { 30: 1, 60: 2 };

const TITEL: Record<Title, string | null> = { none: null, dr: "Dr." };

function personCells(p: ParticipantInput | undefined): Cell[] {
  if (!p) return PERSON_COLUMNS.map(() => null);
  return [p.lastName, p.firstName, TITEL[p.title], p.birthYear, GENDER_LETTER[p.gender], p.club];
}

/** "Stundenlauf-Gruen-2026-12-09.xlsx": the Race's name in plain ASCII, then its date. */
export function raceResultFileName(race: Race): string {
  const ascii = race.name
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${ascii || "Lauf"}-${race.date}.xlsx`;
}

/** The header row, then one row per Registration in Registration-number order (singles 1…, then Pairs 1001…). */
export function raceResultRows(registrations: StoredRegistration[]): Cell[][] {
  const byNumber = [...registrations].sort((a, b) => a.number - b.number);
  return [
    RACERESULT_HEADER,
    ...byNumber.map((r) => [r.number, WETTBEWERB[r.duration], ...personCells(r.participants[0]), ...personCells(r.participants[1])]),
  ];
}
