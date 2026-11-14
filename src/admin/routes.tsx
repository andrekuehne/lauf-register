import { Hono, type Context } from "hono";
import { csrf } from "hono/csrf";
import { raceResultFileName, raceResultRows, RACERESULT_SHEET } from "../export/raceresult";
import { XLSX_CONTENT_TYPE, xlsxWorkbook } from "../export/xlsx";
import type { AppEnv } from "../language";
import { formatRaceDateShort } from "../races/race-dates";
import { MAX_RACE_NAME_LENGTH, validateRaceInput, type RaceInput, type RaceInputErrors } from "../races/race-input";
import { createRace, findRaceByToken, listRaces, setRegistrationOpen, type Race, type RaceListItem } from "../races/races";
import { deleteRegistration, findRegistration, listRegistrations } from "../registration/registrations";
import { AdminPage, problemPage, registrationCount } from "./admin-page";
import type { AdminIdentity } from "./identity";
import { deleteRegistrationPage, racePath, raceRegistrationsPage } from "./registrations-page";

function NewRaceForm(props: { values?: Partial<RaceInput>; errors?: RaceInputErrors }) {
  const { values = {}, errors = {} } = props;
  return (
    <form method="post" action="/admin/races" class="card" novalidate>
      <h2>Neuer Lauf</h2>
      <div class="field">
        <label class="label" for="race-name">Name</label>
        <input type="text" id="race-name" name="name" value={values.name ?? ""} maxlength={MAX_RACE_NAME_LENGTH} placeholder="Stundenlauf 09.12.2026" aria-invalid={errors.name ? "true" : undefined} />
        {errors.name && <p class="error">{errors.name}</p>}
      </div>
      <div class="field">
        <label class="label" for="race-date">Datum</label>
        <input type="date" id="race-date" name="date" value={values.date ?? ""} aria-invalid={errors.date ? "true" : undefined} />
        {errors.date && <p class="error">{errors.date}</p>}
      </div>
      <button type="submit" class="btn">Lauf anlegen</button>
      <p class="muted form-note">Die Anmeldung ist anfangs geschlossen. Öffne sie am Lauftag in der Liste unten.</p>
    </form>
  );
}

/** The Race's open/closed state and the button that flips it. */
function RegistrationSwitch(props: { race: RaceListItem }) {
  const open = props.race.registrationOpen;
  return (
    <form method="post" action={`/admin/races/${props.race.token}/registration`} class="reg-switch">
      <input type="hidden" name="open" value={open ? "0" : "1"} />
      <b class={open ? "reg-state reg-open" : "reg-state reg-closed"}>{open ? "Anmeldung offen" : "Anmeldung geschlossen"}</b>
      <button type="submit" class="btn-small">{open ? "Anmeldung schließen" : "Anmeldung öffnen"}</button>
    </form>
  );
}

function RaceList(props: { races: RaceListItem[]; origin: string }) {
  if (props.races.length === 0) return <p class="muted">Noch keine Läufe angelegt.</p>;
  return (
    <ul class="race-list">
      {props.races.map((race) => {
        const link = `/r/${race.token}`;
        return (
          <li class="card">
            <b class="race-name">{race.name}</b>
            <span class="muted">
              {formatRaceDateShort(race.date, "de")} · {registrationCount(race.registrationCount)}
            </span>
            <a href={link} class="race-link">{`${props.origin}${link}`}</a>
            <a href={racePath(race)} class="race-regs">Anmeldungen ansehen →</a>
            <RegistrationSwitch race={race} />
            <small class="muted">angelegt von {race.createdBy}</small>
          </li>
        );
      })}
    </ul>
  );
}

async function racesPage(c: Context<AppEnv>, form?: { values: RaceInput; errors: RaceInputErrors }) {
  const races = await listRaces(c.env.DB);
  return c.html(
    <AdminPage url={c.req.url} admin={c.get("adminEmail")}>
      <NewRaceForm values={form?.values} errors={form?.errors} />
      <h2>Läufe</h2>
      <RaceList races={races} origin={new URL(c.req.url).origin} />
    </AdminPage>,
    form ? 400 : 200,
  );
}

const RACE_NOT_FOUND = "Diesen Lauf gibt es nicht (mehr).";
const REGISTRATION_NOT_FOUND = "Diese Anmeldung gibt es nicht (mehr).";

/** A Registration number from the URL, or null when it isn't one. */
const registrationNumber = (param: string) => (/^\d{1,9}$/.test(param) ? Number(param) : null);

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
    const { input, errors } = validateRaceInput(body);
    if (Object.keys(errors).length > 0) return racesPage(c, { values: input, errors });
    await createRace(c.env.DB, { ...input, createdBy: c.get("adminEmail") });
    return c.redirect("/admin", 303);
  });

  admin.post("/races/:token/registration", async (c) => {
    const { open } = await c.req.parseBody();
    if (open !== "1" && open !== "0") return problemPage(c, "Ungültige Anfrage.", 400);
    const found = await setRegistrationOpen(c.env.DB, c.req.param("token"), open === "1");
    if (!found) return problemPage(c, RACE_NOT_FOUND, 404);
    return c.redirect("/admin", 303);
  });

  admin.get("/races/:token", (c) =>
    withRace(c, async (race) => raceRegistrationsPage(c, race, await listRegistrations(c.env.DB, race.id))),
  );

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

  admin.get("/races/:token/registrations/:number/delete", (c) =>
    withRace(c, async (race) => {
      const number = registrationNumber(c.req.param("number"));
      const registration = number === null ? null : await findRegistration(c.env.DB, race.id, number);
      if (!registration) return problemPage(c, REGISTRATION_NOT_FOUND, 404);
      return deleteRegistrationPage(c, race, registration);
    }),
  );

  admin.post("/races/:token/registrations/:number/delete", (c) =>
    withRace(c, async (race) => {
      const number = registrationNumber(c.req.param("number"));
      const deleted = number !== null && (await deleteRegistration(c.env.DB, race.id, number));
      if (!deleted) return problemPage(c, REGISTRATION_NOT_FOUND, 404);
      return c.redirect(racePath(race), 303);
    }),
  );

  return admin;
}
