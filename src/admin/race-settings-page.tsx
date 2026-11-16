// The Race settings page, and the Race form's fields (name, date, First numbers)
// it shares with "Neuer Lauf" on the admin start page.

import type { Context } from "hono";
import { FIRST_NUMBER_FIELDS, NUMBER_RANGES, type FirstNumberField } from "../domain/numbers";
import type { AppEnv } from "../language";
import { MAX_RACE_NAME_LENGTH, type RaceFormValues, type RaceInputErrors } from "../races/race-input";
import type { Race } from "../races/races";
import { AdminPage } from "./admin-page";
import { racePath, settingsPath } from "./registrations-page";

function FirstNumberInput(props: { name: FirstNumberField; label: string; values: RaceFormValues; errors: RaceInputErrors }) {
  const { from, to } = NUMBER_RANGES[FIRST_NUMBER_FIELDS[props.name]];
  const error = props.errors[props.name];
  return (
    <div class="field">
      <label class="label" for={`race-${props.name}`}>{props.label}</label>
      <input
        type="text"
        id={`race-${props.name}`}
        name={props.name}
        value={props.values[props.name]}
        class="year"
        inputmode="numeric"
        maxlength={String(to).length}
        autocomplete="off"
        aria-invalid={error ? "true" : undefined}
      />
      <p class="muted form-note">{`${from}–${to}`}</p>
      {error && <p class="error">{error}</p>}
    </div>
  );
}

export function RaceFields(props: { values: RaceFormValues; errors: RaceInputErrors }) {
  const { values, errors } = props;
  return (
    <>
      <div class="field">
        <label class="label" for="race-name">Name</label>
        <input type="text" id="race-name" name="name" value={values.name} maxlength={MAX_RACE_NAME_LENGTH} placeholder="Stundenlauf 09.12.2026" aria-invalid={errors.name ? "true" : undefined} />
        {errors.name && <p class="error">{errors.name}</p>}
      </div>
      <div class="field">
        <label class="label" for="race-date">Datum</label>
        <input type="date" id="race-date" name="date" value={values.date} aria-invalid={errors.date ? "true" : undefined} />
        {errors.date && <p class="error">{errors.date}</p>}
      </div>
      <FirstNumberInput name="firstSingleNumber" label="Erste Startnummer Einzeln" values={values} errors={errors} />
      <FirstNumberInput name="firstPairNumber" label="Erste Startnummer Paare" values={values} errors={errors} />
    </>
  );
}

/** The Race settings page, filled with `values`; with errors, answered as 400. */
export function raceSettingsPage(c: Context<AppEnv>, race: Race, values: RaceFormValues, errors: RaceInputErrors = {}) {
  const invalid = Object.keys(errors).length > 0;
  return c.html(
    <AdminPage url={c.req.url} title={`${race.name}: Einstellungen`} admin={c.get("adminEmail")}>
      <p><a href={racePath(race)}>← {race.name}</a></p>
      <h1>Einstellungen</h1>
      {invalid && <p class="alert" role="alert">Bitte die markierten Angaben prüfen.</p>}
      <form method="post" action={settingsPath(race)} class="card" novalidate>
        <RaceFields values={values} errors={errors} />
        <p class="muted form-note">
          Neue Startnummern zählen ab der ersten Startnummer weiter, aber nie unter eine schon vergebene zurück.
        </p>
        <button type="submit" class="btn">Speichern</button>
      </form>
      <p class="cancel"><a href={racePath(race)}>Abbrechen</a></p>
    </AdminPage>,
    invalid ? 400 : 200,
  );
}
