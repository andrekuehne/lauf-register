// The database itself keeps Registrations off Reserved numbers (docs/adr/0003):
// whatever writes the numbers, an overlap is refused rather than stored.

import { env } from "cloudflare:workers";
import { beforeEach, expect, it } from "vitest";
import { newRace, postReserve } from "./http";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

async function raceId(raceLink: string): Promise<number> {
  const id = await env.DB.prepare("SELECT id FROM races WHERE token = ?").bind(raceLink.slice("/r/".length)).first<number>("id");
  return id!;
}

const storeRegistration = (race: number, number: number) =>
  env.DB.prepare("INSERT INTO registrations (race_id, number, duration, attempt_id) VALUES (?, ?, 60, ?)").bind(race, number, `direct-${number}`).run();

it("refuses to store a Registration on a Reserved number", async () => {
  const race = await newRace("Stundenlauf");
  await postReserve(race, "13");

  await expect(storeRegistration(await raceId(race), 13)).rejects.toThrow(/Reserved number/);
});

it("refuses to move a Registration onto a Reserved number", async () => {
  const race = await newRace("Stundenlauf");
  await postReserve(race, "13");
  const id = await raceId(race);
  await storeRegistration(id, 5);

  await expect(env.DB.prepare("UPDATE registrations SET number = 13 WHERE race_id = ? AND number = 5").bind(id).run()).rejects.toThrow(/Reserved number/);
});

it("refuses to reserve a number a Registration has", async () => {
  const race = await newRace("Stundenlauf");
  const id = await raceId(race);
  await storeRegistration(id, 5);

  await expect(env.DB.prepare("INSERT INTO reserved_numbers (race_id, number) VALUES (?, 5)").bind(id).run()).rejects.toThrow(/Reserved number/);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM registrations WHERE race_id = ? AND number = 5").bind(id).first("n")).toBe(1);
});
