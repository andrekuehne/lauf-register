// All UI strings, one dictionary per language. German is the default.
// Placeholders like {n} are filled with `fill()` from shared/fill; dictionaries stay plain
// data so the registration flow can ship its part to the browser as JSON.

import type { Division, Gender, SingleOrPair, Title } from "./domain/categories";

export const LANGS = ["de", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "de";

/** Shown in the switch in their own language, never translated. */
export const LANG_NAMES: Record<Lang, string> = { de: "Deutsch", en: "English" };

export function isLang(value: unknown): value is Lang {
  return (LANGS as readonly unknown[]).includes(value);
}

type Choice = { name: string; detail: string };

const de = {
  appName: "Lauf-Register",
  home: {
    text: "Die Anmeldung zum Lauf ist hier bald möglich.",
  },
  notFound: {
    title: "Seite nicht gefunden",
    text: "Bitte prüfe den Link oder scanne den QR-Code erneut.",
  },
  raceNotFound: {
    title: "Lauf nicht gefunden",
    text: "Zu diesem Link gibt es keinen Lauf (mehr). Bitte scanne den QR-Code am Veranstaltungsort erneut.",
  },
  flow: {
    noscript: "Für die Anmeldung wird JavaScript benötigt. Bitte aktiviere es oder melde dich am Anmeldetisch an.",
    selectionLabel: "Deine Auswahl",
    stepOf: "Schritt {n} von {total}",
    back: "Zurück",
    next: "Weiter",
    durationHeading: "Welcher Lauf?",
    durations: {
      "30": { name: "Halbstundenlauf", detail: "30 Minuten" },
      "60": { name: "Stundenlauf", detail: "60 Minuten" },
    },
    singleOrPairHeading: "Einzeln oder zu zweit?",
    singleOrPair: {
      single: { name: "Einzeln", detail: "Eine Person" },
      pair: { name: "Zu zweit", detail: "Zwei Personen, eine Anmeldung" },
    } satisfies Record<SingleOrPair, Choice>,
    divisionHeading: "Wer läuft?",
    /** name: the button and the selection bar; category: Check and Done screens. */
    divisions: {
      women: { name: "Frau", detail: "Einzelstart", category: "Frauen" },
      men: { name: "Mann", detail: "Einzelstart", category: "Männer" },
      womens_pair: { name: "Zwei Frauen", detail: "Frauen-Paar", category: "Frauen-Paar" },
      mens_pair: { name: "Zwei Männer", detail: "Männer-Paar", category: "Männer-Paar" },
      mixed_pair: { name: "Mixed", detail: "Eine Frau und ein Mann", category: "Mixed-Paar" },
    } satisfies Record<Division, Choice & { category: string }>,
    detailsHeadingSingle: "Deine Angaben",
    pairFirst: "Erste Person",
    pairSecond: "Zweite Person",
    gender: "Geschlecht",
    genders: { F: "Frau", M: "Mann" } satisfies Record<Gender, string>,
    genderRequired: "Bitte wählen",
    genderFromFirst: "Ergibt sich aus Person 1",
    title: "Titel",
    titles: { none: "–", dr: "Dr." } satisfies Record<Title, string>,
    firstName: "Vorname",
    lastName: "Nachname",
    birthYear: "Geburtsjahr",
    club: "Verein",
    optional: "optional",
    required: "Bitte ausfüllen.",
    // Birth-year messages sit beside the narrow year field: keep them short.
    birthYearInvalid: "4 Ziffern, z. B. 1985",
    birthYearTooEarly: "Vor 1800 nicht möglich",
    birthYearFuture: "Liegt nach dem Lauf",
    birthYearCheck: "Alter {age} – bitte prüfen",
    checkHeading: "Bitte prüfen",
    age: "{age} Jahre",
    noClub: "ohne Verein",
    consent:
      "Einverstanden: Diese Angaben werden für Zeitmessung und Ergebnisliste verwendet und spätestens 30 Tage nach dem Lauf gelöscht.",
    consentRequired: "Bitte bestätige das Einverständnis.",
    submit: "Jetzt anmelden",
    submitting: "Wird gesendet …",
    offline: "Keine Verbindung. Deine Angaben bleiben gespeichert.",
    retry: "Erneut senden",
    rejected: "Die Anmeldung hat nicht geklappt. Bitte melde dich am Anmeldetisch.",
    doneHeading: "Angemeldet!",
    numberLabel: "Deine Startnummer",
    deskHint: "Zeige diese Nummer am Anmeldetisch.",
    another: "Weitere Person anmelden",
  },
};

export type Strings = typeof de;
export type FlowStrings = Strings["flow"];

const en: Strings = {
  appName: "Lauf-Register",
  home: {
    text: "Registration for the race will open here soon.",
  },
  notFound: {
    title: "Page not found",
    text: "Please check the link or scan the QR code again.",
  },
  raceNotFound: {
    title: "Race not found",
    text: "This link doesn't belong to a race (any more). Please scan the QR code at the venue again.",
  },
  flow: {
    noscript: "Registration needs JavaScript. Please turn it on or register at the race desk.",
    selectionLabel: "Your selection",
    stepOf: "Step {n} of {total}",
    back: "Back",
    next: "Next",
    durationHeading: "Which run?",
    durations: {
      "30": { name: "Half-hour run", detail: "30 minutes" },
      "60": { name: "One-hour run", detail: "60 minutes" },
    },
    singleOrPairHeading: "Alone or as a pair?",
    singleOrPair: {
      single: { name: "Alone", detail: "One person" },
      pair: { name: "As a pair", detail: "Two people, one registration" },
    },
    divisionHeading: "Who is running?",
    divisions: {
      women: { name: "Woman", detail: "Single start", category: "Women" },
      men: { name: "Man", detail: "Single start", category: "Men" },
      womens_pair: { name: "Two women", detail: "Women's pair", category: "Women's pair" },
      mens_pair: { name: "Two men", detail: "Men's pair", category: "Men's pair" },
      mixed_pair: { name: "Mixed", detail: "One woman and one man", category: "Mixed pair" },
    },
    detailsHeadingSingle: "Your details",
    pairFirst: "First person",
    pairSecond: "Second person",
    gender: "Gender",
    genders: { F: "Woman", M: "Man" },
    genderRequired: "Please choose",
    genderFromFirst: "Set by person 1",
    title: "Title",
    titles: { none: "–", dr: "Dr." },
    firstName: "First name",
    lastName: "Last name",
    birthYear: "Year of birth",
    club: "Club",
    optional: "optional",
    required: "Please fill this in.",
    birthYearInvalid: "4 digits, e.g. 1985",
    birthYearTooEarly: "Before 1800 isn't possible",
    birthYearFuture: "That's after the race",
    birthYearCheck: "Age {age} – please check",
    checkHeading: "Please check",
    age: "{age} years",
    noClub: "no club",
    consent:
      "I agree: these details are used for timing and the results list and deleted no later than 30 days after the race.",
    consentRequired: "Please confirm your consent.",
    submit: "Register now",
    submitting: "Sending …",
    offline: "No connection. Your details are kept.",
    retry: "Try again",
    rejected: "The registration didn't go through. Please go to the race desk.",
    doneHeading: "You're registered!",
    numberLabel: "Your start number",
    deskHint: "Show this number at the race desk.",
    another: "Register someone else",
  },
};

const dictionaries: Record<Lang, Strings> = { de, en };

export function strings(lang: Lang): Strings {
  return dictionaries[lang];
}
