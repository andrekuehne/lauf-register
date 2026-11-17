// A Registration on a Reserved number before the database rule (docs/adr/0003)
// keeps its number; the number is no longer Reserved.

import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { reservedRangesOnPage } from "./admin-html";
import { asAdmin, editPath, settingsPath } from "./http";
import { migrateToLatest, schemaJustBefore } from "./migrations";

const RULE_MIGRATION = "0008_reserved_numbers_rule_and_previous_numbers.sql";

it("keeps a Registration on its Reserved number and unreserves that number only", async () => {
  await schemaJustBefore(RULE_MIGRATION);

  // Erika was moved onto Reserved 13 by hand (#20); 14 is Reserved and free.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO races (token, name, date, created_by, registration_open, last_single_number)
       VALUES ('altlauf234', 'Altlauf', '2026-12-09', 'orga@example.com', 1, 1)`,
    ),
    env.DB.prepare(`INSERT INTO registrations (race_id, number, duration, attempt_id) SELECT id, 13, 60, 'old-1' FROM races`),
    env.DB.prepare(
      `INSERT INTO participants (registration_id, slot, gender, title, first_name, last_name, birth_year)
       SELECT id, 1, 'F', 'none', 'Erika', 'Muster', 1985 FROM registrations`,
    ),
    env.DB.prepare(`INSERT INTO reserved_numbers (race_id, number) SELECT id, 13 FROM races UNION ALL SELECT id, 14 FROM races`),
  ]);

  await migrateToLatest();

  const edit = await (await asAdmin(editPath("/r/altlauf234", 13))).text();
  expect(edit).toContain('value="Erika"');
  const settings = await (await asAdmin(settingsPath("/r/altlauf234"))).text();
  expect(reservedRangesOnPage(settings).map((range) => range.text)).toEqual(["14"]);
});
