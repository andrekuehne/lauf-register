import type { Context } from "hono";
import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import type { SingleOrPair } from "../domain/categories";
import { confirmBundle } from "../generated/confirm-bundle";
import type { AppEnv } from "../language";
import { Layout } from "../layout";
import type { StoredRegistration } from "../registration/registrations";

// The admin area is German only.

/**
 * Page shell of the admin area: German, no language switch, the signed-in Admin
 * on top. `wide` for a page that uses a tablet's or laptop's width.
 */
export function AdminPage(props: { url: string; title?: string; admin?: string; wide?: boolean; children: Child }) {
  return (
    <Layout lang="de" url={props.url} title={props.title ?? "Admin"} heading="Lauf-Register · Admin" languageSwitch={false} legalLinks={false} wide={props.wide}>
      {props.admin && <p class="muted admin-who">Angemeldet als {props.admin}</p>}
      {props.children}
      <script>{raw(confirmBundle)}</script>
    </Layout>
  );
}

/** An admin request that can't be carried out: a short message, a `link` onward if there is one, and the way back. */
export function problemPage(c: Context<AppEnv>, text: string, status: 400 | 404 | 409, link?: { href: string; text: string }) {
  return c.html(
    <AdminPage url={c.req.url} admin={c.get("adminEmail")}>
      <p class="alert">{text}</p>
      {link && <p><a href={link.href}>{link.text}</a></p>}
      <p><a href="/admin">Zurück zur Übersicht</a></p>
    </AdminPage>,
    status,
  );
}

/** The name of the hidden field that says which Registration an edit form or delete confirmation is for. */
export const REGISTRATION_FIELD = "registration";

/**
 * The hidden field naming the form's Registration by its id, whatever number it
 * has by the time the form is posted (see withPostedForm in routes.tsx).
 */
export const RegistrationField = (props: { registration: StoredRegistration }) => (
  <input type="hidden" name={REGISTRATION_FIELD} value={String(props.registration.id)} />
);

/**
 * A Race's own pages that other admin pages lead back to: its Race page, or
 * its Anmeldetisch. Posted or linked as `from`, it says where an Admin came from.
 */
export type RacePage = "race" | "desk";

/** The RacePage a posted or linked `from` names; undefined when it names none. */
export const racePageFrom = (from: unknown): RacePage | undefined => (from === "race" || from === "desk" ? from : undefined);

/** The Race's own page this page was opened from, as its URL says (`?from=desk`): the Race page unless it says otherwise. */
export const openedFrom = (c: Context<AppEnv>): RacePage => racePageFrom(c.req.query("from")) ?? "race";

/** Series as the admin pages' notices name them. */
export const SERIES_NAMES: Record<SingleOrPair, string> = { single: "Einzelne", pair: "Paare" };
