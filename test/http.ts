import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { expect } from "vitest";
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

/** The Race's A4 poster with its QR code. */
export const posterPath = (raceLink: string) => `${adminRacePath(raceLink)}/poster`;

/** The admin page of a Registration's delete confirmation; posting to it deletes. */
export const deletePath = (raceLink: string, number: number) => `${adminRacePath(raceLink)}/registrations/${number}/delete`;

/**
 * Confirms the delete as the browser does: with the hidden field naming the
 * Registration, read from the confirmation page as it is now unless given.
 */
export async function postDelete(
  raceLink: string,
  number: number,
  { headers = { "x-test-admin": ADMIN }, registration }: { headers?: Record<string, string>; registration?: string } = {},
) {
  const named = registration ?? (await deleteFormRegistration(raceLink, number));
  return postForm(deletePath(raceLink, number), named === undefined ? {} : { registration: named }, headers);
}

/** The hidden field naming the Registration on its delete confirmation, as an Admin opens it now (none when it doesn't open). */
export const deleteFormRegistration = (raceLink: string, number: number) => registrationNamedOn(deletePath(raceLink, number));

/** The admin form for editing a Registration; posting to it saves. */
export const editPath = (raceLink: string, number: number) => `${adminRacePath(raceLink)}/registrations/${number}/edit`;

/**
 * Posts the edit form as the browser does: unless `fields` say otherwise, with
 * the hidden field naming the Registration, read from the form as it is now.
 */
export async function postEdit(raceLink: string, number: number, fields: Record<string, string>, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  const registration = fields.registration ?? (await editFormRegistration(raceLink, number));
  return postForm(editPath(raceLink, number), registration === undefined ? fields : { registration, ...fields }, headers);
}

/** The hidden field naming the Registration in its edit form, as an Admin opens it now (none when it doesn't open). */
export const editFormRegistration = (raceLink: string, number: number) => registrationNamedOn(editPath(raceLink, number));

/** The hidden field naming a Registration on an admin page (an edit form, a delete confirmation). */
async function registrationNamedOn(path: string): Promise<string | undefined> {
  const res = await asAdmin(path);
  return (await res.text()).match(/name="registration" value="(\d+)"/)?.[1];
}

/** The Race's settings page (name, date, First numbers); posting to it saves. */
export const settingsPath = (raceLink: string) => `${adminRacePath(raceLink)}/settings`;

export function postSettings(raceLink: string, fields: Record<string, string>, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  return postForm(settingsPath(raceLink), fields, headers);
}

/**
 * The confirmation the Admin is asked for before reserving numbers that
 * Registrations have, as its form sends it back; none when the page asks nothing.
 */
export const confirmationOn = (html: string) => html.match(/name="confirmed" value="([^"]*)"/)?.[1];

/** Reserves the numbers, confirming the question about taken numbers, if any, as the Admin sees it now. */
export async function reserveConfirmed(raceLink: string, numbers: string): Promise<Response> {
  const asked = await postReserve(raceLink, numbers);
  const confirmation = asked.status === 200 ? confirmationOn(await asked.clone().text()) : undefined;
  return confirmation === undefined ? asked : postReserve(raceLink, numbers, confirmation);
}

/** Reserving numbers from the Race settings page: a number or range as typed, and the confirmation the Admin gave, if any. */
export function postReserve(raceLink: string, numbers: string, confirmed?: string, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  const fields: Record<string, string> = { numbers };
  if (confirmed !== undefined) fields.confirmed = confirmed;
  return postForm(`${adminRacePath(raceLink)}/reserved`, fields, headers);
}

/** Removes one Reserved number entry (its trash-bin button on the settings page). */
export function postUnreserve(raceLink: string, from: number, to: number, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  return postForm(`${adminRacePath(raceLink)}/reserved/remove`, { from: String(from), to: String(to) }, headers);
}

/** The admin page that asks before a whole Race is deleted; posting to it deletes. */
export const deleteRacePath = (raceLink: string) => `${adminRacePath(raceLink)}/delete`;

/** Deletes a Race through the admin area, confirming with `confirm` as the typed Race name. */
export function postDeleteRace(raceLink: string, confirm: string, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  return postForm(deleteRacePath(raceLink), { confirm }, headers);
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

/** The Registration number a successful submit answered with. */
export async function numberOf(res: Response): Promise<number> {
  expect(res.status).toBe(200);
  return ((await res.json()) as { number: number }).number;
}

/** Opens or closes Registration for the Race behind a public link, through the
 * admin area. A string is sent as the raw form value.
 */
export function setRegistration(raceLink: string, open: boolean | string, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  const value = open === true ? "1" : open === false ? "0" : open;
  return postForm(`${adminRacePath(raceLink)}/registration`, { open: value }, headers);
}

/** Opens or closes Registration from the Race's own admin page, as its toggle there does. */
export function setRegistrationOnRacePage(raceLink: string, open: boolean) {
  return postForm(`${adminRacePath(raceLink)}/registration`, { open: open ? "1" : "0", from: "race" }, { "x-test-admin": ADMIN });
}

/**
 * Creates a Race through the admin area and returns its public link. A new Race
 * starts closed; as most tests need to register, this opens it unless
 * `open: false` is passed.
 */
export async function newRace(
  name: string,
  date = "2026-12-09",
  options: { open?: boolean; firstSingleNumber?: number; firstPairNumber?: number } = {},
): Promise<string> {
  const before = new Set(await publicLinks());
  const fields: Record<string, string> = { name, date };
  if (options.firstSingleNumber !== undefined) fields.firstSingleNumber = String(options.firstSingleNumber);
  if (options.firstPairNumber !== undefined) fields.firstPairNumber = String(options.firstPairNumber);
  const created = await postRace(fields);
  if (created.status !== 303) throw new Error(`Race "${name}" was not created: ${created.status}`);
  const link = (await publicLinks()).find((l) => !before.has(l));
  if (!link) throw new Error(`Race "${name}" was not created`);
  if (options.open ?? true) await setRegistration(link, true);
  return link;
}
