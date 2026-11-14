import type { Context } from "hono";
import type { Child } from "hono/jsx";
import type { AppEnv } from "../language";
import { Layout } from "../layout";

// The admin area is German only.

/** Page shell of the admin area: German, no language switch, the signed-in Admin on top. */
export function AdminPage(props: { url: string; title?: string; admin?: string; children: Child }) {
  return (
    <Layout lang="de" url={props.url} title={props.title ?? "Admin"} heading="Lauf-Register · Admin" languageSwitch={false}>
      {props.admin && <p class="muted admin-who">Angemeldet als {props.admin}</p>}
      {props.children}
    </Layout>
  );
}

/** An admin request that can't be carried out: a short message and the way back. */
export function problemPage(c: Context<AppEnv>, text: string, status: 400 | 404) {
  return c.html(
    <AdminPage url={c.req.url} admin={c.get("adminEmail")}>
      <p class="alert">{text}</p>
      <p><a href="/admin">Zurück zur Übersicht</a></p>
    </AdminPage>,
    status,
  );
}

/** "1 Anmeldung", "12 Anmeldungen" */
export const registrationCount = (count: number) => `${count} ${count === 1 ? "Anmeldung" : "Anmeldungen"}`;
