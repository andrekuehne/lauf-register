import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { anna, ben, clara, emil, registration } from "./fixtures";
import { adminRacePath, asAdmin, deletePath, newRace, postDelete, request, submit } from "./http";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

async function register(raceLink: string, participants: unknown[], duration = 60): Promise<number> {
  const res = await submit(raceLink, registration({ participants, duration }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { number: number }).number;
}

/** The Race's admin page, split into one HTML snippet per Registration, keyed by Registration number. */
async function registrationRows(raceLink: string): Promise<Map<number, string>> {
  const res = await asAdmin(adminRacePath(raceLink));
  expect(res.status).toBe(200);
  const html = await res.text();
  return new Map([...html.matchAll(/<li[^>]*data-registration="(\d+)"[\s\S]*?<\/li>/g)].map((m) => [Number(m[1]), m[0]]));
}

describe("the Registrations of a Race", () => {
  it("lists every Registration of the Race with number, time, Category and names, and none of another Race", async () => {
    const race = await newRace("Stundenlauf", "2026-12-10");
    const other = await newRace("Anderer Lauf", "2026-12-09");
    await register(race, [anna]);
    await register(race, [ben, clara], 30);
    await register(other, [emil]);

    const rows = await registrationRows(race);

    expect([...rows.keys()].sort()).toEqual([1, 1001]);
    expect(rows.get(1)).toContain("Frauen · Stundenlauf");
    expect(rows.get(1)).toContain("Dr. Anna Muster");
    expect(rows.get(1)).toMatch(/\b\d{2}:\d{2}\b/);
    expect(rows.get(1001)).toContain("Mixed-Paar · Halbstundenlauf");
    expect(rows.get(1001)).toMatch(/Ben Beispiel[\s\S]*Clara Muster/);
    expect([...rows.values()].join()).not.toContain("Emil");
  });

  it("shows each Participant's stored Gender, and the Division that follows from it", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [ben]);
    await register(race, [anna, clara]);
    await register(race, [ben, emil]);
    await register(race, [anna, ben]);

    const rows = await registrationRows(race);

    expect(rows.get(1)).toContain("Männer · Stundenlauf");
    expect(rows.get(1001)).toContain("Frauen-Paar");
    expect(rows.get(1002)).toContain("Männer-Paar");
    expect(rows.get(1003)).toContain("Mixed-Paar");
    expect(rows.get(1003)).toMatch(/Anna Muster[\s\S]*\bw\b[\s\S]*Ben Beispiel[\s\S]*\bm\b/);
  });

  it("groups them by Duration (Stundenlauf first), then Division (women, men, then Pairs), by number within a group", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna], 30); // 1
    await register(race, [ben]); // 2
    await register(race, [anna, ben]); // 1001
    await register(race, [anna, clara], 30); // 1002
    await register(race, [emil]); // 3
    await register(race, [clara]); // 4

    const rows = await registrationRows(race);
    const html = await (await asAdmin(adminRacePath(race))).text();

    expect([...rows.keys()]).toEqual([4, 2, 3, 1001, 1, 1002]);
    const headings = [...html.matchAll(/<h([23])[^>]*>([^<]*)</g)].map((m) => `${m[1]}:${m[2]!.trim()}`);
    expect(headings).toEqual([
      "2:Stundenlauf · 4",
      "3:Frauen · 1",
      "3:Männer · 2",
      "3:Mixed-Paar · 1",
      "2:Halbstundenlauf · 2",
      "3:Frauen · 1",
      "3:Frauen-Paar · 1",
    ]);
  });

  it("is reached from the Race list", async () => {
    const race = await newRace("Stundenlauf");

    const list = await (await asAdmin("/admin")).text();

    expect(list).toContain(`href="${adminRacePath(race)}"`);
  });

  it("is only for signed-in Admins, and answers 404 for an unknown Race", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const anonymous = await request(adminRacePath(race));
    const unknown = await asAdmin("/admin/races/zzzzzzzzzz");

    expect(anonymous.status).toBe(403);
    expect(await anonymous.text()).not.toContain("Muster");
    expect(unknown.status).toBe(404);
  });
});

describe("possible duplicates", () => {
  it("are flagged across Registrations, including a Participant in a Pair and as a single, but not blocked", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [ben]);
    await register(race, [{ ...anna, firstName: "anna", lastName: "MUSTER", club: null }, ben], 30);
    await register(race, [clara]);

    const rows = await registrationRows(race);

    expect(rows.size).toBe(4);
    expect(rows.get(1)).toContain("Mögliches Duplikat: Nr. 1001");
    expect(rows.get(2)).toContain("Mögliches Duplikat: Nr. 1001");
    expect(rows.get(1001)).toContain("Mögliches Duplikat: Nr. 1");
    expect(rows.get(1001)).toContain("Mögliches Duplikat: Nr. 2");
    expect(rows.get(3)).not.toContain("Duplikat");
  });

  it("need the same birth year", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [{ ...anna, birthYear: 1986 }]);

    const rows = await registrationRows(race);

    expect([...rows.values()].join()).not.toContain("Duplikat");
  });

  it("are only looked for within one Race", async () => {
    const race = await newRace("Lauf A");
    const other = await newRace("Lauf B");
    await register(race, [anna]);
    await register(other, [anna]);

    const rows = await registrationRows(race);

    expect(rows.get(1)).not.toContain("Duplikat");
  });
});

describe("deleting a Registration", () => {
  it("first asks for confirmation and deletes nothing yet", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben]);

    const confirm = await asAdmin(deletePath(race, 1001));

    expect(confirm.status).toBe(200);
    const html = await confirm.text();
    expect(html).toContain("Anna Muster");
    expect(html).toContain("Endgültig löschen");
    expect((await registrationRows(race)).has(1001)).toBe(true);
  });

  it("removes the Registration with its Participants; the counts and duplicate flags follow", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [anna, ben]);

    const res = await postDelete(race, 1001);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(adminRacePath(race));
    const rows = await registrationRows(race);
    expect([...rows.keys()]).toEqual([1]);
    expect(rows.get(1)).not.toContain("Duplikat");
    expect([...rows.values()].join()).not.toContain("Ben");
    expect(await (await asAdmin("/admin")).text()).toContain("1 Anmeldung<");
  });

  it("never gives the deleted number out again", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await postDelete(race, 1);

    expect(await register(race, [ben])).toBe(2);
  });

  it("is only for signed-in Admins, and answers 404 for an unknown Registration", async () => {
    const race = await newRace("Stundenlauf");
    const other = await newRace("Anderer Lauf");
    await register(race, [anna]);
    await register(other, [ben, clara]);

    const anonymous = await postDelete(race, 1, {});
    const unknown = await postDelete(race, 7);
    const fromOtherRace = await postDelete(race, 1001);
    const unknownConfirm = await asAdmin(deletePath(race, 7));

    expect(anonymous.status).toBe(403);
    expect(unknown.status).toBe(404);
    expect(fromOtherRace.status).toBe(404);
    expect(unknownConfirm.status).toBe(404);
    expect((await registrationRows(race)).has(1)).toBe(true);
    expect((await registrationRows(other)).has(1001)).toBe(true);
  });
});
