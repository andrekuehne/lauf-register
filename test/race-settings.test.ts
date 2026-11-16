import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { pairRegistration as pair, registration as single } from "./fixtures";
import { adminRacePath, asAdmin, newRace, numberOf, postSettings, request, settingsPath, submit } from "./http";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

const settings = (overrides: Record<string, string> = {}) => ({
  name: "Stundenlauf",
  date: "2026-12-09",
  firstSingleNumber: "1",
  firstPairNumber: "1001",
  ...overrides,
});

describe("Race settings", () => {
  it("shows the Race's current values and saves a new name and date", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 7, firstPairNumber: 1023 });

    const page = await (await asAdmin(settingsPath(race))).text();
    expect(page).toContain('value="Stundenlauf"');
    expect(page).toContain('value="2026-12-09"');
    expect(page).toContain('value="7"');
    expect(page).toContain('value="1023"');

    await postSettings(race, settings({ name: "Nikolauslauf", date: "2026-12-10", firstSingleNumber: "7", firstPairNumber: "1023" }));

    const racePage = await (await asAdmin(adminRacePath(race))).text();
    expect(racePage).toContain("Nikolauslauf");
    expect(racePage).toContain("10.12.2026");
    expect(racePage).toContain(`href="${settingsPath(race)}"`);
  });

  it("refuses invalid values with German messages and keeps the stored ones", async () => {
    const race = await newRace("Stundenlauf");

    const res = await postSettings(race, settings({ name: " ", date: "2026-02-30", firstSingleNumber: "1000", firstPairNumber: "abc" }));

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Bitte einen Namen eingeben.");
    expect(html).toContain("Bitte ein gültiges Datum wählen.");
    expect(html).toContain("Bitte eine Zahl von 1 bis 999 eingeben.");
    expect(html).toContain("Bitte eine Zahl von 1000 bis 1999 eingeben.");
    expect(html).toContain('value="abc"');
    expect(await numberOf(await submit(race, single()))).toBe(1);
  });

  it("answers 404 for an unknown Race and 403 without an Admin", async () => {
    const race = await newRace("Stundenlauf");

    expect((await asAdmin(settingsPath("/r/zzzzzzzzzz"))).status).toBe(404);
    expect((await postSettings("/r/zzzzzzzzzz", settings())).status).toBe(404);
    expect((await request(settingsPath(race))).status).toBe(403);
    expect((await postSettings(race, settings({ name: "Heimlich" }), {})).status).toBe(403);
  });

  it("raising a First number jumps ahead; lowering it never hands out an old number again", async () => {
    const race = await newRace("Stundenlauf");
    await numberOf(await submit(race, single())); // 1
    await numberOf(await submit(race, single())); // 2

    const raised = await postSettings(race, settings({ firstSingleNumber: "50", firstPairNumber: "1500" }));
    expect(raised.status).toBe(303);
    expect(raised.headers.get("location")).toBe(adminRacePath(race));
    expect(await numberOf(await submit(race, single()))).toBe(50);
    expect(await numberOf(await submit(race, pair()))).toBe(1500);

    await postSettings(race, settings({ firstSingleNumber: "1", firstPairNumber: "1001" }));
    expect(await numberOf(await submit(race, single()))).toBe(51);
    expect(await numberOf(await submit(race, pair()))).toBe(1501);
  });
});
