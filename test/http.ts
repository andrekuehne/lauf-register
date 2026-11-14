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

export function postRace(fields: Record<string, string>, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  return request("/admin/races", {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded", ...headers },
  });
}

/** The public /r/… links on the admin Race list, newest race day first. */
export async function publicLinks(): Promise<string[]> {
  const html = await (await asAdmin("/admin")).text();
  return [...html.matchAll(/href="(\/r\/[^"]+)"/g)].map((m) => m[1]!);
}

/** Creates a Race through the admin area and returns its public link. */
export async function newRace(name: string, date = "2026-12-09"): Promise<string> {
  const before = new Set(await publicLinks());
  await postRace({ name, date });
  const link = (await publicLinks()).find((l) => !before.has(l));
  if (!link) throw new Error(`Race "${name}" was not created`);
  return link;
}
