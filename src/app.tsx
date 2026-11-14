import { Hono } from "hono";
import type { AdminIdentity } from "./admin/identity";
import { adminRoutes } from "./admin/routes";
import { strings } from "./i18n";
import { language, type AppEnv } from "./language";
import { Layout } from "./layout";
import { raceYear } from "./races/race-dates";
import { findRaceByToken } from "./races/races";
import { raceNotFoundPage, registrationClosedPage, registrationPage } from "./registration/page";
import { validateRegistrationInput } from "./registration/registration-input";
import { submitRegistration } from "./registration/registrations";

/** The whole Worker app. The admin identity is passed in so tests can substitute it (the only test double). */
export function createApp(deps: { identity: AdminIdentity }) {
  const app = new Hono<AppEnv>();

  app.use(language);

  app.get("/", (c) => {
    const lang = c.get("lang");
    return c.html(
      <Layout lang={lang} url={c.req.url}>
        <h1>{strings(lang).appName}</h1>
        <p class="muted">{strings(lang).home.text}</p>
      </Layout>,
    );
  });

  app.route("/admin", adminRoutes(deps.identity));

  app.get("/r/:token", async (c) => {
    const race = await findRaceByToken(c.env.DB, c.req.param("token"));
    if (!race) return raceNotFoundPage(c);
    return race.registrationOpen ? registrationPage(c, race) : registrationClosedPage(c, race);
  });

  // Called by the browser flow (src/client/flow.ts), JSON in and out.
  app.post("/r/:token/registrations", async (c) => {
    const race = await findRaceByToken(c.env.DB, c.req.param("token"));
    if (!race) return c.json({ error: "race not found" }, 404);
    const body = await c.req.json().catch(() => undefined);
    const result = validateRegistrationInput(body, raceYear(race));
    if (!result.ok) {
      if (!race.registrationOpen) return c.json({ error: "registration closed" }, 409);
      return c.json({ error: "invalid registration", issues: result.issues }, 400);
    }
    const submitted = await submitRegistration(c.env.DB, race.id, result.input);
    // A form opened before the Admin closed Registration ends up here; the flow shows the closed message.
    if ("closed" in submitted) return c.json({ error: "registration closed" }, 409);
    return c.json({ number: submitted.number });
  });

  app.notFound((c) => {
    const lang = c.get("lang");
    const t = strings(lang).notFound;
    return c.html(
      <Layout lang={lang} url={c.req.url} title={t.title}>
        <h1>{t.title}</h1>
        <p class="muted">{t.text}</p>
      </Layout>,
      404,
    );
  });

  return app;
}
