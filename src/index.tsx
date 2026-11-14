import { Hono } from "hono";
import { strings } from "./i18n";
import { language, type AppEnv } from "./language";
import { Layout } from "./layout";
import { fakeBackend } from "./prototype/fake-backend";

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

// TEMPORARY (#3): demo Race and fake submit. Removed together with src/prototype/ in #5.
app.route("/", fakeBackend);

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

export default app;
