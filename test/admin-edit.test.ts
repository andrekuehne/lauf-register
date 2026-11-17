import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { anna, ben, clara, editForm as form, registration, type Participant } from "./fixtures";
import { links, pageText } from "./admin-html";
import { adminRacePath, asAdmin, editFormRegistration, editPath, newRace, postDelete, postEdit, postReserve, request, reserveConfirmed, submit } from "./http";
import { readXlsx, type Cell } from "./xlsx";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

async function register(raceLink: string, participants: Participant[], duration = 60): Promise<number> {
  const res = await submit(raceLink, registration({ participants, duration }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { number: number }).number;
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
    expect(html).toMatch(/name="number" value="1001"/);
    expect(html).toMatch(/name="duration" value="30" checked/);
    expect(html).toMatch(/name="p1.gender" value="F" checked/);
    expect(html).toMatch(/name="p1.title" value="dr" checked/);
    expect(html).toContain('value="Muster"');
    expect(html).toContain('value="1985"');
    expect(html).toContain('value="LG Nord"');
    expect(html).toMatch(/name="p2.gender" value="M" checked/);
    expect(html).toContain('value="Beispiel"');
  });

  it("offers the Durations under „Dauer“", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const html = await (await asAdmin(editPath(race, 1))).text();

    expect(pageText(html)).toContain("Dauer Halbstundenlauf Stundenlauf");
  });

  it("is reached from the Registration on the Race's admin page", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    expect(await (await asAdmin(adminRacePath(race))).text()).toContain(`href="${editPath(race, 1)}"`);
  });

  it("shows a single one Participant and a Pair two, with no choice between single and Pair", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [anna, ben]);

    const singleForm = await (await asAdmin(editPath(race, 1))).text();
    const pairForm = await (await asAdmin(editPath(race, 1001))).text();

    expect(singleForm).toContain('name="p1.firstName"');
    expect(singleForm).not.toContain('name="p2.firstName"');
    expect(pairForm).toContain('name="p2.firstName"');
    for (const html of [singleForm, pairForm]) {
      expect(html).not.toContain('name="singleOrPair"');
      expect(html).not.toContain("Die Startnummer bleibt gleich");
    }
  });
});

describe("editing a Registration", () => {
  it("saves Gender, Title, names, birth year and club, and keeps the Registration number", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const res = await postEdit(race, 1, form(1, 60, [{ gender: "M", title: "none", firstName: "Andreas", lastName: "Meister", birthYear: 1984, club: "TSV Süd" }]));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(adminRacePath(race));
    expect((await stored(race)).get(1)).toEqual([1, 2, "Meister", "Andreas", null, 1984, "m", "TSV Süd", null, null, null, null, null, null]);
  });

  it("changes the Duration", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna], 60);

    await postEdit(race, 1, form(1, 30, [anna]));

    expect((await stored(race)).get(1)![1]).toBe(1);
  });

  it("changes the Registration number to a free one of its range", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const res = await postEdit(race, 1, form(50, 60, [anna]));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(adminRacePath(race));
    const rows = await stored(race);
    expect([...rows.keys()]).toEqual([50]);
    expect(rows.get(50)![3]).toBe("Anna");
  });

  it("refuses a number another Registration of the Race has, naming it, and changes nothing (no swapping)", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [ben]);

    const res = await postEdit(race, 1, form(2, 60, [{ ...anna, firstName: "Annette" }]));

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Startnummer 2 ist schon an Ben Beispiel vergeben.");
    expect(html).toMatch(/name="number" value="2"/);
    expect(html).toContain('value="Annette"');
    const rows = await stored(race);
    expect(rows.get(1)![3]).toBe("Anna");
    expect(rows.get(2)![3]).toBe("Ben");
  });

  it("refuses a number outside the Pairs' range 1000–1999 for a Pair", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben]);

    for (const number of ["999", "2000"]) {
      const res = await postEdit(race, 1001, { ...form(1001, 60, [anna, ben]), number });
      expect(res.status).toBe(400);
      expect(await res.text()).toContain("Paare haben Startnummern von 1000 bis 1999.");
    }
    expect([...(await stored(race)).keys()]).toEqual([1001]);
  });

  it("refuses a form opened before another Admin put a different Registration on that number, and changes nothing", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [ben]);
    const bensForm = await editFormRegistration(race, 2);
    // Meanwhile another Admin moves Ben to 50 and Anna to 2.
    expect((await postEdit(race, 2, form(50, 60, [ben]))).status).toBe(303);
    expect((await postEdit(race, 1, form(2, 60, [anna]))).status).toBe(303);

    const res = await postEdit(race, 2, { ...form(2, 60, [{ ...ben, firstName: "Benno" }]), registration: bensForm! });

    expect(res.status).toBe(409);
    expect(await res.text()).toContain("inzwischen");
    const rows = await stored(race);
    expect(rows.get(2)![3]).toBe("Anna");
    expect(rows.get(50)![3]).toBe("Ben");
  });

  it("names the new number of a Registration renumbered since its form was opened, links to its form there, and changes nothing", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [ben]);
    const bensForm = await editFormRegistration(race, 2);
    // Meanwhile 2 is Reserved: Ben moves to 3.
    await reserveConfirmed(race, "2");
    expect((await stored(race)).get(3)![3]).toBe("Ben");

    const res = await postEdit(race, 2, { ...form(2, 60, [{ ...ben, firstName: "Benno" }]), registration: bensForm! });

    expect(res.status).toBe(409);
    const html = await res.text();
    expect(pageText(html)).toContain("Diese Anmeldung hat inzwischen die Startnummer 3.");
    expect(links(html)).toContainEqual({ text: "Anmeldung 3 bearbeiten", href: editPath(race, 3) });
    expect((await stored(race)).get(3)![3]).toBe("Ben");
  });

  it("says a Registration deleted since its form was opened is gone", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    const annasForm = await editFormRegistration(race, 1);
    expect((await postDelete(race, 1)).status).toBe(303);

    const res = await postEdit(race, 1, { ...form(1, 60, [anna]), registration: annasForm! });

    expect(res.status).toBe(404);
    expect(pageText(await res.text())).toContain("Diese Anmeldung gibt es nicht (mehr).");
  });

  it("refuses a Reserved number and changes nothing: it is kept away from Participants", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    expect((await postReserve(race, "13")).status).toBe(303);

    const res = await postEdit(race, 1, form(13, 60, [{ ...anna, firstName: "Annette" }]));

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Startnummer 13 ist gesperrt. Zum Vergeben bitte erst in den Einstellungen entsperren.");
    expect(html).toContain('value="Annette"');
    const rows = await stored(race);
    expect([...rows.keys()]).toEqual([1]);
    expect(rows.get(1)![3]).toBe("Anna");
  });

  it("refuses a second Participant for a single and changes nothing", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const res = await postEdit(race, 1, form(1, 60, [anna, ben]));

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Aus Einzeln wird kein Paar und umgekehrt.");
    // The form shows the single as it is: one Participant.
    expect(html).not.toContain('name="p2.firstName"');
    expect((await stored(race)).get(1)![8]).toBeNull();
  });

  it("refuses a Pair without its second Participant and changes nothing", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben]);

    const res = await postEdit(race, 1001, form(1001, 60, [anna]));

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Aus Einzeln wird kein Paar und umgekehrt.");
    expect(html).toContain('name="p2.firstName"');
    expect((await stored(race)).get(1001)![9]).toBe("Ben");
  });

  it("changes a Pair's Division through the Genders (Mixed to Women's pair)", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben]);

    await postEdit(race, 1001, form(1001, 60, [anna, clara]));

    const page = await (await asAdmin(adminRacePath(race))).text();
    expect(page).toContain("Frauen-Paar");
    expect(page).not.toContain("Mixed-Paar");
  });

  const invalid: [string, Record<string, string>, string][] = [
    ["no Duration", { duration: "" }, "Bitte wählen"],
    ["an unknown Duration", { duration: "45" }, "Bitte wählen"],
    ["an empty number", { number: "" }, "Einzelne haben Startnummern von 1 bis 999."],
    ["a number with a letter in it", { number: "5a" }, "Einzelne haben Startnummern von 1 bis 999."],
    ["number 0", { number: "0" }, "Einzelne haben Startnummern von 1 bis 999."],
    ["a number of the Pairs' range", { number: "1000" }, "Einzelne haben Startnummern von 1 bis 999."],
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

    const res = await postEdit(race, 1, { ...form(1, 60, [{ ...anna, firstName: "Annette" }]), ...change });

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(message);
    if (!("p1.firstName" in change)) expect(html).toContain('value="Annette"');
    expect((await stored(race)).get(1)).toEqual(before);
  });

  it("checks the second Participant of a Pair by the same rules", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna, ben]);

    const res = await postEdit(race, 1001, form(1001, 60, [anna, { ...ben, birthYear: 2027, lastName: "x".repeat(101) }]));

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Liegt nach dem Lauf");
    expect(html).toContain("Höchstens 100 Zeichen");
    expect((await stored(race)).get(1001)![12]).toBe("m");
  });

  it("accepts a birth year with spaces around it, as the public form does", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const res = await postEdit(race, 1, { ...form(1, 60, [anna]), "p1.birthYear": " 1986 " });

    expect(res.status).toBe(303);
    expect((await stored(race)).get(1)![5]).toBe(1986);
  });

  it("is only for signed-in Admins, and answers 404 for an unknown Registration or one of another Race", async () => {
    const race = await newRace("Stundenlauf");
    const other = await newRace("Anderer Lauf");
    await register(race, [anna]);
    await register(other, [ben, clara]);

    const anonymous = await postEdit(race, 1, form(1, 60, [ben]), {});
    const anonymousForm = await request(editPath(race, 1));
    const unknown = await postEdit(race, 7, form(7, 60, [ben]));
    const fromOtherRace = await postEdit(race, 1001, form(1001, 60, [ben]));
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
