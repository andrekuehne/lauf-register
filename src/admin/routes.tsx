import { Hono, type Context } from "hono";
import { csrf } from "hono/csrf";
import { raceResultFileName, raceResultRows, RACERESULT_SHEET } from "../export/raceresult";
import { XLSX_CONTENT_TYPE, xlsxWorkbook } from "../export/xlsx";
import { parseReservedRange } from "../domain/reserved-numbers";
import { strings } from "../i18n";
import type { AppEnv } from "../language";
import { formatRaceDateShort, raceYear } from "../races/race-dates";
import { publicRacePath } from "../races/race-link";
import { checkNextNumbers, postedNextNumbers } from "../races/next-number-input";
import { raceFormValues, validateRaceInput, type RaceFormValues, type RaceInputErrors } from "../races/race-input";
import { createRace, deleteRace, findRaceByToken, listRaces, setRegistrationOpen, updateRace, type Race, type RaceListItem } from "../races/races";
import {
  countRegistrations,
  deleteRegistration,
  findRegistration,
  listRegistrations,
  updateRegistration,
  type StoredRegistration,
} from "../registration/registrations";
import { nextNumbers, numbersLeft, setNextNumbers } from "../registration/next-numbers";
import { listReservedNumbers, removeReservedNumbers, reserveNumbers } from "../registration/reserved-numbers";
import { normalizedText } from "../shared/same-text";
import { QrButton, QrLayers } from "../ui/qr-layer";
import { AdminPage, problemPage, registrationCount } from "./admin-page";
import { checkEdit, editRegistrationPage, numberReservedError, numberTakenError, postedValues, storedValues } from "./edit-page";
import type { AdminIdentity } from "./identity";
import { posterPage } from "./poster-page";
import {
  confirmedRegistrations,
  RaceFields,
  raceSettingsPage,
  reservedSectionPath,
  type NextNumbersSectionState,
  type ReservedSectionState,
} from "./race-settings-page";
import { RegistrationToggle } from "./registration-toggle";
import { deleteRacePage, deleteRegistrationPage, nextNumbersSectionPath, racePath, raceRegistrationsPage, settingsPath } from "./registrations-page";

const qrStrings = strings("de").qr;

function NewRaceForm(props: { values?: RaceFormValues; errors?: RaceInputErrors }) {
  const { values = raceFormValues(), errors = {} } = props;
  return (
    <form method="post" action="/admin/races" class="card" novalidate>
      <h2>Neuer Lauf</h2>
      <RaceFields values={values} errors={errors} />
      <button type="submit" class="btn">Lauf anlegen</button>
      <p class="muted form-note">Die Anmeldung ist anfangs geschlossen. Öffne sie am Lauftag in der Liste unten.</p>
    </form>
  );
}

/** Each Race as a card: its Registrations, its public page, its QR code, and the open/closed toggle. */
function RaceList(props: { races: RaceListItem[]; requestUrl: string }) {
  if (props.races.length === 0) return <p class="muted">Noch keine Läufe angelegt.</p>;
  return (
    <>
      <ul class="race-list">
        {props.races.map((race) => (
          <li class="card">
            <b class="race-name">{race.name}</b>
            <span class="muted">
              {formatRaceDateShort(race.date, "de")} · {registrationCount(race.registrationCount)}
            </span>
            <div class="race-actions">
              <a href={racePath(race)} class="btn btn-secondary btn-compact">Anmeldungen ansehen</a>
              <div class="btn-pair">
                <a href={publicRacePath(race.token)} class="btn btn-secondary btn-compact">Anmeldeseite</a>
                <QrButton label="QR-Code" race={race} class="btn btn-secondary btn-compact" />
              </div>
            </div>
            <RegistrationToggle race={race} />
            <small class="muted">angelegt von {race.createdBy}</small>
          </li>
        ))}
      </ul>
      <QrLayers t={qrStrings} requestUrl={props.requestUrl} races={props.races} />
    </>
  );
}

async function racesPage(c: Context<AppEnv>, form?: { values: RaceFormValues; errors: RaceInputErrors }) {
  const races = await listRaces(c.env.DB);
  return c.html(
    <AdminPage url={c.req.url} admin={c.get("adminEmail")}>
      <NewRaceForm values={form?.values} errors={form?.errors} />
      <h2>Läufe</h2>
      <RaceList races={races} requestUrl={c.req.url} />
    </AdminPage>,
    form ? 400 : 200,
  );
}

const RACE_NOT_FOUND = "Diesen Lauf gibt es nicht (mehr).";
const REGISTRATION_NOT_FOUND = "Diese Anmeldung gibt es nicht (mehr).";
const REGISTRATION_RENUMBERED = "Diese Startnummer hat inzwischen eine andere Anmeldung. Bitte die Anmeldung in der Liste neu öffnen.";
const NO_NUMBER_LEFT = "Es ist keine Startnummer mehr frei, um die betroffenen Anmeldungen neu zu nummerieren. Es wurde nichts gesperrt.";

/** The typed confirmation matches the Race's name; case and spacing don't matter. */
function sameName(typed: unknown, name: string): boolean {
  return typeof typed === "string" && normalizedText(typed) === normalizedText(name);
}

/** A Registration number from the URL, or null when it isn't one. */
const registrationNumber = (param: string) => (/^\d{1,9}$/.test(param) ? Number(param) : null);

/** Runs `then` with the Race and the Registration named by the URL, or answers 404. */
function withRegistration(c: Context<AppEnv>, then: (race: Race, registration: StoredRegistration) => Promise<Response>): Promise<Response> {
  return withRace(c, async (race) => {
    const number = registrationNumber(c.req.param("number") ?? "");
    const registration = number === null ? null : await findRegistration(c.env.DB, race.id, number);
    return registration ? then(race, registration) : problemPage(c, REGISTRATION_NOT_FOUND, 404);
  });
}

/**
 * Whether a posted edit form or delete confirmation was opened for this
 * Registration: false when another Registration has got its number since.
 */
const isFormFor = (form: Record<string, unknown>, registration: StoredRegistration) => form.registration === String(registration.id);

/**
 * The Race settings page with its Next numbers and Reserved numbers as stored;
 * `next` and `reserved` add what those sections show besides them, `form` the
 * Race form's posted values and errors (otherwise the stored values).
 */
async function settingsPage(
  c: Context<AppEnv>,
  race: Race,
  shows: {
    form?: { values: RaceFormValues; errors: RaceInputErrors };
    next?: Omit<NextNumbersSectionState, "next">;
    reserved?: Omit<ReservedSectionState, "numbers">;
  } = {},
) {
  const { form = { values: raceFormValues(race), errors: {} } } = shows;
  const [next, numbers] = await Promise.all([nextNumbers(c.env.DB, race.id), listReservedNumbers(c.env.DB, race.id)]);
  // Deleted by another Admin in the meantime.
  if (!next) return problemPage(c, RACE_NOT_FOUND, 404);
  return raceSettingsPage(c, race, form.values, form.errors, { ...shows.next, next }, { ...shows.reserved, numbers });
}

/** Runs `then` with the Race named by the URL's token, or answers 404. */
async function withRace(c: Context<AppEnv>, then: (race: Race) => Promise<Response>): Promise<Response> {
  const race = await findRaceByToken(c.env.DB, c.req.param("token") ?? "");
  return race ? then(race) : problemPage(c, RACE_NOT_FOUND, 404);
}

export function adminRoutes(identity: AdminIdentity) {
  const admin = new Hono<AppEnv>();

  // Cloudflare Access normally stops anonymous visitors before they get here;
  // this is the Worker's own check, so a gap in the Access setup fails closed.
  admin.use(async (c, next) => {
    const email = await identity(c);
    if (!email) {
      return c.html(
        <AdminPage url={c.req.url} title="Kein Zugriff">
          <h1>Kein Zugriff</h1>
          <p class="muted">Dieser Bereich ist nur für Admins. Bitte über die Admin-Anmeldung einloggen.</p>
        </AdminPage>,
        403,
      );
    }
    c.set("adminEmail", email);
    await next();
  });
  admin.use(csrf());

  admin.get("/", (c) => racesPage(c));

  admin.post("/races", async (c) => {
    const body = await c.req.parseBody();
    const checked = validateRaceInput(body);
    if (!checked.ok) return racesPage(c, checked);
    await createRace(c.env.DB, { ...checked.input, createdBy: c.get("adminEmail") });
    return c.redirect("/admin", 303);
  });

  admin.post("/races/:token/registration", (c) =>
    withRace(c, async (race) => {
      const { open, from } = await c.req.parseBody();
      if (open !== "1" && open !== "0") return problemPage(c, "Ungültige Anfrage.", 400);
      // Deleted by another Admin in the meantime.
      const found = await setRegistrationOpen(c.env.DB, race.token, open === "1");
      if (!found) return problemPage(c, RACE_NOT_FOUND, 404);
      // Back to the page the toggle was on.
      return c.redirect(from === "race" ? racePath(race) : "/admin", 303);
    }),
  );

  admin.get("/races/:token", (c) =>
    withRace(c, async (race) => {
      const [registrations, left] = await Promise.all([listRegistrations(c.env.DB, race.id), numbersLeft(c.env.DB, race.id)]);
      // Deleted by another Admin in the meantime.
      if (!left) return problemPage(c, RACE_NOT_FOUND, 404);
      return raceRegistrationsPage(c, race, registrations, left);
    }),
  );

  admin.get("/races/:token/settings", (c) => withRace(c, async (race) => settingsPage(c, race)));

  admin.post("/races/:token/settings", (c) =>
    withRace(c, async (race) => {
      const checked = validateRaceInput(await c.req.parseBody());
      if (!checked.ok) return settingsPage(c, race, { form: checked });
      // Deleted by another Admin in the meantime: say so rather than pretend it was saved.
      if (!(await updateRace(c.env.DB, race.id, checked.input))) return problemPage(c, RACE_NOT_FOUND, 404);
      return c.redirect(racePath(race), 303);
    }),
  );

  admin.post("/races/:token/next-numbers", (c) =>
    withRace(c, async (race) => {
      const posted = postedNextNumbers(await c.req.parseBody());
      // The fields as posted, shown again with an error or a question.
      const asPosted = { typed: posted.typed, shown: posted.shown };
      const checked = checkNextNumbers(posted, race);
      if (!checked.ok) return settingsPage(c, race, { next: { ...asPosted, errors: checked.errors } });
      // Asks first when a series would go back over free numbers, and again when those changed since the Admin was asked.
      const result = await setNextNumbers(c.env.DB, race.id, checked.changed, posted.confirmed);
      if ("toConfirm" in result) return settingsPage(c, race, { next: { ...asPosted, toConfirm: result.toConfirm } });
      if (!result.saved) return problemPage(c, RACE_NOT_FOUND, 404);
      return c.redirect(nextNumbersSectionPath(race), 303);
    }),
  );

  admin.post("/races/:token/reserved", (c) =>
    withRace(c, async (race) => {
      const { numbers, confirmed } = await c.req.parseBody();
      const typed = typeof numbers === "string" ? numbers : "";
      const parsed = parseReservedRange(typed);
      if (!parsed.ok) return settingsPage(c, race, { reserved: { typed, error: parsed.error } });
      // Asks first, and again when the Registrations on the range changed since the Admin was asked.
      const result = await reserveNumbers(c.env.DB, race.id, parsed, confirmedRegistrations(confirmed));
      if ("toConfirm" in result) return settingsPage(c, race, { reserved: { typed, toConfirm: result.toConfirm } });
      if ("noNumberLeft" in result) return settingsPage(c, race, { reserved: { typed, error: NO_NUMBER_LEFT } });
      if (result.moves.length === 0) return c.redirect(reservedSectionPath(race), 303);
      // Shown right away rather than after a redirect: the desk needs these lines to hand out the new bibs.
      return settingsPage(c, race, { reserved: { moves: result.moves } });
    }),
  );

  admin.post("/races/:token/reserved/remove", (c) =>
    withRace(c, async (race) => {
      const body = await c.req.parseBody();
      const from = registrationNumber(String(body.from ?? ""));
      const to = registrationNumber(String(body.to ?? ""));
      if (from === null || to === null) return problemPage(c, "Ungültige Anfrage.", 400);
      await removeReservedNumbers(c.env.DB, race.id, { from, to });
      return c.redirect(reservedSectionPath(race), 303);
    }),
  );

  admin.get("/races/:token/poster", (c) => withRace(c, async (race) => posterPage(c, race)));

  admin.get("/races/:token/export.xlsx", (c) =>
    withRace(c, async (race) => {
      const workbook = xlsxWorkbook(RACERESULT_SHEET, raceResultRows(await listRegistrations(c.env.DB, race.id)));
      return c.body(workbook, 200, {
        "content-type": XLSX_CONTENT_TYPE,
        "content-disposition": `attachment; filename="${raceResultFileName(race)}"`,
        // Personal data: never kept by the browser or anything in between.
        "cache-control": "no-store",
      });
    }),
  );

  admin.get("/races/:token/delete", (c) =>
    withRace(c, async (race) => deleteRacePage(c, race, await countRegistrations(c.env.DB, race.id))),
  );

  admin.post("/races/:token/delete", (c) =>
    withRace(c, async (race) => {
      const { confirm } = await c.req.parseBody();
      if (!sameName(confirm, race.name)) {
        const error = `Der Name stimmt nicht. Bitte „${race.name}“ eingeben.`;
        return deleteRacePage(c, race, await countRegistrations(c.env.DB, race.id), error);
      }
      await deleteRace(c.env.DB, race.id);
      return c.redirect("/admin", 303);
    }),
  );

  admin.get("/races/:token/registrations/:number/edit", (c) =>
    withRegistration(c, async (race, registration) => editRegistrationPage(c, race, registration, storedValues(registration))),
  );

  admin.post("/races/:token/registrations/:number/edit", (c) =>
    withRegistration(c, async (race, registration) => {
      const form = await c.req.parseBody();
      if (!isFormFor(form, registration)) return problemPage(c, REGISTRATION_RENUMBERED, 409);
      const values = postedValues(form);
      const checked = checkEdit(values, registration, raceYear(race));
      if (!checked.ok) return editRegistrationPage(c, race, registration, values, checked.errors);
      const result = await updateRegistration(c.env.DB, race.id, registration.id, checked.number, checked.content);
      // Deleted by another Admin in the meantime: say so rather than pretend it was saved.
      if (result === "not found") return problemPage(c, REGISTRATION_NOT_FOUND, 404);
      if (result === "number taken") {
        const other = await findRegistration(c.env.DB, race.id, checked.number);
        return editRegistrationPage(c, race, registration, values, numberTakenError(checked.number, other));
      }
      if (result === "number reserved") return editRegistrationPage(c, race, registration, values, numberReservedError(checked.number));
      return c.redirect(racePath(race), 303);
    }),
  );

  admin.get("/races/:token/registrations/:number/delete", (c) =>
    withRegistration(c, async (race, registration) => deleteRegistrationPage(c, race, registration)),
  );

  admin.post("/races/:token/registrations/:number/delete", (c) =>
    withRegistration(c, async (race, registration) => {
      if (!isFormFor(await c.req.parseBody(), registration)) return problemPage(c, REGISTRATION_RENUMBERED, 409);
      // Deleted by another Admin in the meantime: say so.
      if (!(await deleteRegistration(c.env.DB, race.id, registration.id))) return problemPage(c, REGISTRATION_NOT_FOUND, 404);
      return c.redirect(racePath(race), 303);
    }),
  );

  return admin;
}
