// The Registration open/closed toggle: red "Geschlossen" and green "Offen" side
// by side, the current state filled with a ✓. Tapping the other half asks first
// (src/client/confirm.ts) and then posts the change.

import { SINGLE_OR_PAIR, type SingleOrPair } from "../domain/categories";
import { formatNumbers } from "../domain/reserved-numbers";
import type { Race } from "../races/races";
import type { NextNumbers } from "../registration/next-numbers";
import type { NextAndReserved } from "../registration/reserved-numbers";
import { SERIES_NAMES } from "./admin-page";

/** „Einzelne 181“, or „Einzelne: keine mehr frei“ when the series has no number left. */
const nextOf = (next: NextNumbers, series: SingleOrPair) => {
  const number = next[series];
  return number === null ? `${SERIES_NAMES[series]}: keine mehr frei` : `${SERIES_NAMES[series]} ${number}`;
};

/**
 * The question asked before the change, naming the Race. Before opening, it also
 * shows where the counts continue and what is Reserved, so a Race whose First
 * numbers were never set is caught before someone gets a bib already handed out.
 */
const question = (race: Race, open: boolean, numbers: NextAndReserved) =>
  open
    ? [
        `Anmeldung für ‚${race.name}‘ öffnen? Teilnehmende können sich dann über den Link anmelden.`,
        `Nächste Startnummern: ${SINGLE_OR_PAIR.map((series) => nextOf(numbers.next, series)).join(", ")}.`,
        `Gesperrt: ${numbers.reserved.length > 0 ? formatNumbers(numbers.reserved) : "keine"}.`,
      ].join("\n")
    : `Anmeldung für ‚${race.name}‘ schließen? Neue Anmeldungen gehen dann nur noch am Anmeldetisch.`;

/**
 * The toggle for `race`, whose Next numbers and Reserved numbers are `numbers`.
 * `from: "race"` when shown on the Race's own page, so the Admin returns there
 * after the change; otherwise they return to the start page.
 */
export function RegistrationToggle(props: { race: Race; numbers: NextAndReserved; from?: "race" }) {
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
      <button type="submit" class={classes} aria-pressed="false" name="open" value={open ? "1" : "0"} data-confirm={question(race, open, props.numbers)}>
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
