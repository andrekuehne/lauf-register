import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { createApp } from "../src/app";
import type { AdminIdentity } from "../src/admin/identity";

// The one allowed test double: the admin identity. A request is "signed in"
// as whatever email the x-test-admin header names; without it, it's anonymous.
const testIdentity: AdminIdentity = async (c) => c.req.header("x-test-admin") ?? null;
const app = createApp({ identity: testIdentity });

export const ORIGIN = "https://example.com";
export const ADMIN = "orga@example.com";

export async function request(path: string, init: RequestInit = {}) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`${ORIGIN}${path}`, { redirect: "manual", ...init }), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

export const asAdmin = (path: string, init: RequestInit = {}) =>
  request(path, { ...init, headers: { "x-test-admin": ADMIN, ...(init.headers ?? {}) } });

/** Posts an admin form, signed in as the test Admin unless other headers are given. */
function postForm(path: string, fields: Record<string, string>, headers: Record<string, string>) {
  return request(path, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded", ...headers },
  });
}

export function postRace(fields: Record<string, string>, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  return postForm("/admin/races", fields, headers);
}

/** The admin page of the Race behind a public link (its Registrations). */
export const adminRacePath = (raceLink: string) => `/admin/races/${raceLink.slice("/r/".length)}`;

/** The admin page of a Registration's delete confirmation; posting to it deletes. */
export const deletePath = (raceLink: string, number: number) => `${adminRacePath(raceLink)}/registrations/${number}/delete`;

export function postDelete(raceLink: string, number: number, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  return postForm(deletePath(raceLink, number), {}, headers);
}

/** The public /r/… links on the admin Race list, newest race day first. */
export async function publicLinks(): Promise<string[]> {
  const html = await (await asAdmin("/admin")).text();
  return [...html.matchAll(/href="(\/r\/[^"]+)"/g)].map((m) => m[1]!);
}

/** Submits a Registration through the public link, as the browser flow does. */
export function submit(raceLink: string, body: unknown) {
  return request(`${raceLink}/registrations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Opens or closes Registration for the Race behind a public link, through the
 * admin area. A string is sent as the raw form value.
 */
export function setRegistration(raceLink: string, open: boolean | string, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  const value = open === true ? "1" : open === false ? "0" : open;
  return postForm(`/admin/races/${raceLink.slice("/r/".length)}/registration`, { open: value }, headers);
}

/**
 * Creates a Race through the admin area and returns its public link. A new Race
 * starts closed; as most tests need to register, this opens it unless
 * `open: false` is passed.
 */
export async function newRace(name: string, date = "2026-12-09", options: { open?: boolean } = {}): Promise<string> {
  const before = new Set(await publicLinks());
  await postRace({ name, date });
  const link = (await publicLinks()).find((l) => !before.has(l));
  if (!link) throw new Error(`Race "${name}" was not created`);
  if (options.open ?? true) await setRegistration(link, true);
  return link;
}
