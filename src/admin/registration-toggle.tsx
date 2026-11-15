// The Registration open/closed toggle: red "Geschlossen" and green "Offen" side
// by side, the current state filled with a ✓. Tapping the other half asks first
// (src/client/confirm.ts) and then posts the change.

import type { Race } from "../races/races";

/** The question asked before the change, naming the Race. */
const question = (race: Race, open: boolean) =>
  open
    ? `Anmeldung für ‚${race.name}‘ öffnen? Teilnehmende können sich dann über den Link anmelden.`
    : `Anmeldung für ‚${race.name}‘ schließen? Neue Anmeldungen gehen dann nur noch am Anmeldetisch.`;

/**
 * `from: "race"` when shown on the Race's own page, so the Admin returns there
 * after the change; otherwise they return to the start page.
 */
export function RegistrationToggle(props: { race: Race; from?: "race" }) {
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
      <button type="submit" class={classes} aria-pressed="false" name="open" value={open ? "1" : "0"} data-confirm={question(race, open)}>
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
