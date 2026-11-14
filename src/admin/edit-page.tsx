// The Admin's edit form for one Registration: every field, single or pair,
// checked by the same rules as the public submit (src/registration/registration-input.ts).

import type { Context } from "hono";
import { DURATIONS, GENDERS, isSingleOrPair, SINGLE_OR_PAIR, TITLES } from "../domain/categories";
import { birthYearError, MAX_TEXT_LENGTH } from "../domain/participant-checks";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import type { Race } from "../races/races";
import { validateRegistrationEdit, type RegistrationContent, type RegistrationIssue } from "../registration/registration-input";
import type { StoredRegistration } from "../registration/registrations";
import { AdminPage } from "./admin-page";
import { editPath, racePath } from "./registrations-page";

const t = strings("de").flow;

/** For any choice left open (Duration, single or pair, Gender, Title). */
const PLEASE_CHOOSE = "Bitte wählen.";

const PARTICIPANT_FIELDS = ["gender", "title", "firstName", "lastName", "birthYear", "club"] as const;
type ParticipantField = (typeof PARTICIPANT_FIELDS)[number];
type ParticipantValues = Record<ParticipantField, string>;

/** The form as text, exactly as shown or posted: Participant 2 is always there, used only for a Pair. */
export type EditValues = { duration: string; singleOrPair: string; participants: [ParticipantValues, ParticipantValues] };

/** German messages by form field name ("duration", "singleOrPair", "p1.lastName", …). */
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
  return {
    duration: String(registration.duration),
    singleOrPair: participants.length === 2 ? "pair" : "single",
    participants: [participants[0] ?? emptyParticipant(), participants[1] ?? emptyParticipant()],
  };
}

export function postedValues(form: Record<string, unknown>): EditValues {
  const text = (name: string) => (typeof form[name] === "string" ? (form[name] as string) : "");
  const participant = (n: number): ParticipantValues =>
    Object.fromEntries(PARTICIPANT_FIELDS.map((field) => [field, text(`p${n}.${field}`)])) as ParticipantValues;
  return { duration: text("duration"), singleOrPair: text("singleOrPair"), participants: [participant(1), participant(2)] };
}

/**
 * Checks the posted form by the submit's rules. On success, the content to
 * store; otherwise a German message per field.
 */
export function checkEdit(values: EditValues, year: number): { ok: true; content: RegistrationContent } | { ok: false; errors: EditErrors } {
  const participants = values.singleOrPair === "pair" ? values.participants : [values.participants[0]];
  const body = {
    duration: /^\d+$/.test(values.duration) ? Number(values.duration) : values.duration,
    // As in the public flow: a four-digit year (spaces around don't matter) is a number, anything else a format error.
    participants: participants.map((p) => ({ ...p, birthYear: /^[1-9]\d{3}$/.test(p.birthYear.trim()) ? Number(p.birthYear.trim()) : p.birthYear })),
  };
  const result = validateRegistrationEdit(body, year);
  const errors: EditErrors = {};
  if (!isSingleOrPair(values.singleOrPair)) errors.singleOrPair = PLEASE_CHOOSE;
  if (!result.ok) {
    for (const issue of result.issues) Object.assign(errors, germanError(issue, values, year));
    if (Object.keys(errors).length === 0) errors.form = "Bitte die Angaben prüfen.";
  }
  if (result.ok && Object.keys(errors).length === 0) return { ok: true, content: result.content };
  return { ok: false, errors };
}

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

function TextField(props: { name: string; label: string; value: string; errors: EditErrors; year?: boolean }) {
  const id = props.name.replace(".", "-");
  return (
    <div class="field">
      <label class="label" for={id}>{props.label}</label>
      <input
        type="text"
        id={id}
        name={props.name}
        value={props.value}
        class={props.year ? "year" : undefined}
        inputmode={props.year ? "numeric" : undefined}
        maxlength={props.year ? 4 : MAX_TEXT_LENGTH}
        autocomplete="off"
        aria-invalid={props.errors[props.name] ? "true" : undefined}
      />
      <FieldError errors={props.errors} name={props.name} />
    </div>
  );
}

function ParticipantFieldset(props: { n: number; participant: ParticipantValues; errors: EditErrors }) {
  const { n, participant, errors } = props;
  const name = (field: ParticipantField) => `p${n}.${field}`;
  return (
    <fieldset class="card edit-participant">
      <legend>{n === 1 ? t.pairFirst : `${t.pairSecond} (nur bei „Zu zweit“)`}</legend>
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
      <TextField name={name("birthYear")} label={t.birthYear} value={participant.birthYear} errors={errors} year />
      <TextField name={name("club")} label={`${t.club} (${t.optional})`} value={participant.club} errors={errors} />
    </fieldset>
  );
}

/** The edit form for a Registration, filled with `values`; with errors, answered as 400. */
export function editRegistrationPage(c: Context<AppEnv>, race: Race, registration: StoredRegistration, values: EditValues, errors: EditErrors = {}) {
  const invalid = Object.keys(errors).length > 0;
  return c.html(
    <AdminPage url={c.req.url} title={`Anmeldung ${registration.number} bearbeiten`} admin={c.get("adminEmail")}>
      <p><a href={racePath(race)}>← {race.name}</a></p>
      <h1>Anmeldung {registration.number} bearbeiten</h1>
      <p class="muted">Die Startnummer bleibt gleich, auch wenn aus Einzeln ein Paar wird oder umgekehrt.</p>
      {invalid && <p class="alert" role="alert">{errors.form ?? "Bitte die markierten Angaben prüfen."}</p>}
      <form method="post" action={editPath(race, registration)} novalidate>
        <div class="card">
          <div class="field">
            <span class="label">Lauf</span>
            <div class="pills">
              {DURATIONS.map((d) => <Choice name="duration" value={String(d)} checked={values.duration === String(d)} label={t.durations[d].name} />)}
            </div>
            <FieldError errors={errors} name="duration" />
          </div>
          <div class="field">
            <span class="label">Einzeln oder zu zweit</span>
            <div class="pills">
              {SINGLE_OR_PAIR.map((choice) => (
                <Choice name="singleOrPair" value={choice} checked={values.singleOrPair === choice} label={t.singleOrPair[choice].name} />
              ))}
            </div>
            <FieldError errors={errors} name="singleOrPair" />
          </div>
        </div>
        <ParticipantFieldset n={1} participant={values.participants[0]} errors={errors} />
        <ParticipantFieldset n={2} participant={values.participants[1]} errors={errors} />
        <button type="submit" class="btn">Speichern</button>
      </form>
      <p class="cancel"><a href={racePath(race)}>Abbrechen</a></p>
    </AdminPage>,
    invalid ? 400 : 200,
  );
}
