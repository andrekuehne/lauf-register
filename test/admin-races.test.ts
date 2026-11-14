import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AdminIdentity } from "../src/admin/identity";

// The one allowed test double: the admin identity. A request is "signed in"
// as whatever email the x-test-admin header names; without it, it's anonymous.
const testIdentity: AdminIdentity = async (c) => c.req.header("x-test-admin") ?? null;
const app = createApp({ identity: testIdentity });

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

const ORIGIN = "https://example.com";
const ADMIN = "orga@example.com";

async function request(path: string, init: RequestInit = {}) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`${ORIGIN}${path}`, { redirect: "manual", ...init }), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

const asAdmin = (path: string, init: RequestInit = {}) =>
  request(path, { ...init, headers: { "x-test-admin": ADMIN, ...(init.headers ?? {}) } });

function postRace(fields: Record<string, string>, headers: Record<string, string> = { "x-test-admin": ADMIN }) {
  return request("/admin/races", {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded", ...headers },
  });
}

async function publicLinks(): Promise<string[]> {
  const html = await (await asAdmin("/admin")).text();
  return [...html.matchAll(/href="(\/r\/[^"]+)"/g)].map((m) => m[1]!);
}

describe("admin area", () => {
  it("rejects requests without a signed-in Admin", async () => {
    const list = await request("/admin");
    const create = await postRace({ name: "Heimlich", date: "2026-12-09" }, {});

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
    expect(await (await asAdmin("/admin")).text()).not.toContain("Heimlich");
  });

  it("lets an Admin create a Race and see it in the list", async () => {
    const res = await postRace({ name: "Stundenlauf 09.12.2026", date: "2026-12-09" });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin");
    const html = await (await asAdmin("/admin")).text();
    expect(html).toContain("Stundenlauf 09.12.2026");
    expect(html).toContain("09.12.2026");
    expect(html).toContain("0 Anmeldungen");
    expect(html).toContain(ADMIN);
  });

  it("refuses a Race without a name or with an invalid date", async () => {
    const noName = await postRace({ name: "   ", date: "2026-12-09" });
    const badDate = await postRace({ name: "Kaputt", date: "2026-02-30" });

    expect(noName.status).toBe(400);
    expect(await noName.text()).toContain("Bitte einen Namen eingeben");
    expect(badDate.status).toBe(400);
    expect(await badDate.text()).toContain("Bitte ein gültiges Datum wählen");
    expect(await publicLinks()).toEqual([]);
  });

  it("gives every Race its own random public link", async () => {
    await postRace({ name: "Lauf A", date: "2026-12-09" });
    await postRace({ name: "Lauf B", date: "2026-12-10" });

    const tokens = (await publicLinks()).map((link) => link.slice("/r/".length));
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
    for (const token of tokens) expect(token).toMatch(/^[a-km-np-z2-9]{10}$/);
    expect(tokens.some((t) => /^\d+$/.test(t))).toBe(false);
  });
});

describe("public Race link", () => {
  it("shows the Race's name and date", async () => {
    await postRace({ name: "Stundenlauf 09.12.2026", date: "2026-12-09" });
    const [link] = await publicLinks();

    const res = await request(link!);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Stundenlauf 09.12.2026");
    expect(html).toContain("Mittwoch, 9. Dezember 2026");
  });

  it("shows a friendly German not-found page for an unknown token", async () => {
    const res = await request("/r/zzzzzzzz");

    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Lauf nicht gefunden");
  });
});
