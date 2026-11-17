// The Admin's edit form for one Registration: its Registration number and every
// other field, checked by the same rules as the public submit
// (src/registration/registration-input.ts). A single stays a single and a Pair a Pair.

import type { Context } from "hono";
import { DURATIONS, GENDERS, TITLES } from "../domain/categories";
import { NUMBER_RANGES, numberInRange, seriesOf } from "../domain/numbers";
import { birthYearError, MAX_TEXT_LENGTH } from "../domain/participant-checks";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import type { Race } from "../races/races";
import { validateRegistrationEdit, type RegistrationContent, type RegistrationIssue } from "../registration/registration-input";
import type { StoredRegistration } from "../registration/registrations";
import { AdminPage, SERIES_NAMES } from "./admin-page";
import { editPath, participantNames, racePath } from "./registrations-page";

const t = strings("de").flow;

/** For any choice left open (Duration, Gender, Title). */
const PLEASE_CHOOSE = "Bitte wählen.";

const PARTICIPANT_FIELDS = ["gender", "title", "firstName", "lastName", "birthYear", "club"] as const;
type ParticipantField = (typeof PARTICIPANT_FIELDS)[number];
type ParticipantValues = Record<ParticipantField, string>;

/** The form as text, exactly as shown or posted: one Participant, or two for a Pair. */
export type EditValues = { number: string; duration: string; participants: ParticipantValues[] };

/** German messages by form field name ("number", "duration", "p1.lastName", …). */
type EditErrors = Record<string, string>;

const emptyParticipant = (): ParticipantValues => ({ gender: "", title: "none", firstName: "", lastName: "", birthYear: "", club: "" });

export function storedValues(registration: StoredRegistration): EditValues {
  const participants = registration.participants.map(
    (p): ParticipantValues => ({
      gender: p.gender,
      title: p.title,
      firstName: p.firstName,
      lastName: p.lastName,
      birthYear: String(p.birthYear),
      club: p.club ?? "",
    }),
  );
  return { number: String(registration.number), duration: String(registration.duration), participants };
}

export function postedValues(form: Record<string, unknown>): EditValues {
  const text = (name: string) => (typeof form[name] === "string" ? (form[name] as string) : "");
  const participant = (n: number): ParticipantValues =>
    Object.fromEntries(PARTICIPANT_FIELDS.map((field) => [field, text(`p${n}.${field}`)])) as ParticipantValues;
  // Participant 2 only when the post has any field of it.
  const pair = Object.keys(form).some((name) => name.startsWith("p2."));
  return { number: text("number"), duration: text("duration"), participants: pair ? [participant(1), participant(2)] : [participant(1)] };
}

export type CheckedEdit = { ok: true; number: number; content: RegistrationContent } | { ok: false; errors: EditErrors };

/**
 * Checks the posted form for the Registration by the submit's rules, and that
 * its new number lies in the Registration's range. On success, the number and
 * content to store; otherwise a German message per field. Whether another
 * Registration has the number is for storing to find out.
 */
export function checkEdit(values: EditValues, registration: StoredRegistration, year: number): CheckedEdit {
  const series = seriesOf(registration.participants);
  if (seriesOf(values.participants) !== series) {
    return { ok: false, errors: { form: "Aus Einzeln wird kein Paar und umgekehrt. Dafür bitte die Anmeldung löschen und neu anmelden." } };
  }
  const body = {
    duration: /^\d+$/.test(values.duration) ? Number(values.duration) : values.duration,
    // As in the public flow: a four-digit year (spaces around don't matter) is a number, anything else a format error.
    participants: values.participants.map((p) => ({ ...p, birthYear: /^[1-9]\d{3}$/.test(p.birthYear.trim()) ? Number(p.birthYear.trim()) : p.birthYear })),
  };
  const result = validateRegistrationEdit(body, year);
  const errors: EditErrors = {};
  const number = numberInRange(values.number, series);
  if (number === null) {
    const { from, to } = NUMBER_RANGES[series];
    errors.number = `${SERIES_NAMES[series]} haben Startnummern von ${from} bis ${to}.`;
  }
  if (!result.ok) {
    for (const issue of result.issues) Object.assign(errors, germanError(issue, values, year));
    if (Object.keys(errors).length === 0) errors.form = "Bitte die Angaben prüfen.";
  }
  if (result.ok && number !== null && Object.keys(errors).length === 0) return { ok: true, number, content: result.content };
  return { ok: false, errors };
}

/** The message on the number field when storing found another Registration on it (null: gone again meanwhile). */
export function numberTakenError(number: number, other: StoredRegistration | null): EditErrors {
  return { number: `Startnummer ${number} ist schon an ${other ? participantNames(other) : "eine andere Anmeldung"} vergeben.` };
}

/** The message on the number field when storing found the number Reserved. */
export const numberReservedError = (number: number): EditErrors => ({
  number: `Startnummer ${number} ist gesperrt. Zum Vergeben bitte erst in den Einstellungen entsperren.`,
});

/** The German message for one validation issue, keyed by the form field it belongs to. */
function germanError(issue: RegistrationIssue, values: EditValues, year: number): EditErrors {
  if (issue.path === "duration") return { duration: PLEASE_CHOOSE };
  const match = issue.path.match(/^participants\.(\d)\.(\w+)$/);
  if (!match) return {};
  const index = Number(match[1]);
  const field = match[2] as ParticipantField;
  const value = values.participants[index]![field];
  const name = `p${index + 1}.${field}`;
  switch (field) {
    case "gender":
    case "title":
      return { [name]: PLEASE_CHOOSE };
    case "firstName":
    case "lastName":
      return { [name]: value.trim() === "" ? t.required : `Höchstens ${MAX_TEXT_LENGTH} Zeichen.` };
    case "club":
      return { [name]: `Höchstens ${MAX_TEXT_LENGTH} Zeichen.` };
    case "birthYear": {
      const problem = birthYearError(value.trim(), year) ?? "format";
      const messages = { format: t.birthYearInvalid, "too-early": t.birthYearTooEarly, future: t.birthYearFuture };
      return { [name]: messages[problem] };
    }
  }
}

function Choice(props: { name: string; value: string; checked: boolean; label: string }) {
  return (
    <label class="pill">
      <input type="radio" name={props.name} value={props.value} checked={props.checked} />
      <span>{props.label}</span>
    </label>
  );
}

function FieldError(props: { errors: EditErrors; name: string }) {
  const message = props.errors[props.name];
  return message ? <p class="error">{message}</p> : null;
}

/** A text field; with `digits` (a year, a Registration number), a short numeric one of at most that many digits. */
function TextField(props: { name: string; label: string; value: string; errors: EditErrors; digits?: number }) {
  const id = props.name.replace(".", "-");
  return (
    <div class="field">
      <label class="label" for={id}>{props.label}</label>
      <input
        type="text"
        id={id}
        name={props.name}
        value={props.value}
        class={props.digits ? "year" : undefined}
        inputmode={props.digits ? "numeric" : undefined}
        maxlength={props.digits ?? MAX_TEXT_LENGTH}
        autocomplete="off"
        aria-invalid={props.errors[props.name] ? "true" : undefined}
      />
      <FieldError errors={props.errors} name={props.name} />
    </div>
  );
}

function ParticipantFieldset(props: { n: number; pair: boolean; participant: ParticipantValues; errors: EditErrors }) {
  const { n, participant, errors } = props;
  const name = (field: ParticipantField) => `p${n}.${field}`;
  return (
    <fieldset class="card edit-participant">
      <legend>{props.pair ? (n === 1 ? t.pairFirst : t.pairSecond) : "Person"}</legend>
      <div class="field">
        <span class="label">{t.gender}</span>
        <div class="pills">
          {GENDERS.map((g) => <Choice name={name("gender")} value={g} checked={participant.gender === g} label={t.genders[g]} />)}
        </div>
        <FieldError errors={errors} name={name("gender")} />
      </div>
      <div class="field">
        <span class="label">{t.title}</span>
        <div class="pills">
          {TITLES.map((title) => <Choice name={name("title")} value={title} checked={participant.title === title} label={t.titles[title]} />)}
        </div>
        <FieldError errors={errors} name={name("title")} />
      </div>
      <TextField name={name("firstName")} label={t.firstName} value={participant.firstName} errors={errors} />
      <TextField name={name("lastName")} label={t.lastName} value={participant.lastName} errors={errors} />
      <TextField name={name("birthYear")} label={t.birthYear} value={participant.birthYear} errors={errors} digits={4} />
      <TextField name={name("club")} label={`${t.club} (${t.optional})`} value={participant.club} errors={errors} />
    </fieldset>
  );
}

/** „Anmeldung 12 bearbeiten“: the edit page's title, and links to it. */
export const editHeading = (number: number) => `Anmeldung ${number} bearbeiten`;

/**
 * The edit form for a Registration, filled with `values`; with errors,
 * answered as 400. It shows the Registration's own Participants, one for a
 * single and two for a Pair, whatever was posted.
 */
export function editRegistrationPage(c: Context<AppEnv>, race: Race, registration: StoredRegistration, values: EditValues, errors: EditErrors = {}) {
  const invalid = Object.keys(errors).length > 0;
  const pair = seriesOf(registration.participants) === "pair";
  return c.html(
    <AdminPage url={c.req.url} title={editHeading(registration.number)} admin={c.get("adminEmail")}>
      <p><a href={racePath(race)}>← {race.name}</a></p>
      <h1>{editHeading(registration.number)}</h1>
      {invalid && <p class="alert" role="alert">{errors.form ?? "Bitte die markierten Angaben prüfen."}</p>}
      <form method="post" action={editPath(race, registration)} novalidate>
        {/* Which Registration this form is for, should another one get its number before saving. */}
        <input type="hidden" name="registration" value={String(registration.id)} />
        <div class="card">
          <TextField name="number" label="Startnummer" value={values.number} errors={errors} digits={4} />
          <div class="field">
            <span class="label">Lauf</span>
            <div class="pills">
              {DURATIONS.map((d) => <Choice name="duration" value={String(d)} checked={values.duration === String(d)} label={t.durations[d].name} />)}
            </div>
            <FieldError errors={errors} name="duration" />
          </div>
        </div>
        {registration.participants.map((_, index) => (
          <ParticipantFieldset n={index + 1} pair={pair} participant={values.participants[index] ?? emptyParticipant()} errors={errors} />
        ))}
        <button type="submit" class="btn">Speichern</button>
      </form>
      <p class="cancel"><a href={racePath(race)}>Abbrechen</a></p>
    </AdminPage>,
    invalid ? 400 : 200,
  );
}
