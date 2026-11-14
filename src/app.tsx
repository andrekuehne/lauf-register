import { Hono } from "hono";
import type { AdminIdentity } from "./admin/identity";
import { adminRoutes } from "./admin/routes";
import { strings } from "./i18n";
import { language, type AppEnv } from "./language";
import { Layout } from "./layout";
import { fakeBackend } from "./prototype/fake-backend";
import { findRaceByToken } from "./races/races";
import { raceNotFoundPage, registrationPage } from "./registration/page";

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

  // TEMPORARY (#3): demo Races and fake submit. Removed together with src/prototype/ in #5.
  // Only answers for its demo tokens; every other token falls through to the real route below.
  app.route("/", fakeBackend);

  app.get("/r/:token", async (c) => {
    const race = await findRaceByToken(c.env.DB, c.req.param("token"));
    return race ? registrationPage(c, race) : raceNotFoundPage(c);
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
