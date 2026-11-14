// The authoritative check of a submitted Registration (the browser shows the
// same rules inline, see src/domain/participant-checks.ts).

import { enteredGenders, isDivision, isDuration, isTitle, slotGenders, type Division, type Duration, type Title } from "../domain/categories";
import { birthYearError, MAX_TEXT_LENGTH } from "../domain/participant-checks";

export type ParticipantInput = {
  title: Title;
  firstName: string;
  lastName: string;
  birthYear: number;
  /** null when no club was given. */
  club: string | null;
};

export type RegistrationInput = {
  attemptId: string;
  division: Division;
  duration: Duration;
  /** In slot order: one Participant, or two for a Pair. */
  participants: ParticipantInput[];
};

/** Where in the submitted JSON the problem is (e.g. "participants.1.lastName") and what's wrong. */
export type RegistrationIssue = { path: string; message: string };

export type RegistrationValidation =
  | { ok: true; input: RegistrationInput }
  | { ok: false; issues: RegistrationIssue[] };

/** The browser sends 32 hex characters; anything similar is fine, markup and the like is not. */
const ATTEMPT_ID = /^[A-Za-z0-9_-]{16,64}$/;

const BIRTH_YEAR_MESSAGES = {
  format: "birth year must be a four-digit number",
  "too-early": "birth year is too early",
  future: "birth year is after the Race's year",
} as const;

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

export function validateRegistrationInput(body: unknown, raceYear: number): RegistrationValidation {
  if (!isObject(body)) return { ok: false, issues: [{ path: "", message: "expected a JSON object" }] };
  const issues: RegistrationIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });

  const { attemptId, division, duration, consent, participants } = body;
  if (typeof attemptId !== "string" || !ATTEMPT_ID.test(attemptId)) issue("attemptId", "attempt ID is missing or malformed");
  if (!isDivision(division)) issue("division", "unknown Division");
  if (!isDuration(duration)) issue("duration", "unknown Duration");
  if (consent !== true) issue("consent", "consent must be ticked");

  const checked: ParticipantInput[] = [];
  if (!Array.isArray(participants)) {
    issue("participants", "Participants are missing");
  } else {
    if (isDivision(division) && participants.length !== slotGenders(division).length) {
      issue("participants", `${division} needs ${slotGenders(division).length} Participant(s), got ${participants.length}`);
    }
    participants.forEach((p: unknown, index) => {
      const participant = validateParticipant(p, raceYear, (field, message) =>
        issue(field ? `participants.${index}.${field}` : `participants.${index}`, message),
      );
      if (participant) checked.push(participant);
    });
  }

  if (issues.length > 0) return { ok: false, issues };
  // A Mixed pair may arrive man first; it is stored woman first (slot 1), so
  // gender can always be derived from Division + slot.
  const manFirst = enteredGenders(division as Division, checked.map((p) => p.title))[0] === "M";
  return {
    ok: true,
    input: {
      attemptId: attemptId as string,
      division: division as Division,
      duration: duration as Duration,
      participants: division === "mixed_pair" && manFirst ? [...checked].reverse() : checked,
    },
  };
}

function validateParticipant(
  p: unknown,
  raceYear: number,
  issue: (field: string, message: string) => void,
): ParticipantInput | null {
  if (!isObject(p)) {
    issue("", "expected a Participant object");
    return null;
  }
  let ok = true;
  const fail = (field: string, message: string) => {
    issue(field, message);
    ok = false;
  };

  if (!isTitle(p.title)) fail("title", "unknown Title");
  const firstName = requiredText(p.firstName);
  if (typeof firstName !== "string") fail("firstName", `first name ${firstName.problem}`);
  const lastName = requiredText(p.lastName);
  if (typeof lastName !== "string") fail("lastName", `last name ${lastName.problem}`);
  const yearError =
    typeof p.birthYear === "number" && Number.isInteger(p.birthYear) ? birthYearError(String(p.birthYear), raceYear) : "format";
  if (yearError) fail("birthYear", BIRTH_YEAR_MESSAGES[yearError]);
  const club = optionalText(p.club);
  if (club === undefined) fail("club", `club must be text of at most ${MAX_TEXT_LENGTH} characters`);

  if (!ok) return null;
  return {
    title: p.title as Title,
    firstName: firstName as string,
    lastName: lastName as string,
    birthYear: p.birthYear as number,
    club: club ?? null,
  };
}

/** Trimmed text, or what's wrong with it. */
function requiredText(value: unknown): string | { problem: string } {
  if (typeof value !== "string" || value.trim() === "") return { problem: "is required" };
  if (value.trim().length > MAX_TEXT_LENGTH) return { problem: `is longer than ${MAX_TEXT_LENGTH} characters` };
  return value.trim();
}

/** Trimmed text, null for none or blank, undefined if it can't be accepted. */
function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim().length > MAX_TEXT_LENGTH) return undefined;
  return value.trim() || null;
}
