// The Admin's Race cards, the Registration open/closed toggle, Reserved numbers
// and editing a Registration's number, in the same phone-sized browsers as the registration flow.

import { expect, test, type Dialog, type Locator, type Page } from "@playwright/test";
import { adminRacePath, adminRegistration, submitOnCheck, newRace, raceCard, startRegistration, tapNext } from "./helpers";

/** Taps a half of the toggle in `scope`, answers the question that follows, and returns what it asked. */
async function tapToggle(page: Page, scope: Locator, half: "Offen" | "Geschlossen", answer: "OK" | "Abbrechen"): Promise<string> {
  const asked = new Promise<string>((resolve) =>
    page.once("dialog", (dialog: Dialog) => {
      resolve(dialog.message());
      void (answer === "OK" ? dialog.accept() : dialog.dismiss());
    }),
  );
  await scope.getByRole("button", { name: half }).tap();
  return asked;
}

const state = (scope: Locator) => scope.getByRole("button", { pressed: true });

test("opening Registration asks first, showing the Next numbers and the Reserved numbers: Abbrechen keeps it closed, OK opens it", async ({ page }) => {
  const link = await newRace(page, { open: false, firstPairNumber: 1061 });
  await page.goto(`${adminRacePath(link)}/settings`);
  await page.getByLabel("Startnummer oder Bereich sperren").fill("1-180");
  await page.getByRole("button", { name: "Sperren", exact: true }).tap();
  await expect(page.getByRole("button", { name: "1–180 entsperren" })).toBeVisible();
  await page.goto("/admin");
  const card = raceCard(page, link);
  await expect(state(card)).toHaveText("✓ Geschlossen");

  const question = await tapToggle(page, card, "Offen", "Abbrechen");
  expect(question).toMatch(/^Anmeldung für ‚E2E-Lauf \w+‘ öffnen\?/);
  expect(question).toContain("\nNächste Startnummern: Einzelne 181, Paare 1061.\nGesperrt: 1–180.");
  await expect(state(card)).toHaveText("✓ Geschlossen");
  await page.reload();
  await expect(state(raceCard(page, link))).toHaveText("✓ Geschlossen");

  await tapToggle(page, raceCard(page, link), "Offen", "OK");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(state(raceCard(page, link))).toHaveText("✓ Offen");
  await page.goto(link);
  await expect(page.locator("#flow")).toBeVisible();
});

test("tapping the current state does nothing", async ({ page }) => {
  const link = await newRace(page);
  let asked = false;
  page.on("dialog", (dialog) => {
    asked = true;
    void dialog.dismiss();
  });

  await raceCard(page, link).getByRole("button", { name: "Offen" }).tap();

  await expect(state(raceCard(page, link))).toHaveText("✓ Offen");
  expect(asked).toBe(false);
});

test("closing on the Race's own page asks: Abbrechen keeps it open, OK closes it and stays on that page", async ({ page }) => {
  const link = await newRace(page);
  await page.goto(adminRacePath(link));
  await expect(state(page.locator("main"))).toHaveText("✓ Offen");

  await tapToggle(page, page.locator("main"), "Geschlossen", "Abbrechen");
  await expect(state(page.locator("main"))).toHaveText("✓ Offen");
  await page.reload();
  await expect(state(page.locator("main"))).toHaveText("✓ Offen");

  const question = await tapToggle(page, page.locator("main"), "Geschlossen", "OK");

  expect(question).toMatch(/schließen\? Neue Anmeldungen gehen dann nur noch am Anmeldetisch\.$/);
  await expect(page).toHaveURL(new RegExp(`${adminRacePath(link)}$`));
  await expect(state(page.locator("main"))).toHaveText("✓ Geschlossen");
  await page.goto(link);
  await expect(page.getByText("Anmeldetisch")).toBeVisible();
});

test("a card's buttons lead to the Race's Registrations, its public page and its own QR code", async ({ page }) => {
  const first = await newRace(page);
  const second = await newRace(page);
  const card = raceCard(page, second);
  const secondName = (await card.locator(".race-name").textContent()) ?? "";

  await card.getByRole("button", { name: "QR-Code" }).tap();
  const layer = page.getByRole("dialog");
  await expect(layer).toBeVisible();
  await expect(layer).toContainText(secondName);
  await expect(layer).toContainText(second);
  await expect(layer).not.toContainText(first);
  await layer.getByRole("button", { name: "Schließen" }).tap();
  await expect(layer).toBeHidden();

  await card.getByRole("link", { name: "Anmeldungen ansehen" }).tap();
  await expect(page).toHaveURL(new RegExp(`${adminRacePath(second)}$`));
  await page.goBack();
  await raceCard(page, second).getByRole("link", { name: "Anmeldeseite" }).tap();
  await expect(page).toHaveURL(new RegExp(`${second}(#.*)?$`));
});

test("reserving a lost bib: the Admin confirms, and the Registration gets a new number", async ({ page }) => {
  const link = await newRace(page);
  await startRegistration(page, link, ["Stundenlauf", "Einzeln", "Frau"], { firstName: "Erika", lastName: "Muster", birthYear: "1985" });
  await tapNext(page);
  expect(await submitOnCheck(page)).toBe("1");

  await page.goto(adminRacePath(link));
  await page.getByRole("link", { name: /^Einstellungen/ }).tap();
  await page.getByLabel("Startnummer oder Bereich sperren").fill("1");
  await page.getByRole("button", { name: "Sperren", exact: true }).tap();

  // The answer opens at the section, not at the top of the long page.
  await expect(page.getByRole("alert")).toBeInViewport();
  await expect(page.getByRole("alert")).toContainText(
    "Startnummer 1 ist an Erika Muster vergeben. Sie bekommt die nächste freie Startnummer; die 1 steht dann als „vorher“ auf der Karte.",
  );
  await page.getByRole("button", { name: "Sperren und neue Startnummer vergeben" }).tap();

  await expect(page.getByRole("status")).toBeInViewport();
  await expect(page.getByRole("status")).toContainText("1 → 2 (Erika Muster)");
  await expect(page.getByRole("button", { name: "1 entsperren" })).toBeVisible();
  const moved = await adminRegistration(page, link, "2");
  await expect(moved).toContainText("Erika Muster");
  // Her confirmation screen still shows 1: the desk finds her by it.
  await expect(moved).toContainText("vorher 1");
  await expect(page.locator('li[data-registration="1"]')).toHaveCount(0);
});

test("editing a Registration's number: the list shows it under the new one", async ({ page }) => {
  const link = await newRace(page);
  await startRegistration(page, link, ["Stundenlauf", "Einzeln", "Frau"], { firstName: "Erika", lastName: "Muster", birthYear: "1985" });
  await tapNext(page);
  expect(await submitOnCheck(page)).toBe("1");

  const registration = await adminRegistration(page, link, "1");
  await registration.getByRole("link", { name: "Bearbeiten" }).tap();
  await page.getByLabel("Startnummer").fill("57");
  await page.getByRole("button", { name: "Speichern" }).tap();

  await expect(page).toHaveURL(new RegExp(`${adminRacePath(link)}$`));
  await expect(page.locator('li[data-registration="57"]')).toContainText("Erika Muster");
  await expect(page.locator('li[data-registration="1"]')).toHaveCount(0);
});
