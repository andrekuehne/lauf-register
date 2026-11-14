// All UI strings, one dictionary per language. German is the default.
// Placeholders like {n} are filled with `fill()` from shared/fill; dictionaries stay plain
// data so the registration flow can ship its part to the browser as JSON.

import type { Division, Title } from "./domain/categories";

export const LANGS = ["de", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "de";

/** Shown in the switch in their own language, never translated. */
export const LANG_NAMES: Record<Lang, string> = { de: "Deutsch", en: "English" };

export function isLang(value: unknown): value is Lang {
  return (LANGS as readonly unknown[]).includes(value);
}

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
    divisionHeading: "Wer läuft?",
    divisions: {
      women: { name: "Frauen", detail: "Einzelstart" },
      men: { name: "Männer", detail: "Einzelstart" },
      womens_pair: { name: "Frauen-Paar", detail: "2 Frauen" },
      mens_pair: { name: "Männer-Paar", detail: "2 Männer" },
      mixed_pair: { name: "Mixed-Paar", detail: "Frau + Mann" },
    } satisfies Record<Division, { name: string; detail: string }>,
    durationHeading: "Wie lange?",
    durations: {
      "60": { name: "60 Minuten", short: "60 Min.", detail: "1 Stunde" },
      "30": { name: "30 Minuten", short: "30 Min.", detail: "½ Stunde" },
    },
    detailsHeadingSingle: "Deine Angaben",
    pairFirst: "Erste Person",
    pairSecond: "Zweite Person",
    pairFirstNote: "Ihr startet zu zweit. Hier kommen die Angaben der ersten Person, danach die der zweiten.",
    pairSecondNote: "Jetzt die Angaben der zweiten Person.",
    slotWoman: "Frau",
    slotMan: "Mann",
    title: "Titel",
    titles: {
      none: "–",
      dr: "Dr.",
      frau: "Frau",
      herr: "Herr",
      kids: "Kids",
    } satisfies Record<Title, string>,
    firstName: "Vorname",
    lastName: "Nachname",
    birthYear: "Geburtsjahr",
    club: "Verein",
    optional: "optional",
    required: "Bitte ausfüllen.",
    birthYearInvalid: "Bitte das Geburtsjahr mit 4 Ziffern eingeben, z. B. 1985.",
    birthYearTooEarly: "Ein Geburtsjahr vor 1800 ist nicht möglich. Bitte prüfen.",
    birthYearFuture: "Dieses Jahr liegt nach dem Lauf. Bitte prüfen.",
    birthYearCheck: "Bitte prüfen: Das ergibt das Alter {age}.",
    titleCheck: "Bitte prüfen: „{title}“ passt nicht zu diesem Startplatz.",
    mixedTitleCheck: "Bitte prüfen: Ein Mixed-Paar sind eine Frau und ein Mann.",
    kidsButAdult: "Bitte prüfen: „Kids“ ist für Kinder unter 12 Jahren.",
    childWithoutKids: "Bitte prüfen: Für Kinder unter 12 Jahren bitte „Kids“ wählen.",
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
    numberLabel: "Anmeldenummer",
    deskHint: "Zeige diese Nummer am Anmeldetisch. Dort bekommst du deine Startnummer.",
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
    divisionHeading: "Who is running?",
    divisions: {
      women: { name: "Women", detail: "Single" },
      men: { name: "Men", detail: "Single" },
      womens_pair: { name: "Women's pair", detail: "2 women" },
      mens_pair: { name: "Men's pair", detail: "2 men" },
      mixed_pair: { name: "Mixed pair", detail: "Woman + man" },
    },
    durationHeading: "How long?",
    durations: {
      "60": { name: "60 minutes", short: "60 min", detail: "1 hour" },
      "30": { name: "30 minutes", short: "30 min", detail: "½ hour" },
    },
    detailsHeadingSingle: "Your details",
    pairFirst: "First person",
    pairSecond: "Second person",
    pairFirstNote: "You're running as a pair. Enter the first person here; the second person comes next.",
    pairSecondNote: "Now the second person's details.",
    slotWoman: "Woman",
    slotMan: "Man",
    title: "Title",
    titles: {
      none: "–",
      dr: "Dr.",
      frau: "Ms",
      herr: "Mr",
      kids: "Kids",
    },
    firstName: "First name",
    lastName: "Last name",
    birthYear: "Year of birth",
    club: "Club",
    optional: "optional",
    required: "Please fill this in.",
    birthYearInvalid: "Please enter the year of birth with 4 digits, e.g. 1985.",
    birthYearTooEarly: "A year of birth before 1800 isn't possible. Please check.",
    birthYearFuture: "That year is after the race. Please check.",
    birthYearCheck: "Please check: that means an age of {age}.",
    titleCheck: "Please check: “{title}” doesn't match this slot.",
    mixedTitleCheck: "Please check: a mixed pair is one woman and one man.",
    kidsButAdult: "Please check: “Kids” is for children under 12.",
    childWithoutKids: "Please check: for children under 12, please choose “Kids”.",
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
    numberLabel: "Registration number",
    deskHint: "Show this number at the race desk to get your bib.",
    another: "Register someone else",
  },
};

const dictionaries: Record<Lang, Strings> = { de, en };

export function strings(lang: Lang): Strings {
  return dictionaries[lang];
}
