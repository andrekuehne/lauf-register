// ⚠️ TEMPORARY FAKE BACKEND (#3) ⚠️
// Serves a demo Race and a submit endpoint that stores nothing and makes up
// Registration numbers, so the registration flow can be tried on phones before
// the real backend exists.
// - Deleted completely in #5, together with its mount line in src/index.tsx
//   and the `preview:upload` script in package.json.
// - Never write tests against it.

import { Hono } from "hono";
import type { AppEnv } from "../language";
import { raceNotFoundPage, registrationPage, type PublicRace } from "../registration/page";

const DEMO = { name: "Stundenlauf 09.12.2026", date: "2026-12-09" };

/** "demo-offline" fails about half of all submits, to try the retry state. */
const demoRaces: Record<string, PublicRace & { flaky?: boolean }> = {
  demo: { token: "demo", ...DEMO },
  "demo-offline": { token: "demo-offline", ...DEMO, flaky: true },
};

/** Same attempt ID, same made-up number: mimics the real idempotent submit without storing anything. */
function fakeNumber(attemptId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < attemptId.length; i++) hash = Math.imul(hash ^ attemptId.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 299) + 1;
}

export const fakeBackend = new Hono<AppEnv>();

fakeBackend.get("/r/:token", (c) => {
  const race = demoRaces[c.req.param("token")];
  return race ? registrationPage(c, race) : raceNotFoundPage(c);
});

fakeBackend.post("/r/:token/registrations", async (c) => {
  const race = demoRaces[c.req.param("token")];
  if (!race) return c.json({ error: "race not found" }, 404);
  const body = await c.req.json<{ attemptId?: unknown }>().catch(() => ({ attemptId: undefined }));
  if (typeof body.attemptId !== "string") return c.json({ error: "attemptId missing" }, 400);
  await new Promise((resolve) => setTimeout(resolve, 600)); // feel of a real round trip
  if (race.flaky && Math.random() < 0.5) return c.json({ error: "simulated outage" }, 503);
  return c.json({ number: fakeNumber(body.attemptId) });
});
