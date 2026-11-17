// The Next number (see GLOSSARY.md): where a series' count continues, shown and
// set on the Race settings page, and the warning on the Race page before a
// series runs out.

import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { anna, editForm, pairRegistration as pair, registration as single } from "./fixtures";
import { formFields, links, pageText } from "./admin-html";
import {
  adminRacePath,
  asAdmin,
  editPath,
  newRace,
  nextNumbersConfirmationOn,
  nextNumbersForm,
  numberOf,
  postDelete,
  postEdit,
  postNextNumbers,
  postReserve,
  settingsPath,
  submit,
} from "./http";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

describe("Next numbers on the Race settings page", () => {
  it("come with a note: numbers handed out don't change, and what setting one higher or lower does", async () => {
    const race = await newRace("Stundenlauf");

    const page = pageText(await (await asAdmin(settingsPath(race))).text());

    expect(page).toContain(
      "Vergebene Startnummern ändern sich nicht. Die nächste neue Anmeldung bekommt diese Startnummer oder die nächste freie danach; " +
        "vergebene, gesperrte und „vorher“-Startnummern werden übersprungen.",
    );
    expect(page).toContain(
      "Höher setzen: Die Nummern dazwischen werden nicht automatisch vergeben. Niedriger setzen: Freie Nummern dazwischen werden wieder " +
        "vergeben – davor kommt eine Rückfrage.",
    );
  });

  it("of a new Race are the First numbers it was created with, which it hands out first; the settings form has no First numbers", async () => {
    const race = await newRace("Nikolauslauf", "2026-12-09", { firstSingleNumber: 181, firstPairNumber: 1061 });

    const page = await (await asAdmin(settingsPath(race))).text();

    expect(formFields(page, "next-numbers")).toMatchObject({ nextSingleNumber: "181", nextPairNumber: "1061" });
    expect(page).not.toContain("firstSingleNumber");
    expect(page).not.toContain("Erste Startnummer");
    expect(await numberOf(await submit(race, single()))).toBe(181);
    expect(await numberOf(await submit(race, pair()))).toBe(1061);
  });

  it("show where each series' count continues, and an empty field with a note when a series has no number left", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 998, firstPairNumber: 1023 });
    await submit(race, pair()); // 1023
    expect(await nextNumbersForm(race)).toMatchObject({ nextSingleNumber: "998", nextPairNumber: "1024" });

    await submit(race, single()); // 998
    await submit(race, single()); // 999

    const page = await (await asAdmin(settingsPath(race))).text();
    expect(formFields(page, "next-numbers")).toMatchObject({ nextSingleNumber: "", nextPairNumber: "1024" });
    expect(pageText(page)).toContain("Keine Startnummer mehr frei.");
  });
});

describe("Setting a Next number", () => {
  it("skips ahead without asking: the next Registration of that series gets the number typed, the other series counts on", async () => {
    const race = await newRace("Stundenlauf");
    await submit(race, single()); // 1

    const res = await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextSingleNumber: "300" });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${settingsPath(race)}#next`);
    expect(await numberOf(await submit(race, single()))).toBe(300);
    expect(await numberOf(await submit(race, pair()))).toBe(1001);
  });

  const invalid: [string, string, string, string][] = [
    ["below the range", "nextSingleNumber", "0", "Bitte eine Zahl von 1 bis 999 eingeben."],
    ["above the range", "nextSingleNumber", "1000", "Bitte eine Zahl von 1 bis 999 eingeben."],
    ["that isn't a number", "nextSingleNumber", "abc", "Bitte eine Zahl von 1 bis 999 eingeben."],
    ["left empty", "nextSingleNumber", " ", "Bitte eine Zahl von 1 bis 999 eingeben."],
    ["of the singles' range for Pairs", "nextPairNumber", "999", "Bitte eine Zahl von 1000 bis 1999 eingeben."],
  ];

  it.each(invalid)("refuses a value %s with a message, keeps what was typed and changes nothing", async (_, field, typed, message) => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 181 });

    const res = await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextSingleNumber: "500", [field]: typed });

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(pageText(html)).toContain(message);
    expect(formFields(html, "next-numbers")).toMatchObject({ [field]: typed });
    expect(await numberOf(await submit(race, single()))).toBe(181);
    expect(await numberOf(await submit(race, pair()))).toBe(1001);
  });

  it("leaves a series alone whose field still shows what it showed when the page was opened", async () => {
    const race = await newRace("Stundenlauf");
    const opened = await nextNumbersForm(race); // singles 1, Pairs 1001
    await submit(race, single()); // 1, meanwhile
    await postDelete(race, 1);

    const res = await postNextNumbers(race, { ...opened, nextPairNumber: "1500" });

    expect(res.status).toBe(303);
    // Not 1 again: the field still showed 1, so the singles' count is untouched.
    expect(await numberOf(await submit(race, single()))).toBe(2);
    expect(await numberOf(await submit(race, pair()))).toBe(1500);
  });

  it("answers 404 for an unknown Race and 403 without an Admin", async () => {
    const race = await newRace("Stundenlauf");
    const form = { ...(await nextNumbersForm(race)), nextSingleNumber: "300" };

    expect((await postNextNumbers("/r/zzzzzzzzzz", form)).status).toBe(404);
    expect((await postNextNumbers(race, form, {})).status).toBe(403);
    expect(await numberOf(await submit(race, single()))).toBe(1);
  });
});

describe("Sending the count back", () => {
  it("asks first, listing the free numbers it would hand out again; confirmed, the count goes on from there (a First number typo)", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 995 });
    for (let i = 0; i < 5; i++) await submit(race, single()); // 995–999
    expect((await submit(race, single())).status).toBe(409);

    const asked = await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextSingleNumber: "181" });

    expect(asked.status).toBe(200);
    const question = await asked.text();
    expect(pageText(question)).toContain(
      "Diese Startnummern sind frei und werden dann wieder vergeben: Einzelne: 181–994 " +
        "Meist gehörten sie zu gelöschten Anmeldungen. Ist eine davon noch im Umlauf, bitte erst sperren.",
    );
    expect(links(question)).toContainEqual({ text: "Abbrechen", href: `${settingsPath(race)}#next` });
    // Nothing changes before the Admin confirms.
    expect((await submit(race, single())).status).toBe(409);

    const confirmed = await postNextNumbers(race, nextNumbersConfirmationOn(question)!);

    expect(confirmed.status).toBe(303);
    expect(await numberOf(await submit(race, single()))).toBe(181);
    expect(await numberOf(await submit(race, single()))).toBe(182);
  });

  it("goes below where the Race's numbering began, asking first even before anyone registered; Registrations keep their numbers", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 181 });

    const question = await (await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextSingleNumber: "150" })).text();
    expect(pageText(question)).toContain("wieder vergeben: Einzelne: 150–180");
    // Nothing changes before the Admin confirms.
    expect(await numberOf(await submit(race, single()))).toBe(181);

    expect((await postNextNumbers(race, nextNumbersConfirmationOn(question)!)).status).toBe(303);

    expect(await numberOf(await submit(race, single()))).toBe(150);
    expect((await asAdmin(editPath(race, 181))).status).toBe(200);
  });

  it("does the same for Pairs", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstPairNumber: 1998 });
    await submit(race, pair()); // 1998
    await submit(race, pair()); // 1999

    const question = await (await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextPairNumber: "1001" })).text();
    expect(pageText(question)).toContain("wieder vergeben: Paare: 1001–1997");
    await postNextNumbers(race, nextNumbersConfirmationOn(question)!);

    expect(await numberOf(await submit(race, pair()))).toBe(1001);
  });

  it("lists only numbers nobody has, and the count still skips taken, Reserved and Previous numbers (deleted Registrations)", async () => {
    const race = await newRace("Stundenlauf");
    for (let i = 0; i < 8; i++) await submit(race, single()); // 1–8
    for (const number of [2, 5, 6]) await postDelete(race, number);
    await postReserve(race, "6"); // a lost bib
    await postEdit(race, 7, editForm(20, 60, [anna])); // 7 is now a Previous number

    const question = await (await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextSingleNumber: "1" })).text();
    expect(pageText(question)).toContain("wieder vergeben: Einzelne: 2, 5 Meist");
    await postNextNumbers(race, nextNumbersConfirmationOn(question)!);

    const numbers = [];
    for (let i = 0; i < 4; i++) numbers.push(await numberOf(await submit(race, single())));
    expect(numbers).toEqual([2, 5, 9, 10]);
  });

  it("doesn't ask when every number it goes back over is taken", async () => {
    const race = await newRace("Stundenlauf");
    for (let i = 0; i < 5; i++) await submit(race, single()); // 1–5

    const res = await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextSingleNumber: "3" });

    expect(res.status).toBe(303);
    expect(await numberOf(await submit(race, single()))).toBe(6);
  });

  it("asks again when more numbers became free since the Admin was asked", async () => {
    const race = await newRace("Stundenlauf");
    for (let i = 0; i < 5; i++) await submit(race, single()); // 1–5
    await postDelete(race, 2);
    const question = await (await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextSingleNumber: "1" })).text();
    await postDelete(race, 4); // meanwhile, at the desk

    const again = await postNextNumbers(race, nextNumbersConfirmationOn(question)!);

    expect(again.status).toBe(200);
    expect(pageText(await again.text())).toContain("wieder vergeben: Einzelne: 2, 4");
    expect(await numberOf(await submit(race, single()))).toBe(6);
  });
});

describe("The warning on the Race page", () => {
  const racePage = async (raceLink: string) => pageText(await (await asAdmin(adminRacePath(raceLink))).text());

  it("says how many numbers a series has left once fewer than 20, and nothing before", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 980 }); // 980–999: 20 numbers
    expect(await racePage(race)).not.toContain("Startnummern frei");

    await submit(race, single()); // 980

    expect(await racePage(race)).toContain("Einzelne: noch 19 Startnummern frei.");
    expect(await racePage(race)).not.toContain("Paare:");
  });

  it("counts only numbers the count can still hand out: none taken, Reserved or a Previous number", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 970 });
    await postReserve(race, "990-999");
    expect(await racePage(race)).not.toContain("Startnummern frei"); // 970–989: 20

    await submit(race, single()); // 970
    await postEdit(race, 970, editForm(985, 60, [anna]));

    expect(await racePage(race)).toContain("Einzelne: noch 18 Startnummern frei.");
  });

  it("does the same for Pairs, and for singles with none left", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 999, firstPairNumber: 1980 }); // Pairs 1980–1999: 20
    expect(await racePage(race)).not.toContain("Paare:");

    await submit(race, pair()); // 1980
    await submit(race, single()); // 999

    const html = await (await asAdmin(adminRacePath(race))).text();
    expect(pageText(html)).toContain("Paare: noch 19 Startnummern frei.");
    expect(pageText(html)).toContain("Einzelne: keine Startnummer mehr frei. Neue Anmeldungen werden abgelehnt.");
    expect(links(html)).toContainEqual({ text: "Nächste Startnummer setzen", href: `${settingsPath(race)}#next` });
  });

  it("says so when a series has none left, with a link to set where it continues", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 998, firstPairNumber: 1999 });
    await submit(race, single()); // 998
    await submit(race, pair()); // 1999

    const html = await (await asAdmin(adminRacePath(race))).text();

    expect(pageText(html)).toContain("Einzelne: noch 1 Startnummer frei.");
    expect(pageText(html)).toContain("Paare: keine Startnummer mehr frei. Neue Anmeldungen werden abgelehnt.");
    expect(links(html)).toContainEqual({ text: "Nächste Startnummer setzen", href: `${settingsPath(race)}#next` });
  });
});
