import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { anna, ben, clara, emil, registration } from "./fixtures";
import { adminRacePath, asAdmin, newRace, request, submit } from "./http";
import { readXlsx, type Cell } from "./xlsx";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

const HEADER = [
  "StartNr",
  "Wettbewerb",
  "Nachname",
  "Vorname",
  "Titel",
  "Jahrgang",
  "Geschlecht",
  "Verein",
  "Läufer 2 Nachname",
  "Läufer 2 Vorname",
  "Läufer 2 Titel",
  "Läufer 2 Jahrgang",
  "Läufer 2 Geschlecht",
  "Läufer 2 Verein",
];

async function register(raceLink: string, participants: unknown[], duration = 60) {
  expect((await submit(raceLink, registration({ participants, duration }))).status).toBe(200);
}

const exportPath = (raceLink: string) => `${adminRacePath(raceLink)}/export.xlsx`;

async function download(raceLink: string) {
  const res = await asAdmin(exportPath(raceLink));
  expect(res.status).toBe(200);
  return { res, ...readXlsx(new Uint8Array(await res.arrayBuffer())) };
}

/** Pads a row to all fourteen columns; empty cells read as null. */
const full = (row: Cell[]) => HEADER.map((_, i) => row[i] ?? null);

describe("the RaceResult export", () => {
  it("is one sheet RaceResult-Liste: a header row, then one row per Registration, singles then Pairs by number", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [ben, anna]); // 1001
    await register(race, [anna], 30); // 1
    await register(race, [clara]); // 2

    const { res, sheetNames, rows } = await download(race);

    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="[\w.-]+\.xlsx"/);
    expect(sheetNames).toEqual(["RaceResult-Liste"]);
    expect(rows[0]).toEqual(HEADER);
    expect(rows.slice(1).map((row) => row[0])).toEqual([1, 2, 1001]);
  });

  it("fills the first eight columns for a single and all fourteen for a Pair, each person with their own details, in entered order", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna], 30);
    await register(race, [ben, { ...clara, title: "dr" }]);
    await register(race, [emil, ben]);
    await register(race, [anna, emil], 30);

    const { rows } = await download(race);

    expect(full(rows[1]!)).toEqual(full([1, 1, "Muster", "Anna", "Dr.", 1985, "w", "LG Nord"]));
    expect(full(rows[2]!)).toEqual([1001, 2, "Beispiel", "Ben", null, 1990, "m", null, "Muster", "Clara", "Dr.", 2015, "w", "LG Nord"]);
    expect(full(rows[3]!)).toEqual([1002, 2, "Beispiel", "Emil", null, 2017, "m", null, "Beispiel", "Ben", null, 1990, "m", null]);
    expect(full(rows[4]!)).toEqual([1003, 1, "Muster", "Anna", "Dr.", 1985, "w", "LG Nord", "Beispiel", "Emil", null, 2017, "m", null]);
  });

  it("codes Wettbewerb 1 for the Halbstundenlauf and 2 for the Stundenlauf", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna], 30);
    await register(race, [anna], 60);

    const { rows } = await download(race);

    expect(rows.slice(1).map((row) => row[1])).toEqual([1, 2]);
  });

  it("keeps names and clubs as entered, special characters included", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [{ ...anna, firstName: "Zoë-Ann", lastName: "O'Brien & Söhne <Jr>", club: 'SV "Grün-Weiß" 1910' }]);

    const { rows } = await download(race);

    expect(rows[1]!.slice(2, 8)).toEqual(["O'Brien & Söhne <Jr>", "Zoë-Ann", "Dr.", 1985, "w", 'SV "Grün-Weiß" 1910']);
  });

  it("holds only the header row for a Race without Registrations, and only that Race's Registrations otherwise", async () => {
    const empty = await newRace("Leerer Lauf");
    const other = await newRace("Anderer Lauf");
    await register(other, [anna]);

    const emptyExport = await download(empty);
    const otherExport = await download(other);

    expect(emptyExport.rows).toEqual([HEADER]);
    expect(otherExport.rows).toHaveLength(2);
  });

  it("is reached from the Race's admin page", async () => {
    const race = await newRace("Stundenlauf");

    const page = await (await asAdmin(adminRacePath(race))).text();

    expect(page).toContain(`href="${exportPath(race)}"`);
  });

  it("is only for signed-in Admins, and answers 404 for an unknown Race", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const anonymous = await request(exportPath(race));
    const unknown = await asAdmin("/admin/races/zzzzzzzzzz/export.xlsx");

    expect(anonymous.status).toBe(403);
    expect(anonymous.headers.get("content-type")).not.toContain("spreadsheet");
    expect(unknown.status).toBe(404);
  });
});
