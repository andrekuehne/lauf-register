// End-to-end tests of the registration flow in real browsers (`npm run test:e2e`).
// They run against the local Worker (`wrangler dev`) with a fresh local D1, and
// set up their Races through the admin pages. The admin sign-in is the local
// Cloudflare Access stand-in from wrangler.jsonc (`access.dev`), as in `npm run dev`.

import { defineConfig, devices } from "@playwright/test";

const PORT = 8791;
/** The end-to-end tests' own local D1, wiped and migrated before every run. */
const STATE = ".wrangler/e2e-state";

/** Phone-sized, with touch: WebKit stands in for iPhone Safari, Chromium for Android. */
const phone = (device: string, width: number) => ({
  ...devices[device],
  viewport: { width, height: 740 },
});

/** The Anmeldetisch's tests: they also run on the Race desk's tablets and laptops, the phone tests don't. */
const DESK_TESTS = "**/desk.e2e.ts";
/** Adding a Registration at the Anmeldetisch: on the tablet in portrait and the laptop only. */
const DESK_ADD_TESTS = "**/desk-add.e2e.ts";
/** A project for the tablet in portrait or the laptop: the Anmeldetisch's tests and adding a Registration there. */
const DESK_AND_ADD = { testMatch: [DESK_TESTS, DESK_ADD_TESTS], testIgnore: [] };

/** A Race desk device: a tablet (with touch) or a laptop, in Chromium. */
const chromiumDesk = (width: number, height: number, hasTouch: boolean) => ({
  ...devices["Desktop Chrome"],
  viewport: { width, height },
  hasTouch,
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  testIgnore: DESK_ADD_TESTS,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a test that fails once in CI blocks the deploy.
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "webkit-390", use: phone("iPhone 13", 390) },
    { name: "webkit-320", use: phone("iPhone SE", 320) },
    { name: "chromium-390", use: phone("Pixel 7", 390) },
    { name: "chromium-320", use: phone("Pixel 7", 320) },
    // A tablet in portrait and in landscape, and a laptop.
    { name: "webkit-768", ...DESK_AND_ADD, use: devices["iPad Mini"] },
    { name: "webkit-1024", testMatch: DESK_TESTS, use: devices["iPad Mini landscape"] },
    { name: "webkit-1280", ...DESK_AND_ADD, use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } } },
    { name: "chromium-768", ...DESK_AND_ADD, use: chromiumDesk(768, 1024, true) },
    { name: "chromium-1024", testMatch: DESK_TESTS, use: chromiumDesk(1024, 768, true) },
    { name: "chromium-1280", ...DESK_AND_ADD, use: chromiumDesk(1280, 800, false) },
  ],
  webServer: {
    command: `node scripts/e2e-reset-db.mjs ${STATE} && npx wrangler dev --port ${PORT} --persist-to ${STATE} --var ACCESS_AUD:local-dev`,
    url: `http://localhost:${PORT}/`,
    // Always a fresh server and database, never one left running.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
