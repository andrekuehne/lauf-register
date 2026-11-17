// The Race settings page, and the Race form's fields (name, date, First numbers)
// it shares with "Neuer Lauf" on the admin start page. Below the form, the
// Race's Reserved numbers, added and removed right away (not with „Speichern“).

import type { Context } from "hono";
import { raw } from "hono/html";
import { FIRST_NUMBER_FIELDS, NUMBER_RANGES, type FirstNumberField } from "../domain/numbers";
import { formatRange, reservedRanges } from "../domain/reserved-numbers";
import { ICONS } from "../ui/icon-svgs";
import type { AppEnv } from "../language";
import { MAX_RACE_NAME_LENGTH, type RaceFormValues, type RaceInputErrors } from "../races/race-input";
import type { Race } from "../races/races";
import type { StoredRegistration } from "../registration/registrations";
import type { Move } from "../registration/reserved-numbers";
import { AdminPage } from "./admin-page";
import { participantNames, racePath, settingsPath } from "./registrations-page";

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

/** What the Reserved numbers section shows besides the Race's Reserved numbers. */
export type ReservedSectionState = {
  /** The Race's Reserved numbers. */
  numbers: number[];
  /** What the Admin typed, when it is shown again. */
  typed?: string;
  error?: string;
  /** Registrations on numbers of `typed`: the Admin confirms before they get new numbers. */
  toConfirm?: StoredRegistration[];
  /** The new numbers of Registrations that were on numbers just reserved. */
  moves?: Move[];
};

/** „Startnummer 23 ist an Erika Muster vergeben. Sie bekommt eine neue Startnummer.“ */
function takenLine(registration: StoredRegistration): string {
  const { participants } = registration;
  const gets = participants.length === 2 ? "Sie bekommen" : participants[0]!.gender === "F" ? "Sie bekommt" : "Er bekommt";
  return `Startnummer ${registration.number} ist an ${participantNames(registration)} vergeben. ${gets} eine neue Startnummer.`;
}

/** „23 → 57 (Erika Muster)“ */
const moveLine = (move: Move) => `${move.registration.number} → ${move.to} (${participantNames(move.registration)})`;

/** The taken numbers the Admin confirms, as the confirmation form sends them back. */
export const confirmedNumbers = (taken: StoredRegistration[]) => taken.map((r) => r.number).join(",");

export const reservedPath = (race: Race) => `${racePath(race)}/reserved`;
/** The settings page opened at the Reserved numbers section (the page is long on a phone). */
export const reservedSectionPath = (race: Race) => `${settingsPath(race)}#reserved`;
const removeReservedPath = (race: Race) => `${reservedPath(race)}/remove`;

/** „Gesperrte Startnummern“: the Race's Reserved numbers as ranges, each with a remove button, and the input to reserve more. */
function ReservedSection(props: { race: Race; state: ReservedSectionState }) {
  const { race, state } = props;
  const ranges = reservedRanges(state.numbers);
  return (
    <section class="card" id="reserved">
      <h2>Gesperrte Startnummern</h2>
      <p class="muted form-note">Werden bei neuen Anmeldungen übersprungen, z. B. wenn eine Startnummer verloren gegangen ist.</p>
      {state.moves && state.moves.length > 0 && (
        <div class="notice" role="status">
          <p><b>Neue Startnummern, bitte am Anmeldetisch neu ausgeben:</b></p>
          <ul class="moves">
            {state.moves.map((move) => <li>{moveLine(move)}</li>)}
          </ul>
        </div>
      )}
      {state.toConfirm && (
        <div class="alert reserve-confirm" role="alert">
          {state.toConfirm.map((registration) => <p>{takenLine(registration)}</p>)}
          <form method="post" action={`${reservedPath(race)}#reserved`}>
            <input type="hidden" name="numbers" value={state.typed ?? ""} />
            <input type="hidden" name="confirmed" value={confirmedNumbers(state.toConfirm)} />
            <button type="submit" class="btn">Sperren und neue Startnummer vergeben</button>
          </form>
          <p class="cancel"><a href={reservedSectionPath(race)}>Abbrechen</a></p>
        </div>
      )}
      {ranges.length === 0 ? (
        <p class="muted reserved-none">Keine gesperrten Startnummern.</p>
      ) : (
        <ul class="reserved-list">
          {ranges.map((range) => (
            <li>
              <span class="reserved-range">{formatRange(range)}</span>
              <form method="post" action={removeReservedPath(race)}>
                <input type="hidden" name="from" value={String(range.from)} />
                <input type="hidden" name="to" value={String(range.to)} />
                <button type="submit" class="icon-btn" aria-label={`${formatRange(range)} entsperren`}>
                  {raw(ICONS.trash)}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {/* The answer opens at this section (the page is long on a phone). */}
      <form method="post" action={`${reservedPath(race)}#reserved`} class="reserved-add" novalidate>
        <label class="label" for="reserve-numbers">Startnummer oder Bereich sperren</label>
        <div class="reserved-input">
          <input
            type="text"
            id="reserve-numbers"
            name="numbers"
            value={state.typed ?? ""}
            placeholder="z. B. 13 oder 900-950"
            autocomplete="off"
            aria-invalid={state.error ? "true" : undefined}
          />
          <button type="submit" class="btn add-btn" aria-label="Sperren">+</button>
        </div>
        {state.error && <p class="error">{state.error}</p>}
      </form>
    </section>
  );
}

/**
 * The Race settings page, filled with `values`, and its Reserved numbers
 * section; with errors in either, answered as 400.
 */
export function raceSettingsPage(
  c: Context<AppEnv>,
  race: Race,
  values: RaceFormValues,
  errors: RaceInputErrors,
  reserved: ReservedSectionState,
) {
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
      <ReservedSection race={race} state={reserved} />
    </AdminPage>,
    invalid || reserved.error ? 400 : 200,
  );
}
