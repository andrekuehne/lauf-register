// Adding a Registration at the Anmeldetisch, from a search that finds nothing to
// the new Registration found there. Runs on the Race desk's tablet in portrait
// (768 px) and its laptop (1280 px), in both browsers (playwright.config.ts).

import { expect, test, type Page } from "@playwright/test";
import { deskPath, newRace } from "./helpers";

const search = (page: Page) => page.getByLabel("Startnummer oder Name");
const shownNumbers = (page: Page) => page.locator("li[data-registration]:visible .reg-no");
/** Participant `n`'s fields on the add form (1 or 2). */
const person = (page: Page, n: 1 | 2) => page.locator("fieldset.edit-participant").nth(n - 1);
/** Taps one of the form's pills by its text, within `scope`. */
const choose = (scope: Page | ReturnType<typeof person>, text: string) => scope.locator("label.pill").filter({ hasText: new RegExp(`^${text}$`) }).click();

test("with Registration closed, a Registration the search doesn't find is added from there, and found back on the Anmeldetisch", async ({ page }) => {
  const link = await newRace(page, { open: false });
  await page.goto(deskPath(link));

  // 1. The search finds nothing.
  await search(page).fill("Zander");
  await expect(page.getByText("Keine passende Anmeldung.")).toBeVisible();

  // 2. „Anmeldung hinzufügen“, as the note offers it.
  await page.locator(".reg-none").getByRole("link", { name: "Anmeldung hinzufügen" }).click();
  await expect(page.getByRole("heading", { name: "Anmeldung hinzufügen" })).toBeVisible();

  // 3. The form: the second person shows once „Zu zweit“ is chosen.
  await expect(person(page, 2)).toBeHidden();
  await choose(page, "Zu zweit");
  await expect(person(page, 2)).toBeVisible();
  await choose(page, "Stundenlauf");
  await choose(person(page, 1), "Frau");
  await person(page, 1).getByLabel("Vorname").fill("Zoe");
  await person(page, 1).getByLabel("Nachname").fill("Zander");
  await person(page, 1).getByLabel("Geburtsjahr").fill("1992");
  await choose(person(page, 2), "Mann");
  await person(page, 2).getByLabel("Vorname").fill("Tom");
  await person(page, 2).getByLabel("Nachname").fill("Zander");
  await person(page, 2).getByLabel("Geburtsjahr").fill("1990");
  await page.getByRole("button", { name: "Speichern" }).click();

  // 4. The number to hand out, big.
  await expect(page.getByRole("heading", { name: "Startnummer 1001 ausgeben" })).toBeVisible();
  await expect(page.getByText("Zoe Zander und Tom Zander")).toBeVisible();

  // 5. Back on the Anmeldetisch, the search finds it.
  await page.getByRole("link", { name: "Zurück zum Anmeldetisch" }).click();
  await expect(search(page)).toBeFocused();
  await page.keyboard.type("Zander");
  await expect(shownNumbers(page)).toHaveText(["1001"]);
  await expect(page.locator('li[data-registration="1001"]')).toContainText("Mixed-Paar · Stundenlauf");
});
