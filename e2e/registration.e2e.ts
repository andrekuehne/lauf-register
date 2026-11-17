// The registration flow end to end, in phone-sized WebKit and Chromium against
// the real Worker and local D1: what a Participant does on race day, and what
// the Admin then sees.

import { expect, test, type Page } from "@playwright/test";
import {
  adminRegistration,
  consentAndSubmit,
  currentStep,
  fillParticipant,
  newRace,
  raceCard,
  RACE_YEAR,
  startRegistration,
  stepHeading,
  tapChoice,
  tapNext,
} from "./helpers";

const anna = { title: "Dr." as const, firstName: "Anna", lastName: "Muster", birthYear: "1985", club: "LG Nord" };
const ANNA_SINGLE = ["Stundenlauf", "Einzeln", "Frau"];

test.describe("a Registration end to end", () => {
  test("Single: the Registration number is shown, and the Admin sees the Registration", async ({ page }) => {
    const race = await newRace(page);

    await startRegistration(page, race, ANNA_SINGLE, anna);
    await tapNext(page);
    await expect(currentStep(page)).toContainText("Dr. Anna Muster");
    await expect(currentStep(page)).toContainText("Frauen · Stundenlauf");
    const number = await consentAndSubmit(page);

    expect(number).toBe("1");
    await expect(currentStep(page)).toContainText("Dr. Anna Muster");
    await expect(page.getByText("Du warst schon angemeldet")).toBeHidden();
    const listed = await adminRegistration(page, race, number);
    await expect(listed).toContainText("Dr. Anna Muster");
    await expect(listed).toContainText("Frauen · Stundenlauf");
    await expect(listed).toContainText("w · 1985 · LG Nord");
  });

  test("same-gender Pair: both Participants, the club carried over to the second, a Pair number", async ({ page }) => {
    const race = await newRace(page);

    await startRegistration(page, race, ["Halbstundenlauf", "Zu zweit", "Zwei Männer"], {
      firstName: "Ben",
      lastName: "Beispiel",
      birthYear: "1990",
      club: "TSV Süd",
    });
    await tapNext(page);
    await expect(currentStep(page)).toHaveAttribute("data-step", "details-2");
    await expect(currentStep(page).getByLabel(/^Verein/)).toHaveValue("TSV Süd");
    await fillParticipant(page, { firstName: "Emil", lastName: "Exempel", birthYear: "1988" });
    await tapNext(page);
    const number = await consentAndSubmit(page);

    expect(number).toBe("1001");
    await expect(currentStep(page)).toContainText("Männer-Paar · Halbstundenlauf");
    const listed = await adminRegistration(page, race, number);
    await expect(listed).toContainText("Ben Beispiel");
    await expect(listed).toContainText("Emil Exempel");
    await expect(listed).toContainText("Männer-Paar");
  });

  test("the Race's own First numbers: the first single and the first Pair get them", async ({ page, context }) => {
    const race = await newRace(page, { firstSingleNumber: 7, firstPairNumber: 1023 });

    await startRegistration(page, race, ANNA_SINGLE, anna);
    await tapNext(page);
    expect(await consentAndSubmit(page)).toBe("7");

    // A second phone: its own flow from the start.
    const phone = await context.newPage();
    await startRegistration(phone, race, ["Halbstundenlauf", "Zu zweit", "Zwei Männer"], { firstName: "Ben", lastName: "Beispiel", birthYear: "1990" });
    await tapNext(phone);
    await fillParticipant(phone, { firstName: "Emil", lastName: "Exempel", birthYear: "1988" });
    await tapNext(phone);
    expect(await consentAndSubmit(phone)).toBe("1023");
  });

  test("mixed Pair: the first Participant chooses a Gender, the second gets the other one", async ({ page }) => {
    const race = await newRace(page);
    await page.goto(race);
    for (const choice of ["Stundenlauf", "Zu zweit", "Mixed"]) await tapChoice(page, choice);

    await currentStep(page).locator("label.pill").filter({ hasText: "Mann" }).tap();
    await fillParticipant(page, { firstName: "Ben", lastName: "Beispiel", birthYear: "1990" });
    await tapNext(page);
    // The second Participant's Gender is set and the other one greyed out; tapping it says why.
    await expect(currentStep(page).getByRole("radio", { name: "Frau" })).toBeChecked();
    await expect(currentStep(page).getByRole("radio", { name: "Mann" })).toBeDisabled();
    // Forced: Playwright won't tap a disabled control, but a Participant can, and should see the note.
    await currentStep(page).locator("label.pill").filter({ hasText: "Mann" }).tap({ force: true });
    await expect(currentStep(page).getByText("Ergibt sich aus Person 1")).toBeVisible();
    await fillParticipant(page, { firstName: "Clara", lastName: "Probe", birthYear: "1992" });
    await tapNext(page);
    const number = await consentAndSubmit(page);

    expect(number).toBe("1001");
    await expect(currentStep(page)).toContainText("Mixed-Paar · Stundenlauf");
    const listed = await adminRegistration(page, race, number);
    await expect(listed).toContainText("Ben Beispiel · m");
    await expect(listed).toContainText("Clara Probe · w");
  });
});

test.describe("no number left", () => {
  /** Consent and „Jetzt anmelden“ on the Check screen, without waiting for the Done screen. */
  async function trySubmit(phone: Page) {
    await currentStep(phone).getByRole("checkbox").check();
    await currentStep(phone).getByRole("button", { name: "Jetzt anmelden" }).tap();
  }

  /** On the Done screen: „Weitere Person anmelden“, so the same phone registers the next one. */
  async function another(phone: Page) {
    await currentStep(phone).getByRole("button", { name: "Weitere Person anmelden" }).tap();
    await expect(currentStep(phone)).toHaveAttribute("data-step", "duration");
  }

  test("for singles the phone says so and sends them to the desk; once closed, it says closed", async ({ page }) => {
    const race = await newRace(page, { firstSingleNumber: 999 });
    const phone = await page.context().newPage();
    await startRegistration(phone, race, ANNA_SINGLE, anna);
    await tapNext(phone);
    expect(await consentAndSubmit(phone)).toBe("999");
    await another(phone);
    await startRegistration(phone, race, ANNA_SINGLE, { ...anna, firstName: "Erika" });
    await tapNext(phone);

    await trySubmit(phone);
    await expect(currentStep(phone).getByRole("alert")).toHaveText(
      "Online sind für Einzelne keine Startnummern mehr frei. Bitte melde dich am Anmeldetisch.",
    );

    // The Admin closes Registration; the phone tries once more.
    await page.goto("/admin");
    page.once("dialog", (dialog) => dialog.accept());
    await raceCard(page, race).getByRole("button", { name: "Geschlossen" }).click();
    await expect(raceCard(page, race).getByRole("button", { name: "Geschlossen", pressed: true })).toBeVisible();
    await currentStep(phone).getByRole("button", { name: "Jetzt anmelden" }).tap();
    await expect(currentStep(phone).getByRole("alert")).toHaveText("Die Online-Anmeldung ist inzwischen geschlossen. Bitte melde dich am Anmeldetisch.");
  });

  test("for Pairs the phone says so in the plural", async ({ page }) => {
    const race = await newRace(page, { firstPairNumber: 1999 });
    const enterPair = async () => {
      await startRegistration(page, race, ["Halbstundenlauf", "Zu zweit", "Zwei Männer"], { firstName: "Ben", lastName: "Beispiel", birthYear: "1990" });
      await tapNext(page);
      await fillParticipant(page, { firstName: "Emil", lastName: "Exempel", birthYear: "1988" });
      await tapNext(page);
    };
    await enterPair();
    expect(await consentAndSubmit(page)).toBe("1999");
    await another(page);
    await enterPair();

    await trySubmit(page);

    await expect(currentStep(page).getByRole("alert")).toHaveText("Online sind für Paare keine Startnummern mehr frei. Bitte meldet euch am Anmeldetisch.");
  });
});

test("a submit whose answer got lost, sent again with a changed name: the confirmation shows the Registration as stored, with a note", async ({ page }) => {
  const race = await newRace(page);
  await startRegistration(page, race, ANNA_SINGLE, anna);
  await tapNext(page);
  // The first submit reaches the server and is stored, but its answer never reaches the phone.
  await page.route(`**${race}/registrations`, async (route) => {
    await route.fetch();
    await route.abort();
  }, { times: 1 });
  await currentStep(page).getByRole("checkbox").check();
  await currentStep(page).getByRole("button", { name: "Jetzt anmelden" }).tap();
  await expect(currentStep(page).getByText("Keine Verbindung")).toBeVisible();

  await currentStep(page).getByRole("button", { name: "Zurück" }).tap();
  await currentStep(page).getByLabel("Nachname").fill("Mustermann");
  await tapNext(page);
  await currentStep(page).getByRole("button", { name: "Erneut senden" }).tap();

  await expect(currentStep(page)).toHaveAttribute("data-step", "done");
  const done = currentStep(page);
  await expect(page.locator("#done-number")).toHaveText("1");
  await expect(done).toContainText("Dr. Anna Muster");
  await expect(done).not.toContainText("Mustermann");
  await expect(done).toContainText("Du warst schon angemeldet. Gespeichert ist, was hier steht.");
  await expect(page.locator("#bar-sel")).not.toContainText("Mustermann");
  // Still the same after a reload.
  await page.reload();
  await expect(done).not.toContainText("Mustermann");
  await expect(done).toContainText("Du warst schon angemeldet.");
  const listed = await adminRegistration(page, race, "1");
  await expect(listed).toContainText("Dr. Anna Muster");
  await expect(listed).not.toContainText("Mustermann");
});

test.describe("entered data is kept", () => {
  test("through the phone's back button and a jump from the selection bar", async ({ page }) => {
    const race = await newRace(page);
    await startRegistration(page, race, ANNA_SINGLE, anna);
    await tapNext(page);
    await expect(currentStep(page)).toHaveAttribute("data-step", "check");

    await page.goBack();
    await expect(currentStep(page)).toHaveAttribute("data-step", "details");
    await expect(currentStep(page).getByLabel("Vorname")).toHaveValue("Anna");
    await expect(currentStep(page).getByLabel("Geburtsjahr")).toHaveValue("1985");

    await page.locator("#bar-sel").getByRole("button", { name: "1 h" }).tap();
    await expect(currentStep(page)).toHaveAttribute("data-step", "duration");
    await tapChoice(page, "Halbstundenlauf");
    // Everything else is still filled in, so the flow goes straight back to Check.
    await expect(currentStep(page)).toHaveAttribute("data-step", "check");
    await expect(currentStep(page)).toContainText("Frauen · Halbstundenlauf");
    await expect(currentStep(page)).toContainText("Dr. Anna Muster");
  });

  test("through the in-app back button", async ({ page }) => {
    const race = await newRace(page);
    await startRegistration(page, race, ANNA_SINGLE, anna);

    await currentStep(page).getByRole("button", { name: "Zurück" }).tap();
    await expect(currentStep(page)).toHaveAttribute("data-step", "division");
    await tapChoice(page, "Frau");

    // The details are all still there, so the flow moves on to Check with them.
    await expect(currentStep(page)).toHaveAttribute("data-step", "check");
    await expect(currentStep(page)).toContainText("Dr. Anna Muster");
    await expect(currentStep(page)).toContainText("1985");
    await expect(currentStep(page)).toContainText("LG Nord");
  });

  test("through a reload in the middle of the flow", async ({ page }) => {
    const race = await newRace(page);
    await startRegistration(page, race, ANNA_SINGLE, anna);

    await page.reload();

    await expect(currentStep(page)).toHaveAttribute("data-step", "details");
    await expect(currentStep(page).getByLabel("Vorname")).toHaveValue("Anna");
    await expect(currentStep(page).getByLabel("Nachname")).toHaveValue("Muster");
    await expect(currentStep(page).getByLabel(/^Verein/)).toHaveValue("LG Nord");
  });
});

test("consent is required before submitting", async ({ page }) => {
  const race = await newRace(page);
  await startRegistration(page, race, ["Stundenlauf", "Einzeln", "Mann"], { firstName: "Ben", lastName: "Beispiel", birthYear: "1990" });
  await tapNext(page);

  await currentStep(page).getByRole("button", { name: "Jetzt anmelden" }).tap();

  await expect(currentStep(page).getByText("Bitte bestätige das Einverständnis.")).toBeVisible();
  await expect(currentStep(page)).toHaveAttribute("data-step", "check");
  expect(await consentAndSubmit(page)).toBe("1");
});

test.describe("an unusual age gets a hint to check, without blocking", () => {
  const cases: [string, number, number][] = [
    ["a toddler", RACE_YEAR - 2, 2],
    ["born before 1920", 1915, RACE_YEAR - 1915],
  ];
  for (const [who, birthYear, age] of cases) {
    test(who, async ({ page }) => {
      const race = await newRace(page);
      await startRegistration(page, race, ["Halbstundenlauf", "Einzeln", "Mann"], {
        firstName: "Max",
        lastName: "Muster",
        birthYear: String(birthYear),
      });

      await expect(currentStep(page).getByText(`Alter ${age} – bitte prüfen`)).toBeVisible();
      await tapNext(page);
      await expect(currentStep(page)).toHaveAttribute("data-step", "check");
      await expect(currentStep(page).getByText(`Alter ${age} – bitte prüfen`)).toBeVisible();
      expect(await consentAndSubmit(page)).toBe("1");
    });
  }
});

test("the first step asks how long, in German and in English", async ({ page }) => {
  const race = await newRace(page);
  await page.goto(race);
  await expect(stepHeading(page)).toHaveText("Wie lange?");

  await page.getByRole("link", { name: "English" }).tap();

  await expect(stepHeading(page)).toHaveText("How long?");
});

test("Deutsch / English switch in the middle of the flow keeps the choices and details", async ({ page }) => {
  const race = await newRace(page);
  await page.goto(race);
  await tapChoice(page, "Stundenlauf");
  await expect(stepHeading(page)).toHaveText("Einzeln oder zu zweit?");

  await page.getByRole("link", { name: "English" }).tap();

  await expect(stepHeading(page)).toHaveText("Alone or as a pair?");
  await expect(page.locator("#bar-sel")).toContainText("1 h");
  await tapChoice(page, "Alone");
  await tapChoice(page, "Woman");
  await currentStep(page).getByLabel("First name").fill("Anna");
  await currentStep(page).getByLabel("Last name").fill("Muster");

  await page.getByRole("link", { name: "Deutsch" }).tap();

  await expect(stepHeading(page)).toHaveText("Deine Angaben");
  await expect(currentStep(page).getByLabel("Vorname")).toHaveValue("Anna");
  await expect(currentStep(page).getByLabel("Nachname")).toHaveValue("Muster");
  await expect(page.locator("#bar-sel")).toContainText("Frau");
});
