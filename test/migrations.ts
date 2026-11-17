// For the tests of a migration: back to the schema just before it, store rows as
// they were then, and migrate to the latest schema.

import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { expect } from "vitest";

/** Takes the test file's database (its storage is its own) back to the schema just before `migration`, empty. */
export async function schemaJustBefore(migration: string): Promise<void> {
  await env.DB.exec(
    "DROP TABLE previous_numbers; DROP TABLE reserved_numbers; DROP TABLE participants; DROP TABLE registrations; DROP TABLE races; DROP TABLE d1_migrations;",
  );
  const index = env.TEST_MIGRATIONS.findIndex((m) => m.name === migration);
  expect(index).toBeGreaterThan(0);
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, index));
}

/** Applies the migrations not applied yet: the one under test and those after it. */
export const migrateToLatest = () => applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
