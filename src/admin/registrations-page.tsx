// The admin page of one Race (its Registrations) and the delete confirmation.

import type { Context } from "hono";
import { raw } from "hono/html";
import { DIVISIONS, GENDER_LETTER, SINGLE_OR_PAIR, type Duration, type SingleOrPair } from "../domain/categories";
import { raceSearchBundle } from "../generated/race-search-bundle";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import { formatRaceDateShort, formatRegistrationTime } from "../races/race-dates";
import type { Race } from "../races/races";
import { duplicatesOf } from "../registration/duplicates";
import { divisionOfRegistration, type ParticipantInput } from "../registration/registration-input";
import type { StoredRegistration } from "../registration/registrations";
import { SEARCH_ATTRIBUTES, SEARCH_FIELD_ID, searchKeys } from "../shared/registration-search";
import { divisionIconSvg } from "../ui/icon-svgs";
import { Icon } from "../ui/icons";
import { QrButton, QrLayers } from "../ui/qr-layer";
import { AdminPage, openedFrom, registrationCount, RegistrationField, SERIES_NAMES, type RacePage } from "./admin-page";
import { RegistrationToggle, type RaceWithToggle } from "./registration-toggle";

const t = strings("de").flow;
const qrStrings = strings("de").qr;

export const racePath = (race: Race) => `/admin/races/${race.token}`;
export const deleteRacePath = (race: Race) => `${racePath(race)}/delete`;
const exportPath = (race: Race) => `${racePath(race)}/export.xlsx`;
export const posterPath = (race: Race) => `${racePath(race)}/poster`;
export const settingsPath = (race: Race) => `${racePath(race)}/settings`;
/** The Anmeldetisch: the Race desk's screen for finding Registrations. */
export const deskPath = (race: Race) => `${racePath(race)}/desk`;
/** Each of the Race's own pages: where it is, and what the way back to it is called. */
const RACE_PAGES: Record<RacePage, { path: (race: Race) => string; name: (race: Race) => string }> = {
  race: { path: racePath, name: (race) => race.name },
  desk: { path: deskPath, name: () => "Anmeldetisch" },
};
/** Where one of the Race's own pages is. */
export const racePagePath = (race: Race, page: RacePage) => RACE_PAGES[page].path(race);
/** The settings page opened at the Next numbers section. */
export const nextNumbersSectionPath = (race: Race) => `${settingsPath(race)}#next`;

/** Below this many numbers left in a series, the Race page and the Anmeldetisch warn: with 1–10 registering at once, a few minutes' notice. */
const FEW_NUMBERS_LEFT = 20;
/**
 * A Registration's edit page or delete confirmation, opened `from` one of the
 * Race's own pages so that it leads back there (to the Race page unless it says otherwise).
 */
const registrationPagePath = (race: Race, registration: StoredRegistration, kind: "edit" | "delete", from: RacePage) =>
  `${racePath(race)}/registrations/${registration.number}/${kind}${from === "race" ? "" : `?from=${from}`}`;
export const editPath = (race: Race, registration: StoredRegistration, from: RacePage = "race") => registrationPagePath(race, registration, "edit", from);
export const deleteRegistrationPath = (race: Race, registration: StoredRegistration, from: RacePage = "race") =>
  registrationPagePath(race, registration, "delete", from);

/** The way back from a page opened from one of the Race's own pages: „← Nikolauslauf“ or „← Anmeldetisch“. */
export const BackTo = (props: { race: Race; page: RacePage }) => (
  <p><a href={racePagePath(props.race, props.page)}>← {RACE_PAGES[props.page].name(props.race)}</a></p>
);

/** „Abbrechen“ on a page opened from one of the Race's own pages: back there. */
export const CancelTo = (props: { race: Race; page: RacePage }) => (
  <p class="cancel"><a href={racePagePath(props.race, props.page)}>Abbrechen</a></p>
);

/** The Race page and the Anmeldetisch list the hour first; Divisions in their usual order (women first, singles before Pairs). */
export const DURATION_ORDER: readonly Duration[] = [60, 30];

/** „Dr. Anna Muster“ */
export function fullName(p: ParticipantInput): string {
  return `${p.title === "none" ? "" : `${t.titles[p.title]} `}${p.firstName} ${p.lastName}`;
}

/** „Erika Muster“, or „Anna Muster und Ben Beispiel“ for a Pair. */
export const participantNames = (registration: StoredRegistration) => registration.participants.map(fullName).join(" und ");

/** The card attributes the search finds a Registration by (on the Race page and the Anmeldetisch). */
export function searchAttributes(registration: StoredRegistration) {
  const keys = searchKeys([registration.number, ...registration.previousNumbers], registration.participants);
  return { [SEARCH_ATTRIBUTES.numbers]: keys.numbers, [SEARCH_ATTRIBUTES.names]: keys.names };
}

/** A Registration's Category in its colour, with the icon of its Division: „Frauen · Stundenlauf“. */
export function CategoryLabel(props: { registration: StoredRegistration }) {
  const division = divisionOfRegistration(props.registration);
  return (
    <span class="reg-cat">
      <Icon svg={divisionIconSvg(division)} />
      <span>{`${t.divisions[division].category} · ${t.durations[props.registration.duration].name}`}</span>
    </span>
  );
}

/** One Registration: number, Category in its colour, time, and each Participant with any duplicate flag. */
function RegistrationCard(props: {
  race: Race;
  registration: StoredRegistration;
  duplicates?: (registration: StoredRegistration, slot: number) => number[];
  deletable?: boolean;
}) {
  const { race, registration } = props;
  const division = divisionOfRegistration(registration);
  return (
    <li class={`card reg div-${division}`} data-registration={registration.number} {...searchAttributes(registration)}>
      <div class="reg-head">
        <b class="reg-no">{registration.number}</b>
        <CategoryLabel registration={registration} />
        <span class="muted reg-time">{formatRegistrationTime(registration.createdAt, race.date)}</span>
      </div>
      {/* The confirmation screen may still show an old number: the desk finds it here. */}
      {registration.previousNumbers.length > 0 && <p class="muted reg-prev">vorher {registration.previousNumbers.join(", ")}</p>}
      {registration.participants.map((p, slot) => {
        const others = props.duplicates?.(registration, slot) ?? [];
        return (
          <div class="reg-person">
            <b>{fullName(p)}</b>{" "}
            <span class="muted">
              · {GENDER_LETTER[p.gender]} · {p.birthYear} · {p.club ?? t.noClub}
            </span>
            {others.length > 0 && <p class="dup">Mögliches Duplikat: {others.map((n) => `Nr. ${n}`).join(", ")}</p>}
          </div>
        );
      })}
      {props.deletable && (
        <p class="reg-actions">
          <a href={editPath(race, registration)}>Bearbeiten</a>
          <a href={deleteRegistrationPath(race, registration)} class="reg-delete">
            Löschen
          </a>
        </p>
      )}
    </li>
  );
}

/** Whether a series with this many numbers left is worth a warning. */
export const fewNumbersLeft = (left: number) => left < FEW_NUMBERS_LEFT;

/** „Einzelne: noch 12 Startnummern frei.“, or that none is left, with the way to set where the series continues. */
export function NumbersLeft(props: { race: Race; series: SingleOrPair; left: number }) {
  const { series, left } = props;
  if (left > 0) return <>{`${SERIES_NAMES[series]}: noch ${left} ${left === 1 ? "Startnummer" : "Startnummern"} frei.`}</>;
  return (
    <>
      {`${SERIES_NAMES[series]}: keine Startnummer mehr frei. Neue Anmeldungen werden abgelehnt. `}
      <a href={nextNumbersSectionPath(props.race)}>Nächste Startnummer setzen</a>
    </>
  );
}

/** A warning for each series with few or no numbers left; nothing while both have plenty. */
function NumbersLeftNotice(props: { race: Race; left: Record<SingleOrPair, number> }) {
  const low = SINGLE_OR_PAIR.filter((series) => fewNumbersLeft(props.left[series]));
  if (low.length === 0) return null;
  return (
    <div class="alert numbers-left" role="status">
      {low.map((series) => (
        <p>
          <NumbersLeft race={props.race} series={series} left={props.left[series]} />
        </p>
      ))}
    </div>
  );
}

function RaceHeader(props: { race: RaceWithToggle; count: number }) {
  return (
    <>
      <p><a href="/admin">← Alle Läufe</a></p>
      <h1>{props.race.name}</h1>
      <p class="muted">
        {formatRaceDateShort(props.race.date, "de")} · {registrationCount(props.count)}
      </p>
      <RegistrationToggle race={props.race} from="race" />
      <a href={exportPath(props.race)} class="btn btn-secondary" download>
        Excel für RaceResult herunterladen
      </a>
      <p class="race-qr">
        <a href={posterPath(props.race)}>Aushang (A4) drucken</a>
        <QrButton label={qrStrings.show} race={props.race} />
      </p>
      <p class="race-settings">
        <a href={settingsPath(props.race)}>Einstellungen (Name, Datum, Startnummern)</a>
        <a href={deskPath(props.race)}>Anmeldetisch</a>
      </p>
    </>
  );
}

/**
 * All Registrations of the Race, grouped by Duration and then Division (empty
 * groups left out), in number order within a group; possible duplicates are
 * flagged across all groups. Above them, a warning when a series has few
 * numbers `left`; at the top, the Race's toggle.
 */
export function raceRegistrationsPage(
  c: Context<AppEnv>,
  race: RaceWithToggle,
  registrations: StoredRegistration[],
  left: Record<SingleOrPair, number>,
) {
  const duplicates = duplicatesOf(registrations);
  const groups = DURATION_ORDER.map((duration) => {
    const ofDuration = registrations.filter((r) => r.duration === duration);
    const divisions = DIVISIONS.map((division) => ({
      division,
      registrations: ofDuration.filter((r) => divisionOfRegistration(r) === division),
    })).filter((group) => group.registrations.length > 0);
    return { duration, count: ofDuration.length, divisions };
  }).filter((group) => group.count > 0);
  return c.html(
    <AdminPage url={c.req.url} title={race.name} admin={c.get("adminEmail")}>
      <RaceHeader race={race} count={registrations.length} />
      <NumbersLeftNotice race={race} left={left} />
      {registrations.length === 0 ? <p class="muted">Noch keine Anmeldungen.</p> : <RegistrationSearch />}
      {groups.map((group) => (
        <section class="reg-duration">
          <h2>{`${t.durations[group.duration].name} · ${group.count}`}</h2>
          {group.divisions.map(({ division, registrations: inDivision }) => (
            <div class="reg-division">
              <h3 class={`reg-group div-${division}`}>{`${t.divisions[division].category} · ${inDivision.length}`}</h3>
              <ul class="reg-list">
                {inDivision.map((registration) => (
                  <RegistrationCard race={race} registration={registration} duplicates={duplicates} deletable />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <p class="race-delete">
        <a href={deleteRacePath(race)}>Lauf löschen …</a>
      </p>
      <QrLayers t={qrStrings} requestUrl={c.req.url} races={[race]} />
      <script>{raw(raceSearchBundle)}</script>
    </AdminPage>,
  );
}

/**
 * The search field above the list, for the Race desk. Hidden until its script
 * (src/client/race-search.ts) runs, so without JavaScript the page shows just
 * the whole list; with `autofocus`, the script puts the cursor in it.
 */
export function RegistrationSearch(props: { autofocus?: boolean }) {
  return (
    <div class="field reg-search" hidden>
      <label class="label" for={SEARCH_FIELD_ID}>Startnummer oder Name</label>
      <input type="search" id={SEARCH_FIELD_ID} autocomplete="off" autofocus={props.autofocus} />
      <p class="muted reg-none" role="status" hidden>Keine passende Anmeldung.</p>
    </div>
  );
}

/** Asks for the Race's name before the whole Race is deleted; posting the form deletes it. */
export function deleteRacePage(c: Context<AppEnv>, race: Race, count: number, error?: string) {
  return c.html(
    <AdminPage url={c.req.url} title="Lauf löschen" admin={c.get("adminEmail")}>
      <p><a href={racePath(race)}>← {race.name}</a></p>
      <h1>Lauf löschen?</h1>
      <p>
        <b>{race.name}</b> ({formatRaceDateShort(race.date, "de")}) wird mit {registrationCount(count)} und allen Angaben
        dazu endgültig gelöscht. Das lässt sich nicht rückgängig machen. Der Link und der QR-Code führen danach ins Leere.
      </p>
      <form method="post" action={deleteRacePath(race)} class="card" novalidate>
        <div class="field">
          <label class="label" for="confirm">Zum Bestätigen den Namen des Laufs eingeben</label>
          <input type="text" id="confirm" name="confirm" autocomplete="off" aria-invalid={error ? "true" : undefined} />
          {error && <p class="error">{error}</p>}
        </div>
        <button type="submit" class="btn btn-danger">Lauf endgültig löschen</button>
      </form>
      <p class="cancel"><a href={racePath(race)}>Abbrechen</a></p>
    </AdminPage>,
    error ? 400 : 200,
  );
}

/** Asks before a Registration is deleted; posting the form deletes it. */
export function deleteRegistrationPage(c: Context<AppEnv>, race: Race, registration: StoredRegistration) {
  const from = openedFrom(c);
  return c.html(
    <AdminPage url={c.req.url} title="Anmeldung löschen" admin={c.get("adminEmail")}>
      <BackTo race={race} page={from} />
      <h1>Anmeldung löschen?</h1>
      <ul class="reg-list">
        <RegistrationCard race={race} registration={registration} />
      </ul>
      <p>Die Anmeldung und alle Angaben dazu werden gelöscht. Die Startnummer {registration.number} wird nicht neu vergeben.</p>
      <form method="post" action={deleteRegistrationPath(race, registration, from)}>
        <RegistrationField registration={registration} />
        <button type="submit" class="btn btn-danger">Endgültig löschen</button>
      </form>
      <CancelTo race={race} page={from} />
    </AdminPage>,
  );
}
