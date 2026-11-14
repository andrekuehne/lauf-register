// Before the end-to-end tests start `wrangler dev`: a fresh local D1 of their
// own (not the `npm run dev` one), with all migrations applied.
// Takes the directory that playwright.config.ts then hands to `wrangler dev --persist-to`.

import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const E2E_STATE = process.argv[2];
if (!E2E_STATE) throw new Error("Usage: node scripts/e2e-reset-db.mjs <state directory>");

rmSync(E2E_STATE, { recursive: true, force: true });
execSync(`npx wrangler d1 migrations apply DB --local --persist-to ${E2E_STATE}`, { stdio: "inherit" });
