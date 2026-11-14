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

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
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
  ],
  webServer: {
    command: `node scripts/e2e-reset-db.mjs ${STATE} && npx wrangler dev --port ${PORT} --persist-to ${STATE} --var ACCESS_AUD:local-dev`,
    url: `http://localhost:${PORT}/`,
    // Always a fresh server and database, never one left running.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
