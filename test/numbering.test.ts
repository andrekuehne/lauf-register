// The counting rule for Registration numbers (see GLOSSARY.md): each series
// (singles, Pairs) counts up from its own First number within its range,
// skipping numbers already taken, and never hands a number out twice.

import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { anna, ben, editForm, pairRegistration as pair, registration as single } from "./fixtures";
import { adminRacePath, asAdmin, newRace, numberOf, postDelete, postEdit, postReserve, submit } from "./http";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

describe("Registration numbers", () => {
  it("count up from the Race's own First numbers", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 7, firstPairNumber: 1023 });

    const numbers = [];
    for (const body of [single(), pair(), single(), pair()]) numbers.push(await numberOf(await submit(race, body)));

    expect(numbers).toEqual([7, 1023, 8, 1024]);
  });

  it("never give the same number to Registrations submitted at the same moment", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 7 });

    const responses = await Promise.all(Array.from({ length: 6 }, () => submit(race, single())));
    const numbers = await Promise.all(responses.map(numberOf));

    expect(numbers.sort((a, b) => a - b)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("skip numbers another Registration of the Race already has", async () => {
    const race = await newRace("Stundenlauf");
    await numberOf(await submit(race, single())); // 1
    await takeNumbers(race, [2, 3, 5]);

    const numbers = [];
    for (let i = 0; i < 3; i++) numbers.push(await numberOf(await submit(race, single())));

    expect(numbers).toEqual([4, 6, 7]);
  });

  it("go on past a number an Admin moved away, and skip the number it was moved to", async () => {
    const race = await newRace("Stundenlauf");
    for (let i = 0; i < 5; i++) await submit(race, single()); // 1–5
    expect((await postEdit(race, 5, editForm(50, 60, [anna]))).status).toBe(303);

    const numbers = [];
    for (let i = 0; i < 46; i++) numbers.push(await numberOf(await submit(race, single())));

    // 6–49, then past 50: 5 is never given out again.
    expect(numbers).toEqual([...Array.from({ length: 44 }, (_, i) => 6 + i), 51, 52]);
  });

  it("skip a Previous number above the count: a single moved 5 → 50 → 60 keeps 50 from anyone else", async () => {
    const race = await newRace("Stundenlauf");
    for (let i = 0; i < 10; i++) await submit(race, single()); // 1–10
    expect((await postEdit(race, 5, editForm(50, 60, [anna]))).status).toBe(303);
    expect((await postEdit(race, 50, editForm(60, 60, [anna]))).status).toBe(303);

    const numbers = [];
    for (let i = 0; i < 41; i++) numbers.push(await numberOf(await submit(race, single())));

    // 11–49, then past 50 (on that Registration's card as „vorher 50“).
    expect(numbers).toEqual([...Array.from({ length: 39 }, (_, i) => 11 + i), 51, 52]);
  });

  it("skip only the Race's own Previous numbers: another Race's don't hold up its count", async () => {
    const other = await newRace("Silvesterlauf", "2026-12-31");
    for (let i = 0; i < 3; i++) await submit(other, single()); // 1–3
    expect((await postEdit(other, 2, editForm(50, 60, [anna]))).status).toBe(303); // 2 is a Previous number there
    const race = await newRace("Stundenlauf");

    const numbers = [];
    for (let i = 0; i < 3; i++) numbers.push(await numberOf(await submit(race, single())));

    expect(numbers).toEqual([1, 2, 3]);
  });

  it("skip a Previous number above the count for Pairs too", async () => {
    const race = await newRace("Stundenlauf");
    for (let i = 0; i < 3; i++) await submit(race, pair()); // 1001–1003
    expect((await postEdit(race, 1002, editForm(1010, 60, [anna, ben]))).status).toBe(303);
    expect((await postEdit(race, 1010, editForm(1020, 60, [anna, ben]))).status).toBe(303);

    const numbers = [];
    for (let i = 0; i < 8; i++) numbers.push(await numberOf(await submit(race, pair())));

    expect(numbers).toEqual([1004, 1005, 1006, 1007, 1008, 1009, 1011, 1012]);
  });

  it("skip Reserved numbers in both series", async () => {
    const race = await newRace("Stundenlauf");
    expect((await postReserve(race, "2-3")).status).toBe(303);
    expect((await postReserve(race, "5")).status).toBe(303);
    expect((await postReserve(race, "1001")).status).toBe(303);

    const numbers = [];
    for (const body of [single(), single(), single(), pair()]) numbers.push(await numberOf(await submit(race, body)));

    expect(numbers).toEqual([1, 4, 6, 1002]);
  });

  it("send a Registration to the Race desk when the only numbers left are Reserved", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 998 });
    await postReserve(race, "999");
    expect(await numberOf(await submit(race, single()))).toBe(998);

    expect((await submit(race, single())).status).toBe(409);
  });

  it("send a Registration to the Race desk when its series has no number left, and stay full", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 998 });
    expect(await numberOf(await submit(race, single()))).toBe(998);
    expect(await numberOf(await submit(race, single()))).toBe(999);

    const full = await submit(race, single());
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: "no number left" });
    expect(await (await asAdmin(adminRacePath(race))).text()).toContain("2 Anmeldungen");

    // Deleting the last one does not free 999 for the count again.
    await postDelete(race, 999);
    expect((await submit(race, single())).status).toBe(409);
    // Pairs count on regardless.
    expect(await numberOf(await submit(race, pair()))).toBe(1001);
  });

  it("hand out a number that was taken when the series ran full once it is free again, as the count never reached it", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 998 });
    await takeNumbers(race, [998, 999]);
    expect((await submit(race, single())).status).toBe(409);

    await postDelete(race, 999);

    expect(await numberOf(await submit(race, single()))).toBe(999);
  });
});

/** Stores Registrations of one Participant with the given numbers in the Race behind a public link, past the count. */
async function takeNumbers(raceLink: string, numbers: number[]) {
  const token = raceLink.slice("/r/".length);
  for (const number of numbers) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO registrations (race_id, number, duration, attempt_id)
         SELECT id, ?, 60, ? FROM races WHERE token = ?`,
      ).bind(number, `taken-${number}`, token),
      env.DB.prepare(
        `INSERT INTO participants (registration_id, slot, gender, title, first_name, last_name, birth_year)
         SELECT id, 1, 'F', 'none', 'Erika', 'Muster', 1985 FROM registrations WHERE attempt_id = ?`,
      ).bind(`taken-${number}`),
    ]);
  }
}
