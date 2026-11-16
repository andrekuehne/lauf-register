// Races stored before First numbers existed carry on exactly where they were.

import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { anna, ben, registration } from "./fixtures";
import { submit } from "./http";

const FIRST_NUMBERS_MIGRATION = "0006_first_numbers.sql";

it("keeps the next single and Pair numbers of a Race stored before the migration", async () => {
  // Back to the schema just before the migration (this file's storage is its own).
  await env.DB.exec(
    "DROP TABLE reserved_numbers; DROP TABLE participants; DROP TABLE registrations; DROP TABLE races; DROP TABLE d1_migrations;",
  );
  const index = env.TEST_MIGRATIONS.findIndex((m) => m.name === FIRST_NUMBERS_MIGRATION);
  expect(index).toBeGreaterThan(0);
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, index));

  // Three singles and three Pairs handed out so far; single 3 and Pair 1003 have since been deleted.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO races (token, name, date, created_by, registration_open, last_single_number, last_pair_number)
       VALUES ('altlauf234', 'Altlauf', '2026-12-09', 'orga@example.com', 1, 3, 3)`,
    ),
    ...[1, 2, 1001, 1002].map((number) =>
      env.DB.prepare(
        `INSERT INTO registrations (race_id, number, duration, attempt_id)
         SELECT id, ?, 60, ? FROM races WHERE token = 'altlauf234'`,
      ).bind(number, `old-${number}`),
    ),
  ]);

  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

  const single = await submit("/r/altlauf234", registration({ participants: [anna] }));
  const pair = await submit("/r/altlauf234", registration({ participants: [anna, ben] }));
  expect(await single.json()).toEqual({ number: 4 });
  expect(await pair.json()).toEqual({ number: 1004 });
});

it("starts a Race without Pairs so far at Pair number 1001", async () => {
  await env.DB.exec("DELETE FROM races");
  await env.DB.exec(
    `INSERT INTO races (token, name, date, created_by, registration_open) VALUES ('neulauf234', 'Neulauf', '2026-12-09', 'orga@example.com', 1)`,
  );

  const pair = await submit("/r/neulauf234", registration({ participants: [anna, ben] }));

  expect(await pair.json()).toEqual({ number: 1001 });
});
