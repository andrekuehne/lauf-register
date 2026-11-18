// The Anmeldetisch: the Race desk's screen for finding Registrations on a tablet or laptop.

import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { links, pageText, postedForm, registrationToggle } from "./admin-html";
import { anna, ben, clara, editForm, emil, registration, type Participant } from "./fixtures";
import { adminRacePath, asAdmin, deskPath, newRace, postAsAdmin, postEdit, request, setRegistrationWithToggleOn, settingsPath, submit } from "./http";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

async function register(raceLink: string, participants: Participant[], duration = 60): Promise<number> {
  const res = await submit(raceLink, registration({ participants, duration }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { number: number }).number;
}

/** The Anmeldetisch as an Admin opens it now. */
async function desk(raceLink: string): Promise<string> {
  const res = await asAdmin(deskPath(raceLink));
  expect(res.status).toBe(200);
  return res.text();
}

/** The Anmeldetisch's rows, in the order shown: each Registration's number and its text as it reads on screen. */
async function deskRows(raceLink: string): Promise<[number, string][]> {
  const html = await desk(raceLink);
  return [...html.matchAll(/<li[^>]*data-registration="(\d+)"[\s\S]*?<\/li>/g)].map((m) => [Number(m[1]), pageText(m[0])]);
}

/** The warnings on a page, as they read on screen. */
const warnings = (html: string) => [...html.matchAll(/<p class="alert"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => pageText(m[1]!));

describe("the Anmeldetisch's list", () => {
  it("lists every Registration of the Race newest first, each with its number, Previous numbers, names with Title, Category, and each Participant's birth year and club", async () => {
    const race = await newRace("Stundenlauf");
    const other = await newRace("Anderer Lauf");
    await register(race, [anna]); // 1
    await register(race, [{ ...ben, title: "dr" }, clara], 30); // 1001
    await register(other, [anna]);
    await register(race, [emil]); // 2
    expect((await postEdit(race, 2, editForm(7, 60, [emil]))).status).toBe(303);

    const rows = new Map(await deskRows(race));

    expect([...rows.keys()]).toEqual([7, 1001, 1]);
    expect(rows.get(1)).toMatch(/^1 .*Frauen · Stundenlauf.*Dr\. Anna Muster · 1985 · LG Nord/);
    expect(rows.get(1)).not.toContain("vorher");
    expect(rows.get(1001)).toMatch(/^1001 .*Mixed-Paar · Halbstundenlauf.*Dr\. Ben Beispiel · 1990 · ohne Verein.*Clara Muster · 2015 · LG Nord/);
    expect(rows.get(7)).toMatch(/^7 vorher 2 .*Männer · Stundenlauf.*Emil Beispiel · 2017 · ohne Verein/);
  });

  it("shows neither Possible duplicates nor registration times: the Race page keeps those", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [anna, ben]);

    const rows = await deskRows(race);

    expect(rows).toHaveLength(2);
    for (const [, text] of rows) {
      expect(text).not.toContain("Duplikat");
      expect(text).not.toMatch(/\b\d{2}:\d{2}\b/);
    }
  });
});

describe("the Anmeldetisch's side column", () => {
  it("shows whether Registration is open, with the toggle", async () => {
    const open = await newRace("Offener Lauf");
    const closed = await newRace("Geschlossener Lauf", "2026-12-09", { open: false });

    expect(registrationToggle(await desk(open))?.state).toBe("✓ Offen");
    expect(registrationToggle(await desk(closed))?.state).toBe("✓ Geschlossen");
    expect(registrationToggle(await desk(closed))?.offer.confirm).toContain("Nächste Startnummern: Einzelne 1, Paare 1001.");
  });

  it("closes and opens Registration with the toggle, returning to the Anmeldetisch", async () => {
    const race = await newRace("Stundenlauf");

    const closed = await setRegistrationWithToggleOn(await desk(race), race, false);

    expect(closed.status).toBe(303);
    expect(closed.headers.get("location")).toBe(deskPath(race));
    expect(registrationToggle(await desk(race))?.state).toBe("✓ Geschlossen");
    expect(await (await request(race)).text()).not.toContain('id="flow"');

    const opened = await setRegistrationWithToggleOn(await desk(race), race, true);

    expect(opened.headers.get("location")).toBe(deskPath(race));
    expect(registrationToggle(await desk(race))?.state).toBe("✓ Offen");
  });

  it("shows the numbers left per series, warning below 20 free numbers", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 981 });
    await register(race, [anna]); // 981
    await register(race, [ben, clara]); // 1001

    const html = await desk(race);

    expect(pageText(html)).toContain("Paare: noch 998 Startnummern frei.");
    expect(warnings(html)).toEqual(["Einzelne: noch 18 Startnummern frei."]);
  });

  it("says when a series has no number left, with the link to set its Next number", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 999 });
    await register(race, [anna]); // 999

    const html = await desk(race);

    expect(warnings(html)).toEqual(["Einzelne: keine Startnummer mehr frei. Neue Anmeldungen werden abgelehnt. Nächste Startnummer setzen"]);
    expect(links(html)).toContainEqual({ text: "Nächste Startnummer setzen", href: `${settingsPath(race)}#next` });
  });

  it("counts the Registrations per Duration and Division", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna], 30);
    await register(race, [ben]);
    await register(race, [anna, ben]);
    await register(race, [anna, clara], 30);
    await register(race, [emil]);
    await register(race, [clara]);

    const html = await desk(race);

    const table = html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? "";
    expect([...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => pageText(m[0]))).toEqual([
      "1 h 1/2 h",
      "Frauen 1 1",
      "Männer 2 0",
      "Frauen-Paar 0 1",
      "Männer-Paar 0 0",
      "Mixed-Paar 1 0",
      "Gesamt 4 2",
    ]);
  });
});

describe("editing and deleting from the Anmeldetisch", () => {
  /** Where the link with this text in the Registration's row on the Anmeldetisch leads. */
  async function rowLink(raceLink: string, number: number, text: string): Promise<string> {
    const row = (await desk(raceLink)).match(new RegExp(`<li[^>]*data-registration="${number}"[\\s\\S]*?</li>`))?.[0] ?? "";
    const link = links(row).find((l) => l.text === text);
    if (!link) throw new Error(`Registration ${number} has no link „${text}“ on the Anmeldetisch`);
    return link.href;
  }

  /** The page behind the row's link, as an Admin opens it. */
  async function openFromDesk(raceLink: string, number: number, text: "Bearbeiten" | "Löschen"): Promise<string> {
    const res = await asAdmin(await rowLink(raceLink, number, text));
    expect(res.status).toBe(200);
    return res.text();
  }

  /** Posts the page's form as the browser does: to its action, with its hidden fields and `typed`. */
  function submitForm(html: string, typed: Record<string, string> = {}) {
    const form = postedForm(html);
    return postAsAdmin(form.action, { ...form.hidden, ...typed });
  }

  it("saving an edit opened there leads back to it; so do cancelling and the way back", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const editPage = await openFromDesk(race, 1, "Bearbeiten");

    expect(links(editPage)).toContainEqual({ text: "Abbrechen", href: deskPath(race) });
    expect(links(editPage)).toContainEqual({ text: "← Anmeldetisch", href: deskPath(race) });
    const saved = await submitForm(editPage, editForm(1, 60, [{ ...anna, firstName: "Annette" }]));
    expect(saved.status).toBe(303);
    expect(saved.headers.get("location")).toBe(deskPath(race));
    expect(new Map(await deskRows(race)).get(1)).toContain("Annette");
  });

  it("an edit opened there that needs correcting still leads back to it", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const refused = await submitForm(await openFromDesk(race, 1, "Bearbeiten"), editForm(1, 60, [{ ...anna, firstName: "" }]));

    expect(refused.status).toBe(400);
    const corrected = await refused.text();
    expect(links(corrected)).toContainEqual({ text: "Abbrechen", href: deskPath(race) });
    const saved = await submitForm(corrected, editForm(1, 60, [{ ...anna, firstName: "Annette" }]));
    expect(saved.headers.get("location")).toBe(deskPath(race));
  });

  it("an edit opened there for a Registration renumbered since leads to its page under the new number, and from there back to it", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [ben]);
    const editPage = await openFromDesk(race, 1, "Bearbeiten");
    // Meanwhile another Admin moves Ben to 50.
    expect((await postEdit(race, 1, editForm(50, 60, [ben]))).status).toBe(303);

    const res = await submitForm(editPage, editForm(1, 60, [{ ...ben, firstName: "Benno" }]));

    expect(res.status).toBe(409);
    const moved = links(await res.text()).find((l) => l.text === "Anmeldung 50 bearbeiten");
    expect(moved).toBeDefined();
    const saved = await submitForm(await (await asAdmin(moved!.href)).text(), editForm(50, 60, [{ ...ben, firstName: "Benno" }]));
    expect(saved.headers.get("location")).toBe(deskPath(race));
  });

  it("deleting opened there leads back to it; so do cancelling and the way back", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);
    await register(race, [ben]);

    const confirmation = await openFromDesk(race, 2, "Löschen");

    expect(links(confirmation)).toContainEqual({ text: "Abbrechen", href: deskPath(race) });
    expect(links(confirmation)).toContainEqual({ text: "← Anmeldetisch", href: deskPath(race) });
    const deleted = await submitForm(confirmation);
    expect(deleted.status).toBe(303);
    expect(deleted.headers.get("location")).toBe(deskPath(race));
    expect((await deskRows(race)).map(([number]) => number)).toEqual([1]);
  });
});

describe("the Anmeldetisch", () => {
  it("is linked from the Race page, next to its settings", async () => {
    const race = await newRace("Stundenlauf");

    const racePage = await (await asAdmin(adminRacePath(race))).text();

    const shown = links(racePage).map((l) => l.text);
    expect(links(racePage)).toContainEqual({ text: "Anmeldetisch", href: deskPath(race) });
    expect(shown.indexOf("Anmeldetisch") - shown.indexOf("Einstellungen (Name, Datum, Startnummern)")).toBe(1);
  });

  it("is only for signed-in Admins, and answers 404 for an unknown Race", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const anonymous = await request(deskPath(race));
    const unknown = await asAdmin(deskPath("/r/zzzzzzzzzz"));

    expect(anonymous.status).toBe(403);
    expect(await anonymous.text()).not.toContain("Muster");
    expect(unknown.status).toBe(404);
  });

  it("leaves export, settings, QR code, poster and deleting the Race to the Race page", async () => {
    const race = await newRace("Stundenlauf");
    await register(race, [anna]);

    const html = await desk(race);

    const shown = pageText(html.match(/<main>[\s\S]*<\/main>/)?.[0] ?? "");
    for (const elsewhere of ["Excel", "Einstellungen", "QR", "Aushang", "Lauf löschen"]) expect(shown).not.toContain(elsewhere);
  });
});
