// Races stored while First numbers were still stored continue numbering exactly
// where they did (docs/adr/0005-one-value-per-series-says-where-numbering-continues.md).

import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { anna, ben, registration } from "./fixtures";
import { numberOf, submit } from "./http";
import { migrateToLatest, schemaJustBefore } from "./migrations";

const ONE_VALUE_MIGRATION = "0010_one_numbering_value_per_series.sql";

it("keeps where each series of a stored Race continues: its First number, or after the number it handed out last if that is higher", async () => {
  await schemaJustBefore(ONE_VALUE_MIGRATION);

  const races: [token: string, first: [single: number, pair: number], last: [single: number, pair: number]][] = [
    ["ablauf2345", [181, 1061], [0, 0]], // nothing handed out yet
    ["bblauf2345", [181, 1061], [200, 1070]], // handed out up to 200 and 1070
    ["cblauf2345", [1, 1001], [0, 0]], // the defaults, nothing handed out yet
  ];
  await env.DB.batch(
    races.map(([token, first, last]) =>
      env.DB.prepare(
        `INSERT INTO races (token, name, date, created_by, registration_open, first_single_number, first_pair_number, last_single_number, last_pair_number)
         VALUES (?, 'Altlauf', '2026-12-09', 'orga@example.com', 1, ?, ?, ?, ?)`,
      ).bind(token, ...first, ...last),
    ),
  );

  await migrateToLatest();

  const continues = async (token: string) => ({
    single: await numberOf(await submit(`/r/${token}`, registration({ participants: [anna] }))),
    pair: await numberOf(await submit(`/r/${token}`, registration({ participants: [anna, ben] }))),
  });
  expect(await continues("ablauf2345")).toEqual({ single: 181, pair: 1061 });
  expect(await continues("bblauf2345")).toEqual({ single: 201, pair: 1071 });
  expect(await continues("cblauf2345")).toEqual({ single: 1, pair: 1001 });
});
