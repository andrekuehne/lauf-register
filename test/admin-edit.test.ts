import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { anna, ben, clara, registration } from "./fixtures";
import { adminRacePath, asAdmin, editPath, newRace, postEdit, request, submit } from "./http";
import { readXlsx, type Cell } from "./xlsx";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

type Participant = { gender: string; title: string; firstName: string; lastName: string; birthYear: number | string; club: string | null };

async function register(raceLink: string, participants: Participant[], duration = 60): Promise<number> {
  const res = await submit(raceLink, registration({ participants, duration }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { number: number }).number;
}

/** The edit form's fields as the browser posts them: Duration, single or pair, then Participant 1 and 2. */
function form(duration: number, participants: Participant[], singleOrPair = participants.length === 2 ? "pair" : "single") {
  const fields: Record<string, string> = { duration: String(duration), singleOrPair };
  participants.forEach((p, i) => {
    const prefix = `p${i + 1}.`;
    fields[`${prefix}gender`] = p.gender;
    fields[`${prefix}title`] = p.title;
    fields[`${prefix}firstName`] = p.firstName;
    fields[`${prefix}lastName`] = p.lastName;
    fields[`${prefix}birthYear`] = String(p.birthYear);
    fields[`${prefix}club`] = p.club ?? "";
  });
  return fields;
}

/** The Race's export rows (without the header), keyed by StartNr: what is stored, cell by cell. */
async function stored(raceLink: string): Promise<Map<number, Cell[]>> {
  const res = await asAdmin(`${adminRacePath(raceLink)}/export.xlsx`);
  const { rows } = readXlsx(new Uint8Array(await res.arrayBuffer()));
  return new Map(rows.slice(1).map((row) => [row[0] as number, Array.from({ length: 14 }, (_, i) => row[i] ?? null)]));
}

describe("the edit form", () => {
  it("shows the Registration's stored details", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben], 30);

    const res = await asAdmin(editPath(race, 1001));

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/name="duration" value="30" checked/);
    expect(html).toMatch(/name="singleOrPair" value="pair" checked/);
    expect(html).toMatch(/name="p1.gender" value="F" checked/);
    expect(html).toMatch(/name="p1.title" value="dr" checked/);
    expect(html).toContain('value="Muster"');
    expect(html).toContain('value="1985"');
    expect(html).toContain('value="LG Nord"');
    expect(html).toMatch(/name="p2.gender" value="M" checked/);
    expect(html).toContain('value="Beispiel"');
  });

  it("is reached from the Registration on the Race's admin page", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    expect(await (await asAdmin(adminRacePath(race))).text()).toContain(`href="${editPath(race, 1)}"`);
  });
});

describe("editing a Registration", () => {
  it("saves Gender, Title, names, birth year and club, and keeps the Registration number", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const res = await postEdit(race, 1, form(60, [{ gender: "M", title: "none", firstName: "Andreas", lastName: "Meister", birthYear: 1984, club: "TSV Süd" }]));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(adminRacePath(race));
    expect((await stored(race)).get(1)).toEqual([1, 2, "Meister", "Andreas", null, 1984, "m", "TSV Süd", null, null, null, null, null, null]);
  });

  it("changes the Duration", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna], 60);

    await postEdit(race, 1, form(30, [anna]));

    expect((await stored(race)).get(1)![1]).toBe(1);
  });

  it("turns a single into a Pair with a second Participant, keeping the number", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const res = await postEdit(race, 1, form(60, [anna, ben]));

    expect(res.status).toBe(303);
    expect((await stored(race)).get(1)).toEqual([1, 2, "Muster", "Anna", "Dr.", 1985, "w", "LG Nord", "Beispiel", "Ben", null, 1990, "m", null]);
    expect(await (await asAdmin(adminRacePath(race))).text()).toContain("Mixed-Paar");
  });

  it("refuses a Pair without a complete second Participant and changes nothing", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const res = await postEdit(race, 1, form(60, [anna], "pair"));

    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Bitte ausfüllen");
    expect((await stored(race)).get(1)![8]).toBeNull();
  });

  it("turns a Pair into a single, removing the second Participant and keeping the number", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben]);

    // The second Participant's fields are still in the form; "single" means they're dropped.
    const res = await postEdit(race, 1001, form(60, [anna, ben], "single"));

    expect(res.status).toBe(303);
    expect((await stored(race)).get(1001)).toEqual([1001, 2, "Muster", "Anna", "Dr.", 1985, "w", "LG Nord", null, null, null, null, null, null]);
    expect(await (await asAdmin(adminRacePath(race))).text()).not.toContain("Ben Beispiel");
  });

  it("changes a Pair's Division through the Genders (Mixed to Women's pair)", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben]);

    await postEdit(race, 1001, form(60, [anna, clara]));

    const page = await (await asAdmin(adminRacePath(race))).text();
    expect(page).toContain("Frauen-Paar");
    expect(page).not.toContain("Mixed-Paar");
  });

  const invalid: [string, Record<string, string>, string][] = [
    ["no Duration", { duration: "" }, "Bitte wählen"],
    ["an unknown Duration", { duration: "45" }, "Bitte wählen"],
    ["neither single nor pair", { singleOrPair: "trio" }, "Bitte wählen"],
    ["no Gender", { "p1.gender": "" }, "Bitte wählen"],
    ["an unknown Title", { "p1.title": "prof" }, "Bitte wählen"],
    ["an empty first name", { "p1.firstName": "  " }, "Bitte ausfüllen"],
    ["an overlong last name", { "p1.lastName": "x".repeat(101) }, "Höchstens 100 Zeichen"],
    ["a malformed birth year", { "p1.birthYear": "19x5" }, "4 Ziffern"],
    ["a birth year before 1800", { "p1.birthYear": "1799" }, "Vor 1800 nicht möglich"],
    ["a birth year after the Race's year", { "p1.birthYear": "2027" }, "Liegt nach dem Lauf"],
    ["an overlong club", { "p1.club": "x".repeat(101) }, "Höchstens 100 Zeichen"],
  ];

  it.each(invalid)("refuses %s with a message, keeping the entered values, and changes nothing", async (_, change, message) => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    const before = (await stored(race)).get(1);

    const res = await postEdit(race, 1, { ...form(60, [{ ...anna, firstName: "Annette" }]), ...change });

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(message);
    if (!("p1.firstName" in change)) expect(html).toContain('value="Annette"');
    expect((await stored(race)).get(1)).toEqual(before);
  });

  it("checks the second Participant of a Pair by the same rules", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben]);

    const res = await postEdit(race, 1001, form(60, [anna, { ...ben, birthYear: 2027, lastName: "x".repeat(101) }]));

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Liegt nach dem Lauf");
    expect(html).toContain("Höchstens 100 Zeichen");
    expect((await stored(race)).get(1001)![12]).toBe("m");
  });

  it("accepts a birth year with spaces around it, as the public form does", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const res = await postEdit(race, 1, { ...form(60, [anna]), "p1.birthYear": " 1986 " });

    expect(res.status).toBe(303);
    expect((await stored(race)).get(1)![5]).toBe(1986);
  });

  it("is only for signed-in Admins, and answers 404 for an unknown Registration or one of another Race", async () => {
    const race = await newRace("Stundenlauf");
    const other = await newRace("Anderer Lauf");
    await register(race, [anna]);
    await register(other, [ben, clara]);

    const anonymous = await postEdit(race, 1, form(60, [ben]), {});
    const anonymousForm = await request(editPath(race, 1));
    const unknown = await postEdit(race, 7, form(60, [ben]));
    const fromOtherRace = await postEdit(race, 1001, form(60, [ben]));
    const unknownForm = await asAdmin(editPath(race, 7));

    expect(anonymous.status).toBe(403);
    expect(anonymousForm.status).toBe(403);
    expect(unknown.status).toBe(404);
    expect(fromOtherRace.status).toBe(404);
    expect(unknownForm.status).toBe(404);
    expect((await stored(race)).get(1)![3]).toBe("Anna");
    expect((await stored(other)).get(1001)![3]).toBe("Ben");
  });
});
