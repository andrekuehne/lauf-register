// The admin page of one Race (its Registrations) and the delete confirmation.

import type { Context } from "hono";
import { DIVISIONS, GENDER_LETTER, SINGLE_OR_PAIR, type Duration, type SingleOrPair } from "../domain/categories";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import { formatRaceDateShort, formatRegistrationTime } from "../races/race-dates";
import type { Race } from "../races/races";
import { duplicatesOf } from "../registration/duplicates";
import { divisionOfRegistration, type ParticipantInput } from "../registration/registration-input";
import type { StoredRegistration } from "../registration/registrations";
import type { NextAndReserved } from "../registration/reserved-numbers";
import { divisionIconSvg } from "../ui/icon-svgs";
import { Icon } from "../ui/icons";
import { QrButton, QrLayers } from "../ui/qr-layer";
import { AdminPage, registrationCount, SERIES_NAMES } from "./admin-page";
import { RegistrationToggle } from "./registration-toggle";

const t = strings("de").flow;
const qrStrings = strings("de").qr;

export const racePath = (race: Race) => `/admin/races/${race.token}`;
export const deleteRacePath = (race: Race) => `${racePath(race)}/delete`;
const exportPath = (race: Race) => `${racePath(race)}/export.xlsx`;
export const posterPath = (race: Race) => `${racePath(race)}/poster`;
export const settingsPath = (race: Race) => `${racePath(race)}/settings`;
/** The settings page opened at the Next numbers section. */
export const nextNumbersSectionPath = (race: Race) => `${settingsPath(race)}#next`;

/** Below this many numbers left in a series, the Race page warns: with 1–10 registering at once, a few minutes' notice. */
const FEW_NUMBERS_LEFT = 20;
export const editPath = (race: Race, registration: StoredRegistration) => `${racePath(race)}/registrations/${registration.number}/edit`;
const deletePath = (race: Race, registration: StoredRegistration) => `${racePath(race)}/registrations/${registration.number}/delete`;

/** The Race page lists the hour first; Divisions in their usual order (women first, singles before Pairs). */
const DURATION_ORDER: readonly Duration[] = [60, 30];

/** „Dr. Anna Muster“ */
export function fullName(p: ParticipantInput): string {
  return `${p.title === "none" ? "" : `${t.titles[p.title]} `}${p.firstName} ${p.lastName}`;
}

/** „Erika Muster“, or „Anna Muster und Ben Beispiel“ for a Pair. */
export const participantNames = (registration: StoredRegistration) => registration.participants.map(fullName).join(" und ");

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
    <li class={`card reg div-${division}`} data-registration={registration.number}>
      <div class="reg-head">
        <b class="reg-no">{registration.number}</b>
        <span class="reg-cat">
          <Icon svg={divisionIconSvg(division)} />
          <span>{`${t.divisions[division].category} · ${t.durations[registration.duration].name}`}</span>
        </span>
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
          <a href={deletePath(race, registration)} class="reg-delete">
            Löschen
          </a>
        </p>
      )}
    </li>
  );
}

/** A warning for each series with few or no numbers left; nothing while both have plenty. */
function NumbersLeftNotice(props: { race: Race; left: Record<SingleOrPair, number> }) {
  const low = SINGLE_OR_PAIR.filter((series) => props.left[series] < FEW_NUMBERS_LEFT);
  if (low.length === 0) return null;
  return (
    <div class="alert numbers-left" role="status">
      {low.map((series) => {
        const left = props.left[series];
        if (left > 0) return <p>{`${SERIES_NAMES[series]}: noch ${left} ${left === 1 ? "Startnummer" : "Startnummern"} frei.`}</p>;
        return (
          <p>
            {`${SERIES_NAMES[series]}: keine Startnummer mehr frei. Neue Anmeldungen werden abgelehnt. `}
            <a href={nextNumbersSectionPath(props.race)}>Nächste Startnummer setzen</a>
          </p>
        );
      })}
    </div>
  );
}

function RaceHeader(props: { race: Race; count: number; numbers: NextAndReserved }) {
  return (
    <>
      <p><a href="/admin">← Alle Läufe</a></p>
      <h1>{props.race.name}</h1>
      <p class="muted">
        {formatRaceDateShort(props.race.date, "de")} · {registrationCount(props.count)}
      </p>
      <RegistrationToggle race={props.race} numbers={props.numbers} from="race" />
      <a href={exportPath(props.race)} class="btn btn-secondary" download>
        Excel für RaceResult herunterladen
      </a>
      <p class="race-qr">
        <a href={posterPath(props.race)}>Aushang (A4) drucken</a>
        <QrButton label={qrStrings.show} race={props.race} />
      </p>
      <p class="race-settings">
        <a href={settingsPath(props.race)}>Einstellungen (Name, Datum, Startnummern)</a>
      </p>
    </>
  );
}

/**
 * All Registrations of the Race, grouped by Duration and then Division (empty
 * groups left out), in number order within a group; possible duplicates are
 * flagged across all groups. Above them, a warning when a series has few
 * numbers `left`; the Race's Next and Reserved `numbers` go into the toggle's question.
 */
export function raceRegistrationsPage(
  c: Context<AppEnv>,
  race: Race,
  registrations: StoredRegistration[],
  left: Record<SingleOrPair, number>,
  numbers: NextAndReserved,
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
      <RaceHeader race={race} count={registrations.length} numbers={numbers} />
      <NumbersLeftNotice race={race} left={left} />
      {registrations.length === 0 && <p class="muted">Noch keine Anmeldungen.</p>}
      {groups.map((group) => (
        <section class="reg-duration">
          <h2>{`${t.durations[group.duration].name} · ${group.count}`}</h2>
          {group.divisions.map(({ division, registrations: inDivision }) => (
            <>
              <h3 class={`reg-group div-${division}`}>{`${t.divisions[division].category} · ${inDivision.length}`}</h3>
              <ul class="reg-list">
                {inDivision.map((registration) => (
                  <RegistrationCard race={race} registration={registration} duplicates={duplicates} deletable />
                ))}
              </ul>
            </>
          ))}
        </section>
      ))}
      <p class="race-delete">
        <a href={deleteRacePath(race)}>Lauf löschen …</a>
      </p>
      <QrLayers t={qrStrings} requestUrl={c.req.url} races={[race]} />
    </AdminPage>,
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
  return c.html(
    <AdminPage url={c.req.url} title="Anmeldung löschen" admin={c.get("adminEmail")}>
      <p><a href={racePath(race)}>← {race.name}</a></p>
      <h1>Anmeldung löschen?</h1>
      <ul class="reg-list">
        <RegistrationCard race={race} registration={registration} />
      </ul>
      <p>Die Anmeldung und alle Angaben dazu werden gelöscht. Die Startnummer {registration.number} wird nicht neu vergeben.</p>
      <form method="post" action={deletePath(race, registration)}>
        {/* Which Registration this is, should another one get its number before confirming. */}
        <input type="hidden" name="registration" value={String(registration.id)} />
        <button type="submit" class="btn btn-danger">Endgültig löschen</button>
      </form>
      <p class="cancel"><a href={racePath(race)}>Abbrechen</a></p>
    </AdminPage>,
  );
}
