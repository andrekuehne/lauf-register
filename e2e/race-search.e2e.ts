// Finding a Registration at the Race desk: the search field on the Race's admin
// page filters the list as the Admin types a number or part of a name.

import { expect, test, type Page } from "@playwright/test";
import { adminRacePath, newRace, registerDirectly } from "./helpers";

const search = (page: Page) => page.getByLabel("Startnummer oder Name");
/** The numbers of the Registrations the list shows, in order. */
const shownNumbers = (page: Page) => page.locator("li[data-registration]:visible .reg-no");

/** A Race with a single in each Duration and a Pair; returns its public link. */
async function raceWithRegistrations(page: Page): Promise<string> {
  const link = await newRace(page);
  await registerDirectly(page, link, [{ gender: "F", firstName: "Erika", lastName: "Mustermann", birthYear: 1985 }]); // 1
  await registerDirectly(page, link, [
    { gender: "F", firstName: "Anna", lastName: "Schmidt", birthYear: 1990 },
    { gender: "M", firstName: "Ben", lastName: "Beispiel", birthYear: 1988 },
  ]); // 1001
  await registerDirectly(page, link, [{ gender: "M", firstName: "Carl", lastName: "Klein", birthYear: 1979 }], 30); // 2
  await page.goto(adminRacePath(link));
  return link;
}

test("a number shows the Registration with that number", async ({ page }) => {
  await raceWithRegistrations(page);
  await expect(shownNumbers(page)).toHaveText(["1", "1001", "2"]);

  await search(page).fill("1001");

  await expect(shownNumbers(page)).toHaveText(["1001"]);
  // Its links work as in the full list.
  await page.locator('li[data-registration="1001"]').getByRole("link", { name: "Bearbeiten" }).tap();
  await expect(page).toHaveURL(/\/registrations\/1001\/edit$/);
});

test("a Previous number shows its Registration too", async ({ page }) => {
  await raceWithRegistrations(page);
  await page.locator('li[data-registration="1"]').getByRole("link", { name: "Bearbeiten" }).tap();
  await page.getByLabel("Startnummer").fill("57");
  await page.getByRole("button", { name: "Speichern" }).tap();
  await expect(page.locator('li[data-registration="57"]')).toContainText("vorher 1");

  await search(page).fill("1");

  await expect(shownNumbers(page)).toHaveText(["57"]);
});

test("letters show the Registrations with a Participant whose name contains them; groups left empty hide; clearing shows all again", async ({ page }) => {
  await raceWithRegistrations(page);
  const heading = (name: string) => page.getByRole("heading", { name: new RegExp(`^${name} · `) });

  // Part of a last name, in another case and with stray spaces.
  await search(page).fill("  MUSTER ");
  await expect(shownNumbers(page)).toHaveText(["1"]);
  await expect(heading("Frauen")).toBeVisible();
  await expect(heading("Mixed-Paar")).toBeHidden();
  await expect(heading("Halbstundenlauf")).toBeHidden();

  // The second person of a Pair.
  await search(page).fill("beisp");
  await expect(shownNumbers(page)).toHaveText(["1001"]);

  await search(page).fill("Zander");
  await expect(shownNumbers(page)).toHaveCount(0);
  await expect(page.getByText("Keine passende Anmeldung.")).toBeVisible();

  await search(page).fill("");
  await expect(shownNumbers(page)).toHaveText(["1", "1001", "2"]);
  await expect(heading("Halbstundenlauf")).toBeVisible();
  await expect(page.getByText("Keine passende Anmeldung.")).toBeHidden();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page shows the whole list and no search field", async ({ page }) => {
    await raceWithRegistrations(page);

    await expect(search(page)).toBeHidden();
    await expect(page.locator("li[data-registration] .reg-no")).toHaveText(["1", "1001", "2"]);
  });
});
