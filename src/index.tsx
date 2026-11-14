import { Hono } from "hono";
import { Layout } from "./layout";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.html(
    <Layout>
      <h1>Lauf-Register</h1>
      <p>Die Anmeldung zum Lauf ist hier bald möglich.</p>
    </Layout>,
  ),
);

app.notFound((c) =>
  c.html(
    <Layout title="Seite nicht gefunden">
      <h1>Seite nicht gefunden</h1>
      <p>Bitte prüfe den Link oder scanne den QR-Code erneut.</p>
    </Layout>,
    404,
  ),
);

export default app;
