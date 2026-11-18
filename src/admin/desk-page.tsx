// The Anmeldetisch: the Race desk's screen on a tablet or laptop. The desk looks
// people up by number or name and hands out their bib; beside the list, what it
// needs to keep an eye on. Export, settings, QR code, poster and deleting the
// Race stay on the Race page (src/admin/registrations-page.tsx).

import type { Context } from "hono";
import { raw } from "hono/html";
import { DIVISIONS, SINGLE_OR_PAIR, type Division, type Duration, type SingleOrPair } from "../domain/categories";
import { deskLiveBundle } from "../generated/desk-live-bundle";
import { raceSearchBundle } from "../generated/race-search-bundle";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import { formatRaceDateShort } from "../races/race-dates";
import type { Race } from "../races/races";
import { divisionOfRegistration } from "../registration/registration-input";
import type { StoredRegistration } from "../registration/registrations";
import { DESK_LIVE } from "../shared/desk-update";
import { registrationCount } from "../shared/registration-count";
import { AdminPage } from "./admin-page";
import { RegistrationToggle, type RaceWithToggle } from "./registration-toggle";
import {
  addPath,
  CategoryLabel,
  deleteRegistrationPath,
  deskLivePath,
  DURATION_ORDER,
  editPath,
  fewNumbersLeft,
  fullName,
  NumbersLeft,
  racePath,
  RegistrationSearch,
  searchAttributes,
} from "./registrations-page";

const t = strings("de").flow;

/**
 * One compact row: the number big (with any Previous numbers), the Category,
 * and each Participant with birth year and club. Also what the live updates
 * find and count it by (src/client/desk-live.ts).
 */
export function DeskRow(props: { race: Race; registration: StoredRegistration }) {
  const { race, registration } = props;
  const division = divisionOfRegistration(registration);
  const live = { [DESK_LIVE.id]: registration.id, [DESK_LIVE.duration]: registration.duration, [DESK_LIVE.division]: division };
  return (
    <li class={`card reg desk-row div-${division}`} data-registration={registration.number} {...searchAttributes(registration)} {...live}>
      <div class="desk-no">
        <b class="reg-no">{registration.number}</b>
        {/* The confirmation screen may still show an old number. */}
        {registration.previousNumbers.length > 0 && <small class="muted">vorher {registration.previousNumbers.join(", ")}</small>}
      </div>
      <div class="desk-who">
        <CategoryLabel division={division} duration={registration.duration} />
        {registration.participants.map((p) => (
          <p class="reg-person">
            <b>{fullName(p)}</b> <span class="muted">· {p.birthYear} · {p.club ?? t.noClub}</span>
          </p>
        ))}
      </div>
      <p class="reg-actions">
        <a href={editPath(race, registration, "desk")}>Bearbeiten</a>
        <a href={deleteRegistrationPath(race, registration, "desk")} class="reg-delete">
          Löschen
        </a>
      </p>
    </li>
  );
}

/** The numbers `left` in each series, as a warning when they are few (as on the Race page). */
function DeskNumbersLeft(props: { race: Race; left: Record<SingleOrPair, number> }) {
  return (
    <section>
      <h2>Startnummern</h2>
      {SINGLE_OR_PAIR.map((series) => {
        const few = fewNumbersLeft(props.left[series]);
        return (
          <p class={few ? "alert" : undefined} role={few ? "status" : undefined}>
            <NumbersLeft race={props.race} series={series} left={props.left[series]} />
          </p>
        );
      })}
    </section>
  );
}

/**
 * The side column's part that changes with the Race's state rather than its
 * list: the toggle and the numbers left. A live update replaces it as a whole.
 */
export function DeskStatus(props: { race: RaceWithToggle; left: Record<SingleOrPair, number> }) {
  return (
    <div {...{ [DESK_LIVE.status]: "" }}>
      <RegistrationToggle race={props.race} from="desk" />
      <DeskNumbersLeft race={props.race} left={props.left} />
    </div>
  );
}

/**
 * How many Registrations each Division has in each Duration (the hour first, as
 * on the Race page), and each Duration in all. Each cell says what it counts,
 * for the live updates to count again.
 */
function DeskCounts(props: { registrations: StoredRegistration[] }) {
  const count = (duration: Duration, division?: Division) =>
    props.registrations.filter((r) => r.duration === duration && (!division || divisionOfRegistration(r) === division)).length;
  return (
    <section>
      <h2>Anmeldungen</h2>
      <table class="desk-counts">
        <thead>
          <tr>
            <td></td>
            {DURATION_ORDER.map((duration) => <th scope="col">{t.durations[duration].short}</th>)}
          </tr>
        </thead>
        <tbody>
          {DIVISIONS.map((division) => (
            <tr class={`div-${division}`}>
              <th scope="row">{t.divisions[division].category}</th>
              {DURATION_ORDER.map((duration) => <td {...{ [DESK_LIVE.count]: `${duration} ${division}` }}>{count(duration, division)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Gesamt</th>
            {DURATION_ORDER.map((duration) => <td {...{ [DESK_LIVE.count]: String(duration) }}>{count(duration)}</td>)}
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

/**
 * The Anmeldetisch of `race`: every Registration, newest first and not
 * grouped (Registration ids count up as Registrations are stored, so the
 * highest is the newest). Beside them, the Race's toggle, the numbers `left`
 * in each series, and the counts per Duration and Division. It updates itself
 * (src/client/desk-live.ts): every change is pushed to it over a WebSocket.
 */
export function deskPage(c: Context<AppEnv>, race: RaceWithToggle, registrations: StoredRegistration[], left: Record<SingleOrPair, number>) {
  const newestFirst = [...registrations].sort((a, b) => b.id - a.id);
  return c.html(
    <AdminPage url={c.req.url} title={`Anmeldetisch · ${race.name}`} admin={c.get("adminEmail")} wide>
      <p><a href={racePath(race)}>← {race.name}</a></p>
      <h1>Anmeldetisch</h1>
      <p class="muted">
        {race.name} · {formatRaceDateShort(race.date, "de")} · <span {...{ [DESK_LIVE.total]: "" }}>{registrationCount(registrations.length)}</span>
      </p>
      <p class="muted desk-connection" role="status" hidden {...{ [DESK_LIVE.connection]: "" }}></p>
      <div class="desk">
        <div class="desk-main">
          <RegistrationSearch autofocus add={addPath(race)} />
          <p class="muted desk-empty" hidden={registrations.length > 0}>
            Noch keine Anmeldungen.
          </p>
          <ul class="reg-list" {...{ [DESK_LIVE.socketPath]: deskLivePath(race) }}>
            {newestFirst.map((registration) => (
              <DeskRow race={race} registration={registration} />
            ))}
          </ul>
        </div>
        <aside class="desk-side">
          <DeskStatus race={race} left={left} />
          <DeskCounts registrations={registrations} />
        </aside>
      </div>
      <script>{raw(raceSearchBundle)}</script>
      <script>{raw(deskLiveBundle)}</script>
    </AdminPage>,
  );
}
