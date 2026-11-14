import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Runs before each test file; storage is isolated per file, so every file
// starts from a freshly migrated local D1.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
