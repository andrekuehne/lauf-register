// Adding a Registration at the Anmeldetisch: an Admin registers someone who
// hasn't registered on their phone, with Registration open or closed.

import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { pageText } from "./admin-html";
import { addForm, anna, ben, clara, editForm, registration } from "./fixtures";
import { addFormAttempt, addPath, asAdmin, deskPath, newRace, numberOf, postAdd, postEdit, reserveConfirmed, setRegistration, settingsPath, submit } from "./http";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

/** The Anmeldetisch's rows as they read on screen, newest first. */
async function deskRows(raceLink: string): Promise<string[]> {
  const html = await (await asAdmin(deskPath(raceLink))).text();
  return [...html.matchAll(/<li[^>]*data-registration="\d+"[\s\S]*?<\/li>/g)].map((m) => pageText(m[0]));
}

/** The page answering a post of the add form, as it reads on screen. */
async function answered(res: Response, status = 200): Promise<string> {
  expect(res.status).toBe(status);
  return pageText(await res.text());
}

describe("adding a Registration", () => {
  for (const open of [false, true]) {
    it(`stores a single and a Pair while Registration is ${open ? "open" : "closed"}, numbered by the same count as phone Registrations`, async () => {
      const race = await newRace("Stundenlauf");
      // Ahead of the count: 2 and 1001 Reserved, 3 a Previous number.
      await submit(race, registration({ participants: [anna] })); // 1
      await postEdit(race, 1, editForm(3, 60, [anna]));
      await postEdit(race, 3, editForm(7, 60, [anna]));
      await reserveConfirmed(race, "2");
      await reserveConfirmed(race, "1001");
      if (!open) await setRegistration(race, false);

      const single = await answered(await postAdd(race, addForm(30, [{ ...ben, club: "TV Süd" }])));
      const pair = await answered(await postAdd(race, addForm(60, [clara, { ...anna, title: "none" }])));

      expect(single).toContain("Startnummer 4 ausgeben");
      expect(single).toContain("Ben Beispiel");
      expect(pair).toContain("Startnummer 1002 ausgeben");
      expect(pair).toContain("Clara Muster und Anna Muster");
      const rows = await deskRows(race);
      expect(rows[0]).toMatch(/^1002 .*Frauen-Paar · Stundenlauf.*Clara Muster · 2015 · LG Nord.*Anna Muster · 1985 · LG Nord/);
      expect(rows[1]).toMatch(/^4 .*Männer · Halbstundenlauf.*Ben Beispiel · 1990 · TV Süd/);
      // A phone Registration afterwards goes on from there.
      if (!open) await setRegistration(race, true);
      expect(await numberOf(await submit(race, registration({ participants: [ben] })))).toBe(5);
    });
  }
});

describe("the add form", () => {
  it("opens from the Anmeldetisch, next to the search field and where the search finds nothing", async () => {
    const race = await newRace("Stundenlauf");

    const desk = await (await asAdmin(deskPath(race))).text();
    const res = await asAdmin(addPath(race));

    expect([...desk.matchAll(/<a[^>]*href="([^"]+)"[^>]*>Anmeldung hinzufügen<\/a>/g)].map((m) => m[1])).toEqual([addPath(race), addPath(race)]);
    expect(res.status).toBe(200);
    expect(pageText(await res.text())).toMatch(/Anmeldung hinzufügen.*Einzeln.*Zu zweit.*Dauer/);
  });
});

describe("saving the add form", () => {
  it("with invalid input shows the form again with its errors and stores nothing", async () => {
    const race = await newRace("Stundenlauf");
    const { kind: _, ...withoutKind } = addForm(60, [{ ...anna, lastName: " ", birthYear: "85" }]);

    const res = await postAdd(race, { ...withoutKind, duration: "" });

    const page = await answered(res, 400);
    expect(page).toContain("Bitte die markierten Angaben prüfen.");
    expect(page).toMatch(/Einzeln oder zu zweit Einzeln Zu zweit Bitte wählen\./);
    expect(page).toMatch(/Dauer Halbstundenlauf Stundenlauf Bitte wählen\./);
    expect(page).toContain("Nachname Bitte ausfüllen.");
    expect(page).toContain("Geburtsjahr 4 Ziffern, z. B. 1985");
    expect(await deskRows(race)).toEqual([]);
  });

  it("as a single leaves out the second Participant's fields, which show for a Pair only", async () => {
    const race = await newRace("Stundenlauf");

    const res = await postAdd(race, { ...addForm(60, [anna, ben]), kind: "single" });

    expect(await answered(res)).toContain("Startnummer 1 ausgeben");
    const rows = await deskRows(race);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(/^1 .*Frauen · Stundenlauf/);
    expect(rows[0]).not.toContain("Ben");
  });

  it("twice with the same attempt (a double click, a reload) stores one Registration and shows the same number", async () => {
    const race = await newRace("Stundenlauf");
    const fields = { ...addForm(60, [anna]), attempt: (await addFormAttempt(race))! };

    const first = await answered(await postAdd(race, fields));
    const again = await answered(await postAdd(race, fields));

    expect(first).toContain("Startnummer 1 ausgeben");
    expect(again).toContain("Startnummer 1 ausgeben");
    expect(again).not.toContain("schon gespeichert");
    expect(await deskRows(race)).toHaveLength(1);
  });

  it("refuses when the series has no number left, saying so with the way to set its Next number", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 999 });
    await postAdd(race, addForm(60, [anna])); // 999

    const res = await postAdd(race, addForm(60, [ben]));

    expect(res.status).toBe(409);
    const html = await res.text();
    expect(pageText(html)).toContain("Einzelne: keine Startnummer mehr frei. Nichts gespeichert. Nächste Startnummer setzen");
    expect(html).toContain(`href="${settingsPath(race)}#next"`);
    expect(await deskRows(race)).toHaveLength(1);
  });

  it("refuses an anonymous post", async () => {
    const race = await newRace("Stundenlauf");

    const res = await postAdd(race, addForm(60, [anna]), {});

    expect(res.status).toBe(403);
    expect(await deskRows(race)).toEqual([]);
  });
});
