import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { anna, ben, pairRegistration as pair, registration as single } from "./fixtures";
import { pageText, reservedRangesOnPage } from "./admin-html";
import { adminRacePath, asAdmin, editPath, newRace, numberOf, postReserve, postSettings, postUnreserve, request, settingsPath, submit } from "./http";

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

  it("answers 404 for reserving or removing in an unknown Race, and 403 without an Admin", async () => {
    const race = await newRace("Stundenlauf");

    expect((await postReserve("/r/zzzzzzzzzz", "13")).status).toBe(404);
    expect((await postUnreserve("/r/zzzzzzzzzz", 13, 13)).status).toBe(404);
    expect((await postReserve(race, "1", undefined, {})).status).toBe(403);
    expect((await postUnreserve(race, 1, 1, {})).status).toBe(403);
    expect(await numberOf(await submit(race, single()))).toBe(1);
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

describe("Reserved numbers on the Race settings page", () => {
  it("lists them as sorted ranges, overlapping and adjacent ones merged, each with a remove button", async () => {
    const race = await newRace("Stundenlauf");

    for (const typed of ["105", "108 - 120", "13", "100–110"]) {
      const res = await postReserve(race, typed);
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe(`${settingsPath(race)}#reserved`);
    }

    const page = await (await asAdmin(settingsPath(race))).text();
    expect(pageText(page)).toContain("Gesperrte Startnummern");
    expect(reservedRangesOnPage(page)).toEqual([
      { text: "13", from: "13", to: "13", label: "13 entsperren" },
      { text: "100–120", from: "100", to: "120", label: "100–120 entsperren" },
    ]);
  });

  it("says so when there are none", async () => {
    const race = await newRace("Stundenlauf");

    const page = await (await asAdmin(settingsPath(race))).text();

    expect(reservedRangesOnPage(page)).toEqual([]);
    expect(pageText(page)).toContain("Keine gesperrten Startnummern.");
  });

  it("refuses what it can't read with a German message, keeping what was typed and reserving nothing", async () => {
    const race = await newRace("Stundenlauf");

    for (const [typed, message] of [
      ["950-900", "Bei einem Bereich bitte die kleinere Zahl zuerst eingeben (z. B. 900-950)."],
      ["2000", "Startnummern gehen von 1 bis 1999."],
      ["13a", "Bitte eine Startnummer (z. B. 13) oder einen Bereich (z. B. 900-950) eingeben."],
    ] as const) {
      const res = await postReserve(race, typed);
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(pageText(html)).toContain(message);
      expect(html).toContain(`value="${typed}"`);
      expect(reservedRangesOnPage(html)).toEqual([]);
      // The rest of the page shows the stored settings.
      expect(html).toContain('value="Stundenlauf"');
    }
    expect(await numberOf(await submit(race, single()))).toBe(1);
  });

  it("removes a range, so the count hands its numbers out again", async () => {
    const race = await newRace("Stundenlauf");
    await postReserve(race, "2-3");
    await postReserve(race, "7");

    const res = await postUnreserve(race, 2, 3);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${settingsPath(race)}#reserved`);
    const page = await (await asAdmin(settingsPath(race))).text();
    expect(reservedRangesOnPage(page).map((e) => e.text)).toEqual(["7"]);
    const numbers = [];
    for (let i = 0; i < 3; i++) numbers.push(await numberOf(await submit(race, single())));
    expect(numbers).toEqual([1, 2, 3]);
  });
});

describe("Reserving a number a Registration already has (the lost bib)", () => {
  const erika = { ...anna, title: "none", firstName: "Erika" };

  it("asks first, then gives that Registration the next number of its series and shows the change", async () => {
    const race = await newRace("Stundenlauf");
    expect(await numberOf(await submit(race, single({ participants: [erika] })))).toBe(1);
    expect(await numberOf(await submit(race, single()))).toBe(2);

    const asked = await postReserve(race, "1");

    expect(asked.status).toBe(200);
    const question = await asked.text();
    expect(pageText(question)).toContain("Startnummer 1 ist an Erika Muster vergeben. Sie bekommt eine neue Startnummer.");
    expect(question).toContain('name="confirmed" value="1"');
    // Nothing happens before the Admin confirms.
    expect(reservedRangesOnPage(question)).toEqual([]);
    expect(await firstNameOn(race, 1)).toBe("Erika");

    const confirmed = await postReserve(race, "1", "1");

    expect(confirmed.status).toBe(200);
    const result = await confirmed.text();
    expect(pageText(result)).toContain("1 → 3 (Erika Muster)");
    expect(reservedRangesOnPage(result).map((e) => e.text)).toEqual(["1"]);
    expect(await firstNameOn(race, 1)).toBeNull();
    expect(await firstNameOn(race, 3)).toBe("Erika");
    // The count carries on after the number just handed out.
    expect(await numberOf(await submit(race, single()))).toBe(4);
  });

  it("renumbers every taken number of a range, singles and Pairs each within their own series", async () => {
    const race = await newRace("Stundenlauf");
    await submit(race, single({ participants: [erika] })); // 1
    await submit(race, single({ participants: [ben] })); // 2
    await submit(race, pair()); // 1001: Dr. Anna Muster and Ben Beispiel

    const question = pageText(await (await postReserve(race, "1-2")).text());
    expect(question).toContain("Startnummer 1 ist an Erika Muster vergeben. Sie bekommt eine neue Startnummer.");
    expect(question).toContain("Startnummer 2 ist an Ben Beispiel vergeben. Er bekommt eine neue Startnummer.");
    const singles = pageText(await (await postReserve(race, "1-2", "1,2")).text());
    expect(singles).toContain("1 → 3 (Erika Muster)");
    expect(singles).toContain("2 → 4 (Ben Beispiel)");

    const pairQuestion = pageText(await (await postReserve(race, "1001")).text());
    expect(pairQuestion).toContain("Startnummer 1001 ist an Dr. Anna Muster und Ben Beispiel vergeben. Sie bekommen eine neue Startnummer.");
    const pairs = pageText(await (await postReserve(race, "1001", "1001")).text());
    expect(pairs).toContain("1001 → 1002 (Dr. Anna Muster und Ben Beispiel)");
    expect(await firstNameOn(race, 1002)).toBe("Anna");
  });

  it("asks again when other numbers of the range were taken since the Admin was asked", async () => {
    const race = await newRace("Stundenlauf");
    await submit(race, single({ participants: [erika] })); // 1
    await submit(race, single()); // 2, registered while the Admin was being asked about 1 only

    const res = await postReserve(race, "1-5", "1");

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(pageText(html)).toContain("Startnummer 2 ist an Dr. Anna Muster vergeben. Sie bekommt eine neue Startnummer.");
    expect(html).toContain('name="confirmed" value="1,2"');
    expect(reservedRangesOnPage(html)).toEqual([]);
    expect(await firstNameOn(race, 1)).toBe("Erika");
  });

  it("reserves nothing when that Registration's series has no number left", async () => {
    const race = await newRace("Stundenlauf", "2026-12-09", { firstSingleNumber: 999 });
    await submit(race, single({ participants: [erika] })); // 999

    const res = await postReserve(race, "999", "999");

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(pageText(html)).toContain("Es ist keine Startnummer mehr frei, um die betroffenen Anmeldungen neu zu nummerieren. Es wurde nichts gesperrt.");
    expect(reservedRangesOnPage(html)).toEqual([]);
    expect(await firstNameOn(race, 999)).toBe("Erika");
  });

  it("removing the Reserved number later gives nobody their old number back", async () => {
    const race = await newRace("Stundenlauf");
    await submit(race, single({ participants: [erika] })); // 1
    await postReserve(race, "1", "1"); // Erika → 2

    await postUnreserve(race, 1, 1);

    expect(await firstNameOn(race, 2)).toBe("Erika");
    expect(await firstNameOn(race, 1)).toBeNull();
    expect(await numberOf(await submit(race, single()))).toBe(3);
  });
});

/** The first name of the first Participant on the Registration with this number, as its edit form shows it; null when there is none. */
async function firstNameOn(raceLink: string, number: number): Promise<string | null> {
  const res = await asAdmin(editPath(raceLink, number));
  if (res.status === 404) return null;
  return (await res.text()).match(/name="p1\.firstName" value="([^"]*)"/)?.[1] ?? "?";
}
