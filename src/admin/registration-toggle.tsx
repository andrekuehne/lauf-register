// The Registration open/closed toggle: red "Geschlossen" and green "Offen" side
// by side, the current state filled with a ✓. Tapping the other half asks first
// (src/client/confirm.ts) and then posts the change.

import { SINGLE_OR_PAIR, type SingleOrPair } from "../domain/categories";
import { formatNumbers } from "../domain/reserved-numbers";
import type { Race } from "../races/races";
import type { NextNumbers } from "../registration/next-numbers";
import type { NextAndReserved } from "../registration/reserved-numbers";
import { SERIES_NAMES, type RacePage } from "./admin-page";

/**
 * What the toggle needs besides the Race: whether Registration is open and,
 * only while it is closed, the Next and Reserved numbers the question before
 * opening shows. Closing asks without them, and working them out reads
 * thousands of database rows, too many to spend on every reload on race day.
 */
export type ToggleState = { registrationOpen: true } | { registrationOpen: false; numbers: NextAndReserved };

/** A Race with what its toggle needs. */
export type RaceWithToggle = Race & ToggleState;

/** „Einzelne 181“, or „Einzelne: keine mehr frei“ when the series has no number left. */
const nextOf = (next: NextNumbers, series: SingleOrPair) => {
  const number = next[series];
  return number === null ? `${SERIES_NAMES[series]}: keine mehr frei` : `${SERIES_NAMES[series]} ${number}`;
};

/**
 * The question asked before changing the Race's state, naming the Race. Before
 * opening, it also shows where the counts continue and what is Reserved, so a
 * Race whose numbers were never set is caught before someone gets a bib
 * already handed out.
 */
const question = (race: RaceWithToggle) =>
  race.registrationOpen
    ? `Anmeldung für ‚${race.name}‘ schließen? Neue Anmeldungen gehen dann nur noch am Anmeldetisch.`
    : [
        `Anmeldung für ‚${race.name}‘ öffnen? Teilnehmende können sich dann über den Link anmelden.`,
        `Nächste Startnummern: ${SINGLE_OR_PAIR.map((series) => nextOf(race.numbers.next, series)).join(", ")}.`,
        `Gesperrt: ${race.numbers.reserved.length > 0 ? formatNumbers(race.numbers.reserved) : "keine"}.`,
      ].join("\n");

/**
 * The toggle for `race`. `from` names the Race's own page it is shown on (its
 * Race page or its Anmeldetisch), so the Admin returns there after the change;
 * without it they return to the start page.
 */
export function RegistrationToggle(props: { race: RaceWithToggle; from?: RacePage }) {
  const { race } = props;
  const labelId = `reg-switch-${race.token}`;
  const half = (open: boolean) => {
    const label = open ? "Offen" : "Geschlossen";
    const classes = `toggle-half ${open ? "toggle-open" : "toggle-closed"}`;
    if (open === race.registrationOpen) {
      return (
        <button type="button" class={classes} aria-pressed="true">
          <span aria-hidden="true">✓ </span>
          {label}
        </button>
      );
    }
    return (
      <button type="submit" class={classes} aria-pressed="false" name="open" value={open ? "1" : "0"} data-confirm={question(race)}>
        {label}
      </button>
    );
  };
  return (
    <form method="post" action={`/admin/races/${race.token}/registration`} class="reg-switch">
      {props.from && <input type="hidden" name="from" value={props.from} />}
      <span class="label" id={labelId}>Anmeldung</span>
      <div class="toggle" role="group" aria-labelledby={labelId}>
        {half(false)}
        {half(true)}
      </div>
    </form>
  );
}
