// The admin page of one Race (its Registrations) and the delete confirmation.

import type { Context } from "hono";
import { DIVISIONS, divisionOf, GENDER_LETTER, type Duration } from "../domain/categories";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import { formatRaceDateShort, formatRegistrationTime } from "../races/race-dates";
import type { Race } from "../races/races";
import { duplicatesOf } from "../registration/duplicates";
import type { ParticipantInput } from "../registration/registration-input";
import type { StoredRegistration } from "../registration/registrations";
import { divisionIconSvg } from "../ui/icon-svgs";
import { Icon } from "../ui/icons";
import { AdminPage, registrationCount } from "./admin-page";

const t = strings("de").flow;

export const racePath = (race: Race) => `/admin/races/${race.token}`;
const exportPath = (race: Race) => `${racePath(race)}/export.xlsx`;
const deletePath = (race: Race, registration: StoredRegistration) => `${racePath(race)}/registrations/${registration.number}/delete`;

/** The Race page lists the hour first; Divisions in their usual order (women first, singles before Pairs). */
const DURATION_ORDER: readonly Duration[] = [60, 30];

const divisionOfRegistration = (registration: StoredRegistration) => divisionOf(registration.participants.map((p) => p.gender));

function fullName(p: ParticipantInput): string {
  return `${p.title === "none" ? "" : `${t.titles[p.title]} `}${p.firstName} ${p.lastName}`;
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
    <li class={`card reg div-${division}`} data-registration={registration.number}>
      <div class="reg-head">
        <b class="reg-no">{registration.number}</b>
        <span class="reg-cat">
          <Icon svg={divisionIconSvg(division)} />
          <span>{`${t.divisions[division].category} · ${t.durations[registration.duration].name}`}</span>
        </span>
        <span class="muted reg-time">{formatRegistrationTime(registration.createdAt, race.date)}</span>
      </div>
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
        <a href={deletePath(race, registration)} class="reg-delete">
          Löschen
        </a>
      )}
    </li>
  );
}

function RaceHeader(props: { race: Race; count: number }) {
  return (
    <>
      <p><a href="/admin">← Alle Läufe</a></p>
      <h1>{props.race.name}</h1>
      <p class="muted">
        {formatRaceDateShort(props.race.date, "de")} · {registrationCount(props.count)} ·{" "}
        {props.race.registrationOpen ? "Anmeldung offen" : "Anmeldung geschlossen"}
      </p>
      <a href={exportPath(props.race)} class="btn btn-secondary" download>
        Excel für RaceResult herunterladen
      </a>
    </>
  );
}

/**
 * All Registrations of the Race, grouped by Duration and then Division (empty
 * groups left out), in number order within a group; possible duplicates are
 * flagged across all groups.
 */
export function raceRegistrationsPage(c: Context<AppEnv>, race: Race, registrations: StoredRegistration[]) {
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
    </AdminPage>,
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
        <button type="submit" class="btn btn-danger">Endgültig löschen</button>
      </form>
      <p class="cancel"><a href={racePath(race)}>Abbrechen</a></p>
    </AdminPage>,
  );
}
