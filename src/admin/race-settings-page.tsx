// The Race settings page, and the Race form's fields (name, date, First numbers)
// it shares with "Neuer Lauf" on the admin start page. Below the form, the
// Race's Next numbers and its Reserved numbers, each changed right away (not
// with „Speichern“).

import type { Context } from "hono";
import { raw } from "hono/html";
import { SINGLE_OR_PAIR, type SingleOrPair } from "../domain/categories";
import { FIRST_NUMBER_FIELDS, NUMBER_RANGES, type FirstNumberField } from "../domain/numbers";
import { formatRange, reservedRanges } from "../domain/reserved-numbers";
import { ICONS } from "../ui/icon-svgs";
import type { AppEnv } from "../language";
import { NEXT_NUMBER_FIELDS, type PerSeries } from "../races/next-number-input";
import { MAX_RACE_NAME_LENGTH, type RaceFormValues, type RaceInputErrors } from "../races/race-input";
import { firstNumberOf, type Race } from "../races/races";
import type { NextNumbers } from "../registration/next-numbers";
import type { StoredRegistration } from "../registration/registrations";
import type { Move } from "../registration/reserved-numbers";
import { AdminPage, SERIES_NAMES } from "./admin-page";
import { nextNumbersSectionPath, participantNames, racePath, settingsPath } from "./registrations-page";

/** A Registration number field of a series: the number, the numbers allowed below it (with `note` before them), and any error. */
function NumberField(props: { id: string; name: string; label: string; value: string; from: number; series: SingleOrPair; note?: string; error?: string }) {
  const { to } = NUMBER_RANGES[props.series];
  return (
    <div class="field">
      <label class="label" for={props.id}>{props.label}</label>
      <input
        type="text"
        id={props.id}
        name={props.name}
        value={props.value}
        class="year"
        inputmode="numeric"
        maxlength={String(to).length}
        autocomplete="off"
        aria-invalid={props.error ? "true" : undefined}
      />
      <p class="muted form-note">{`${props.note ?? ""}${props.from}–${to}`}</p>
      {props.error && <p class="error">{props.error}</p>}
    </div>
  );
}

function FirstNumberInput(props: { name: FirstNumberField; label: string; values: RaceFormValues; errors: RaceInputErrors }) {
  const series = FIRST_NUMBER_FIELDS[props.name];
  return (
    <NumberField
      id={`race-${props.name}`}
      name={props.name}
      label={props.label}
      value={props.values[props.name]}
      from={NUMBER_RANGES[series].from}
      series={series}
      error={props.errors[props.name]}
    />
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

/** What the „Nächste Startnummern“ section shows. */
export type NextNumbersSectionState = {
  /** Where each series' count continues now. */
  next: NextNumbers;
  /** What the Admin typed, when it is shown again (otherwise the Next numbers). */
  typed?: Record<SingleOrPair, string>;
  /** What the fields showed when the page was opened: a field still showing it leaves its series alone. */
  shown?: Record<SingleOrPair, string>;
  errors?: PerSeries<string>;
  /** Series whose count would go back over free numbers: those numbers, for the Admin to confirm first. */
  toConfirm?: PerSeries<string>;
};

/** Series as the field labels name them, like the First numbers'. */
const SERIES_LABELS: Record<SingleOrPair, string> = { single: "Einzeln", pair: "Paare" };

/** Where the „Nächste Startnummern“ form posts to. */
export const nextNumbersPath = (race: Race) => `${racePath(race)}/next-numbers`;

/** A Next number as its field shows it: empty when the series has none left. */
const asField = (next: number | null) => (next === null ? "" : String(next));

/** „Nächste Startnummern“: where each series' count continues, set right away (not with „Speichern“). */
function NextNumbersSection(props: { race: Race; state: NextNumbersSectionState }) {
  const { race, state } = props;
  const action = `${nextNumbersPath(race)}#next`;
  const typed = (series: SingleOrPair) => state.typed?.[series] ?? asField(state.next[series]);
  const shown = (series: SingleOrPair) => state.shown?.[series] ?? asField(state.next[series]);
  const toConfirm = SINGLE_OR_PAIR.filter((series) => state.toConfirm?.[series] !== undefined);
  return (
    <section class="card" id="next">
      <h2>Nächste Startnummern</h2>
      <p class="muted form-note">
        Hier zählen neue Anmeldungen weiter. Vergebene und gesperrte Startnummern werden übersprungen, ebenso die alten Startnummern
        umnummerierter Anmeldungen („vorher …“).
      </p>
      {toConfirm.length > 0 && (
        <div class="alert next-confirm" role="alert">
          <p><b>Diese Startnummern sind frei und werden wieder vergeben:</b></p>
          <ul class="moves">
            {toConfirm.map((series) => <li>{`${SERIES_NAMES[series]}: ${state.toConfirm?.[series]}`}</li>)}
          </ul>
          <p>Ist eine davon schon ausgegeben, bitte vorher sperren.</p>
          <form method="post" action={action} class="next-confirm-form">
            {SINGLE_OR_PAIR.map((series) => (
              <>
                <input type="hidden" name={NEXT_NUMBER_FIELDS[series].typed} value={typed(series)} />
                <input type="hidden" name={NEXT_NUMBER_FIELDS[series].shown} value={shown(series)} />
                {state.toConfirm?.[series] !== undefined && (
                  <input type="hidden" name={NEXT_NUMBER_FIELDS[series].confirmed} value={state.toConfirm[series]} />
                )}
              </>
            ))}
            <button type="submit" class="btn">Trotzdem übernehmen</button>
          </form>
          <p class="cancel"><a href={nextNumbersSectionPath(race)}>Abbrechen</a></p>
        </div>
      )}
      <form method="post" action={action} class="next-numbers" novalidate>
        {SINGLE_OR_PAIR.map((series) => (
          <>
            <NumberField
              id={`next-${series}`}
              name={NEXT_NUMBER_FIELDS[series].typed}
              label={`Nächste Startnummer ${SERIES_LABELS[series]}`}
              value={typed(series)}
              from={firstNumberOf(race, series)}
              series={series}
              note={state.next[series] === null ? "Keine Startnummer mehr frei. " : undefined}
              error={state.errors?.[series]}
            />
            <input type="hidden" name={NEXT_NUMBER_FIELDS[series].shown} value={shown(series)} />
          </>
        ))}
        <button type="submit" class="btn">Übernehmen</button>
      </form>
    </section>
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

/** The Registrations the Admin confirmed, by id, as the confirmation form sends them back (none: nobody was on the range). */
export const confirmedRegistrations = (posted: unknown): number[] =>
  typeof posted === "string" && /^\d+(,\d+)*$/.test(posted) ? posted.split(",").map(Number) : [];

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
      <p class="muted form-note">Werden nie vergeben, weder automatisch noch von Hand, z. B. wenn eine Startnummer verloren gegangen ist.</p>
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
            <input type="hidden" name="confirmed" value={state.toConfirm.map((registration) => registration.id).join(",")} />
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
 * The Race settings page, filled with `values`, its Next numbers section and
 * its Reserved numbers section; with errors in any, answered as 400.
 */
export function raceSettingsPage(
  c: Context<AppEnv>,
  race: Race,
  values: RaceFormValues,
  errors: RaceInputErrors,
  next: NextNumbersSectionState,
  reserved: ReservedSectionState,
) {
  const invalid = Object.keys(errors).length > 0;
  const nextInvalid = Object.keys(next.errors ?? {}).length > 0;
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
      <NextNumbersSection race={race} state={next} />
      <ReservedSection race={race} state={reserved} />
    </AdminPage>,
    invalid || nextInvalid || reserved.error ? 400 : 200,
  );
}
