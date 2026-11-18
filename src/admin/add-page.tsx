// The Anmeldetisch's form for adding a Registration: an Admin registers someone
// who hasn't registered on their phone, with Registration open or closed. Every
// field on one page, as in the edit form (edit-page.tsx), checked by the same
// rules as a phone Registration; the number comes from the series' count, as
// for a phone Registration. After saving, the number to hand out.

import type { Context } from "hono";
import { isSingleOrPair, SINGLE_OR_PAIR, type SingleOrPair } from "../domain/categories";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import type { Race } from "../races/races";
import type { SubmitAnswer } from "../registration/flow-config";
import { isAttemptId, newAttemptId, type RegistrationInput } from "../registration/registration-input";
import { AdminPage, SERIES_NAMES } from "./admin-page";
import {
  checkContent,
  DurationField,
  emptyParticipant,
  FieldError,
  PLEASE_CHOOSE,
  ParticipantFieldset,
  postedParticipant,
  postedText,
  type EditErrors,
  type ParticipantValues,
} from "./edit-page";
import { addPath, BackTo, CancelTo, CategoryLabel, deskPath, fullName, nextNumbersSectionPath } from "./registrations-page";

const t = strings("de").flow;

/**
 * The form as text, exactly as shown or posted: whether it is a single or a
 * Pair ("" until chosen), and both Participants' fields (the second counts for
 * a Pair only). The attempt ID makes saving it twice store one Registration.
 */
export type AddValues = { attemptId: string; kind: string; duration: string; participants: [ParticipantValues, ParticipantValues] };

/** An empty form, with an attempt ID of its own. */
export const newAddValues = (): AddValues => ({ attemptId: newAttemptId(), kind: "", duration: "", participants: [emptyParticipant(), emptyParticipant()] });

/** The add form as posted. */
export function postedAddValues(form: Record<string, unknown>): AddValues {
  return {
    attemptId: postedText(form, "attempt"),
    kind: postedText(form, "kind"),
    duration: postedText(form, "duration"),
    participants: [postedParticipant(form, 1), postedParticipant(form, 2)],
  };
}

/** The Registration to store, by the phone Registration's rules; or a German message per field. */
export function checkAdd(values: AddValues, year: number): { ok: true; input: RegistrationInput } | { ok: false; errors: EditErrors } {
  const participants = values.kind === "pair" ? values.participants : [values.participants[0]];
  const content = checkContent({ duration: values.duration, participants }, year);
  const errors: EditErrors = content.ok ? {} : content.errors;
  if (!isSingleOrPair(values.kind)) errors.kind = PLEASE_CHOOSE;
  // Only a form not opened from this page has none.
  if (!isAttemptId(values.attemptId)) errors.form = "Bitte das Formular neu öffnen und noch einmal ausfüllen.";
  if (!content.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { attemptId: values.attemptId, ...content.content } };
}

/** The radio buttons for single or Pair, ahead of everything they show or hide (see the styles' `.kind-choice`). */
const CHOICE_ID: Record<SingleOrPair, string> = { single: "kind-single", pair: "kind-pair" };

/**
 * The add form, filled with `values`. With errors, answered as 400; with
 * `full`, the series that had no number left, as 409 with the way to set its
 * Next number. Participant 2 shows only once „Zu zweit“ is chosen, by the
 * styles alone, so the form works without JavaScript.
 */
export function addRegistrationPage(c: Context<AppEnv>, race: Race, values: AddValues, errors: EditErrors = {}, full?: SingleOrPair) {
  const invalid = Object.keys(errors).length > 0;
  return c.html(
    <AdminPage url={c.req.url} title="Anmeldung hinzufügen" admin={c.get("adminEmail")}>
      <BackTo race={race} page="desk" />
      <h1>Anmeldung hinzufügen</h1>
      {invalid && <p class="alert" role="alert">{errors.form ?? "Bitte die markierten Angaben prüfen."}</p>}
      {full && (
        <p class="alert" role="alert">
          {`${SERIES_NAMES[full]}: keine Startnummer mehr frei. Nichts gespeichert. `}
          <a href={nextNumbersSectionPath(race)}>Nächste Startnummer setzen</a>
        </p>
      )}
      <form method="post" action={addPath(race)} novalidate>
        <input type="hidden" name="attempt" value={values.attemptId} />
        {SINGLE_OR_PAIR.map((kind) => (
          <input type="radio" name="kind" value={kind} id={CHOICE_ID[kind]} class="kind-choice" checked={values.kind === kind} />
        ))}
        <div class="card">
          <div class="field">
            <span class="label">Einzeln oder zu zweit</span>
            <div class="pills">
              {SINGLE_OR_PAIR.map((kind) => (
                <label class="pill" for={CHOICE_ID[kind]}>
                  <span>{t.singleOrPair[kind].name}</span>
                </label>
              ))}
            </div>
            <FieldError errors={errors} name="kind" />
          </div>
          <DurationField value={values.duration} errors={errors} />
        </div>
        <ParticipantFieldset
          n={1}
          pair={false}
          participant={values.participants[0]}
          errors={errors}
          legend={
            <>
              <span class="if-single">Person</span>
              <span class="if-pair">{t.pairFirst}</span>
            </>
          }
        />
        <ParticipantFieldset n={2} pair participant={values.participants[1]} errors={errors} class="if-pair" />
        <button type="submit" class="btn">Speichern</button>
      </form>
      <CancelTo race={race} page="desk" />
    </AdminPage>,
    full ? 409 : invalid ? 400 : 200,
  );
}

/**
 * After saving: the number to hand out, big, with the names and the Category;
 * then back to the Anmeldetisch or on to the next. When the form was saved
 * before with other details, it says nothing of them was stored.
 */
export function addedPage(c: Context<AppEnv>, race: Race, answer: SubmitAnswer) {
  const names = answer.participants.map(fullName).join(" und ");
  return c.html(
    <AdminPage url={c.req.url} title={`Startnummer ${answer.number} ausgeben`} admin={c.get("adminEmail")}>
      <BackTo race={race} page="desk" />
      {answer.differs && (
        <p class="alert" role="alert">
          Diese Anmeldung war schon gespeichert. Die geänderten Angaben wurden nicht übernommen: bitte am Anmeldetisch über „Bearbeiten“ korrigieren.
        </p>
      )}
      <div class={`card added div-${answer.division}`}>
        <h1>
          Startnummer <b class="added-number">{answer.number}</b> ausgeben
        </h1>
        <p class="added-names">{names}</p>
        <CategoryLabel division={answer.division} duration={answer.duration} />
      </div>
      <a href={deskPath(race)} class="btn">Zurück zum Anmeldetisch</a>
      <a href={addPath(race)} class="btn btn-secondary">Weitere Anmeldung</a>
    </AdminPage>,
  );
}
