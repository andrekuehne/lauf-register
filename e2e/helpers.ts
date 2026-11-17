import { expect, type Locator, type Page } from "@playwright/test";

/** Today in Germany, where the Races take place (YYYY-MM-DD; en-CA formats dates that way). */
const RACE_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
/** Ages in the flow are counted for the Race's year. */
export const RACE_YEAR = Number(RACE_DATE.slice(0, 4));

/**
 * Creates a Race dated today through the admin pages (First numbers as given,
 * otherwise the form's defaults), opens its Registration
 * (confirming the dialog) and returns the public link's path (/r/…). Each test
 * gets a Race of its own.
 */
export async function newRace(page: Page, options: { open?: boolean; firstSingleNumber?: number; firstPairNumber?: number } = {}): Promise<string> {
  const name = `E2E-Lauf ${Math.random().toString(36).slice(2, 8)}`;
  await page.goto("/admin");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Datum").fill(RACE_DATE);
  if (options.firstSingleNumber !== undefined) await page.getByLabel("Erste Startnummer Einzeln").fill(String(options.firstSingleNumber));
  if (options.firstPairNumber !== undefined) await page.getByLabel("Erste Startnummer Paare").fill(String(options.firstPairNumber));
  await page.getByRole("button", { name: "Lauf anlegen" }).click();
  const card = page.locator("li.card").filter({ has: page.locator(".race-name", { hasText: name }) });
  if (options.open ?? true) {
    page.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: "Offen" }).click();
    await expect(card.getByRole("button", { name: "Offen", pressed: true })).toBeVisible();
  }
  const link = await card.getByRole("link", { name: "Anmeldeseite" }).getAttribute("href");
  if (!link) throw new Error(`Race "${name}" has no public link`);
  return link;
}

/** The card of the Race whose public link this is, on the admin start page. */
export function raceCard(page: Page, raceLink: string): Locator {
  return page.locator("li.card").filter({ has: page.locator(`a[href="${raceLink}"]`) });
}

/** The Race's admin page, with its list of Registrations (the same token as the public link). */
export const adminRacePath = (raceLink: string) => `/admin/races/${raceLink.slice("/r/".length)}`;

/** The step of the flow on screen (the others are hidden). */
export const currentStep = (page: Page): Locator => page.locator("section[data-step]:visible");

/** The heading of the step on screen. */
export const stepHeading = (page: Page): Locator => currentStep(page).getByRole("heading", { level: 2 });

/** Taps one of the big choice buttons (Duration, single or pair, Division) by the start of its label. */
export async function tapChoice(page: Page, label: string): Promise<void> {
  await currentStep(page).getByRole("button", { name: new RegExp(`^${label}\\b`) }).tap();
}

/** Taps a pill (Gender, Title) by its exact text. */
export async function tapPill(page: Page, text: string): Promise<void> {
  await currentStep(page).locator("label.pill").filter({ has: page.getByText(text, { exact: true }) }).tap();
}

/** "Weiter" below a Participant's details. */
export async function tapNext(page: Page): Promise<void> {
  await currentStep(page).getByRole("button", { name: "Weiter" }).tap();
}

export type Participant = { firstName: string; lastName: string; birthYear: string; club?: string; title?: "Dr." };

/** Fills in the details of the Participant on screen; "Weiter" is left to the test. */
export async function fillParticipant(page: Page, participant: Participant): Promise<void> {
  const here = currentStep(page);
  if (participant.title) await tapPill(page, participant.title);
  await here.getByLabel("Vorname").fill(participant.firstName);
  await here.getByLabel("Nachname").fill(participant.lastName);
  await here.getByLabel("Geburtsjahr").fill(participant.birthYear);
  if (participant.club !== undefined) await here.getByLabel(/^Verein/).fill(participant.club);
}

/**
 * Opens the Race's public link, taps the choices in order (Duration, single
 * or pair, Division) and fills in the first Participant; stops before "Weiter".
 */
export async function startRegistration(page: Page, raceLink: string, choices: string[], participant: Participant): Promise<void> {
  await page.goto(raceLink);
  for (const choice of choices) await tapChoice(page, choice);
  await fillParticipant(page, participant);
}

/** On the Check screen: consent, then submit; returns the Registration number shown on the Done screen. */
export async function consentAndSubmit(page: Page): Promise<string> {
  await expect(currentStep(page)).toHaveAttribute("data-step", "check");
  await currentStep(page).getByRole("checkbox").check();
  await currentStep(page).getByRole("button", { name: "Jetzt anmelden" }).tap();
  await expect(currentStep(page)).toHaveAttribute("data-step", "done");
  return (await page.locator("#done-number").textContent()) ?? "";
}

/** The Registration with this number on the Race's admin page. */
export async function adminRegistration(page: Page, raceLink: string, number: string): Promise<Locator> {
  await page.goto(adminRacePath(raceLink));
  return page.locator(`li[data-registration="${number}"]`);
}

/** A Participant as the registration flow sends it. */
export type SentParticipant = { gender: "F" | "M"; firstName: string; lastName: string; birthYear: number };

/**
 * Registers straight through the endpoint the registration flow posts to,
 * for tests about what happens with Registrations afterwards; returns its number.
 */
export async function registerDirectly(page: Page, raceLink: string, participants: SentParticipant[], duration: 30 | 60 = 60): Promise<number> {
  const res = await page.request.post(`${raceLink}/registrations`, {
    data: {
      attemptId: crypto.randomUUID(),
      duration,
      consent: true,
      participants: participants.map((p) => ({ ...p, title: "none", club: null })),
    },
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { number: number }).number;
}
