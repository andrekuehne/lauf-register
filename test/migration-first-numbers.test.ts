// Races stored before First numbers existed carry on exactly where they were.

import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { anna, ben, registration } from "./fixtures";
import { numberOf, submit } from "./http";
import { migrateToLatest, schemaJustBefore } from "./migrations";

const FIRST_NUMBERS_MIGRATION = "0006_first_numbers.sql";

it("keeps the next single and Pair numbers of Races stored before the migration", async () => {
  await schemaJustBefore(FIRST_NUMBERS_MIGRATION);

  // Three singles and three Pairs handed out so far; single 3 and Pair 1003 have since been deleted.
  // Neulauf has no Registrations yet.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO races (token, name, date, created_by, registration_open, last_single_number, last_pair_number)
       VALUES ('altlauf234', 'Altlauf', '2026-12-09', 'orga@example.com', 1, 3, 3)`,
    ),
    env.DB.prepare(
      `INSERT INTO races (token, name, date, created_by, registration_open) VALUES ('neulauf234', 'Neulauf', '2026-12-09', 'orga@example.com', 1)`,
    ),
    ...[1, 2, 1001, 1002].map((number) =>
      env.DB.prepare(
        `INSERT INTO registrations (race_id, number, duration, attempt_id)
         SELECT id, ?, 60, ? FROM races WHERE token = 'altlauf234'`,
      ).bind(number, `old-${number}`),
    ),
  ]);

  await migrateToLatest();

  const single = await submit("/r/altlauf234", registration({ participants: [anna] }));
  const pair = await submit("/r/altlauf234", registration({ participants: [anna, ben] }));
  expect(await numberOf(single)).toBe(4);
  expect(await numberOf(pair)).toBe(1004);
  // A Race without Registrations starts singles at 1 and Pairs at 1001.
  expect(await numberOf(await submit("/r/neulauf234", registration({ participants: [anna, ben] })))).toBe(1001);
  expect(await numberOf(await submit("/r/neulauf234", registration({ participants: [anna] })))).toBe(1);
});
