import { Hono, type Context } from "hono";
import { csrf } from "hono/csrf";
import type { Child } from "hono/jsx";
import type { AppEnv } from "../language";
import { Layout } from "../layout";
import { formatRaceDateShort } from "../races/race-dates";
import { MAX_RACE_NAME_LENGTH, validateRaceInput, type RaceInput, type RaceInputErrors } from "../races/race-input";
import { createRace, listRaces, setRegistrationOpen, type RaceListItem } from "../races/races";
import type { AdminIdentity } from "./identity";

// The admin area is German only.

function AdminPage(props: { url: string; title?: string; admin?: string; children: Child }) {
  return (
    <Layout lang="de" url={props.url} title={props.title ?? "Admin"} heading="Lauf-Register · Admin" languageSwitch={false}>
      {props.admin && <p class="muted admin-who">Angemeldet als {props.admin}</p>}
      {props.children}
    </Layout>
  );
}

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
              {formatRaceDateShort(race.date, "de")} · {race.registrationCount} {race.registrationCount === 1 ? "Anmeldung" : "Anmeldungen"}
            </span>
            <a href={link} class="race-link">{`${props.origin}${link}`}</a>
            <RegistrationSwitch race={race} />
            <small class="muted">angelegt von {race.createdBy}</small>
          </li>
        );
      })}
    </ul>
  );
}

function problemPage(c: Context<AppEnv>, text: string, status: 400 | 404) {
  return c.html(
    <AdminPage url={c.req.url} admin={c.get("adminEmail")}>
      <p class="alert">{text}</p>
      <p><a href="/admin">Zurück zur Übersicht</a></p>
    </AdminPage>,
    status,
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
    if (!found) return problemPage(c, "Diesen Lauf gibt es nicht (mehr).", 404);
    return c.redirect("/admin", 303);
  });

  return admin;
}
