// The Anmeldetisch: the Race desk finds people by number or name on a tablet or
// laptop. Runs in the phone projects and in the tablet and laptop ones
// (playwright.config.ts).

import { expect, test, type Page } from "@playwright/test";
import { deskPath, newRace, registerDirectly } from "./helpers";

const search = (page: Page) => page.getByLabel("Startnummer oder Name");
/** The numbers of the Registrations the list shows, in order. */
const shownNumbers = (page: Page) => page.locator("li[data-registration]:visible .reg-no");

/** A Race with a single in each Duration and a Pair, its Anmeldetisch open; returns its public link. */
async function deskWithRegistrations(page: Page): Promise<string> {
  const link = await newRace(page);
  await registerDirectly(page, link, [{ gender: "F", firstName: "Erika", lastName: "Mustermann", birthYear: 1985 }]); // 1
  await registerDirectly(page, link, [
    { gender: "F", firstName: "Anna", lastName: "Schmidt", birthYear: 1990 },
    { gender: "M", firstName: "Ben", lastName: "Beispiel", birthYear: 1988 },
  ]); // 1001
  await registerDirectly(page, link, [{ gender: "M", firstName: "Carl", lastName: "Klein", birthYear: 1979 }], 30); // 2
  await page.goto(deskPath(link));
  return link;
}

test("the search field has focus when the Anmeldetisch opens; a number shows only the Registration with exactly that number", async ({ page }) => {
  await deskWithRegistrations(page);
  await expect(shownNumbers(page)).toHaveText(["2", "1001", "1"]);
  await expect(search(page)).toBeFocused();

  // Typed straight away, without tapping the field first.
  await page.keyboard.type("1");

  await expect(shownNumbers(page)).toHaveText(["1"]);
});

test("a Previous number shows its Registration too; an edit opened from the Anmeldetisch leads back to it", async ({ page }) => {
  const link = await deskWithRegistrations(page);
  await page.locator('li[data-registration="1"]').getByRole("link", { name: "Bearbeiten" }).click();
  await page.getByLabel("Startnummer").fill("57");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(new RegExp(`${deskPath(link)}$`));
  await expect(page.locator('li[data-registration="57"]')).toContainText("vorher 1");

  await search(page).fill("1");

  await expect(shownNumbers(page)).toHaveText(["57"]);
});

test("part of a name shows the Registrations with a Participant whose name contains it; Esc clears the search", async ({ page }) => {
  await deskWithRegistrations(page);

  // Part of a last name, in another case and with stray spaces.
  await search(page).fill("  MUSTER ");
  await expect(shownNumbers(page)).toHaveText(["1"]);

  // The second person of a Pair.
  await search(page).fill("beisp");
  await expect(shownNumbers(page)).toHaveText(["1001"]);

  await search(page).fill("Zander");
  await expect(shownNumbers(page)).toHaveCount(0);
  await expect(page.getByText("Keine passende Anmeldung.")).toBeVisible();

  await search(page).press("Escape");

  await expect(search(page)).toHaveValue("");
  await expect(shownNumbers(page)).toHaveText(["2", "1001", "1"]);
  await expect(page.getByText("Keine passende Anmeldung.")).toBeHidden();
});

test("an Anmeldetisch without Registrations says so, and nothing about the search until something is typed", async ({ page }) => {
  const link = await newRace(page);
  await page.goto(deskPath(link));

  await expect(page.getByText("Noch keine Anmeldungen.")).toBeVisible();
  await expect(search(page)).toBeFocused();
  await expect(page.getByText("Keine passende Anmeldung.")).toBeHidden();
});

test("nothing scrolls sideways, with long names, a Pair and a series without numbers left", async ({ page }) => {
  const link = await newRace(page, { firstSingleNumber: 999 });
  const long = "Wolfeschlegelsteinhausenbergerdorff";
  await registerDirectly(page, link, [{ gender: "F", firstName: "Maximiliane-Theresia", lastName: long, birthYear: 1985, title: "dr", club: `LG ${long} e. V.` }]);
  await registerDirectly(page, link, [
    { gender: "F", firstName: "Anna-Katharina", lastName: `${long}-Schmidt`, birthYear: 1990, club: "Laufgemeinschaft Nord" },
    { gender: "M", firstName: "Bartholomäus", lastName: "Beispiel", birthYear: 1988, title: "dr" },
  ]);
  await page.goto(deskPath(link));
  await expect(page.getByRole("link", { name: "Nächste Startnummer setzen" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  expect(overflow).toBe(0);
});
