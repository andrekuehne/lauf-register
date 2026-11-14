import { createScheduledController } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { anna, ben, registration } from "./fixtures";
import { adminRacePath, asAdmin, deleteRacePath, newRace, postDeleteRace, postRace, publicLinks, request, submit } from "./http";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

const raceNames = async () => [...(await (await asAdmin("/admin")).text()).matchAll(/<b class="race-name">([^<]*)</g)].map((m) => m[1]);

describe("deleting a Race", () => {
  it("first asks for the Race's name and deletes nothing yet", async () => {
    const race = await newRace("Stundenlauf 09.12.2026");

    const confirm = await asAdmin(deleteRacePath(race));

    expect(confirm.status).toBe(200);
    const html = await confirm.text();
    expect(html).toContain("Stundenlauf 09.12.2026");
    expect(html).toContain('name="confirm"');
    expect(await raceNames()).toEqual(["Stundenlauf 09.12.2026"]);
  });

  it("is reached from the Race's admin page", async () => {
    const race = await newRace("Stundenlauf");

    expect(await (await asAdmin(adminRacePath(race))).text()).toContain(`href="${deleteRacePath(race)}"`);
  });

  it("removes the Race with its Registrations; its links then show not found, other Races stay", async () => {
    const race = await newRace("Stundenlauf 09.12.2026", "2026-12-09");
    const other = await newRace("Anderer Lauf", "2026-12-10");
    await submit(race, registration({ participants: [anna, ben] }));
    await submit(other, registration());

    const res = await postDeleteRace(race, "Stundenlauf 09.12.2026");

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin");
    expect(await raceNames()).toEqual(["Anderer Lauf"]);
    const publicPage = await request(race);
    expect(publicPage.status).toBe(404);
    expect(await publicPage.text()).toContain("Lauf nicht gefunden");
    expect((await asAdmin(adminRacePath(race))).status).toBe(404);
    expect(await (await asAdmin("/admin")).text()).toContain("1 Anmeldung<");
    expect(await (await asAdmin(adminRacePath(other))).text()).toContain("Anna Muster");
  });

  it("accepts the name regardless of case and spacing", async () => {
    const race = await newRace("Stundenlauf Grün");

    const res = await postDeleteRace(race, "  stundenlauf   GRÜN ");

    expect(res.status).toBe(303);
    expect(await raceNames()).toEqual([]);
  });

  it("is refused with a wrong or missing name, and the Race stays", async () => {
    const race = await newRace("Stundenlauf");
    await submit(race, registration());

    const wrong = await postDeleteRace(race, "Stundenlau");
    const empty = await postDeleteRace(race, "");

    expect(wrong.status).toBe(400);
    expect(await wrong.text()).toContain("Der Name stimmt nicht");
    expect(empty.status).toBe(400);
    expect(await raceNames()).toEqual(["Stundenlauf"]);
    expect((await request(race)).status).toBe(200);
    expect(await (await asAdmin(adminRacePath(race))).text()).toContain("Anna Muster");
  });

  it("is only for signed-in Admins, and answers 404 for an unknown Race", async () => {
    const race = await newRace("Stundenlauf");

    const anonymous = await postDeleteRace(race, "Stundenlauf", {});
    const anonymousConfirm = await request(deleteRacePath(race));
    const unknown = await postDeleteRace("/r/zzzzzzzzzz", "Stundenlauf");

    expect(anonymous.status).toBe(403);
    expect(anonymousConfirm.status).toBe(403);
    expect(unknown.status).toBe(404);
    expect(await raceNames()).toEqual(["Stundenlauf"]);
  });
});

/** Runs the Worker's daily scheduled handler as if it fired at `now`. */
async function runDailyCleanup(now: string) {
  await worker.scheduled(createScheduledController({ scheduledTime: new Date(now), cron: "0 2 * * *" }), env);
}

describe("the daily cleanup", () => {
  it("deletes exactly the Races whose date is 30 or more days past, with their Registrations", async () => {
    for (const [name, date] of [
      ["Morgen", "2027-01-09"],
      ["Heute", "2027-01-08"],
      ["Vor 29 Tagen", "2026-12-10"],
      ["Vor 30 Tagen", "2026-12-09"],
      ["Vor 31 Tagen", "2026-12-08"],
      ["Letztes Jahr", "2025-12-09"],
    ]) {
      await postRace({ name: name!, date: date! });
    }

    await runDailyCleanup("2027-01-08T02:00:00Z");

    expect(await raceNames()).toEqual(["Morgen", "Heute", "Vor 29 Tagen"]);
  });

  it("counts days in German time: just after midnight there it is already the next day", async () => {
    await postRace({ name: "Vor 30 Tagen", date: "2026-12-09" });
    await postRace({ name: "Vor 31 Tagen", date: "2026-12-08" });

    await runDailyCleanup("2027-01-07T22:30:00Z"); // 23:30 in Berlin, 7 January: day 29 and 30

    expect(await raceNames()).toEqual(["Vor 30 Tagen"]);

    await runDailyCleanup("2027-01-07T23:30:00Z"); // 00:30 in Berlin, 8 January

    expect(await raceNames()).toEqual([]);
  });

  it("counts the same way in summer time", async () => {
    await postRace({ name: "Vor 29 Tagen", date: "2027-06-02" });
    await postRace({ name: "Vor 30 Tagen", date: "2027-06-01" });

    await runDailyCleanup("2027-07-01T02:00:00Z"); // 04:00 in Berlin, 1 July

    expect(await raceNames()).toEqual(["Vor 29 Tagen"]);
  });

  it("takes the Registrations of a deleted Race with it", async () => {
    const old = await newRace("Alter Lauf", "2026-11-01");
    await submit(old, registration());
    const current = await newRace("Aktueller Lauf", "2027-01-08");
    await submit(current, registration({ participants: [ben] }));

    await runDailyCleanup("2027-01-08T02:00:00Z");

    expect(await publicLinks()).toEqual([current]);
    expect(await (await asAdmin("/admin")).text()).toContain("1 Anmeldung<");
    expect((await request(old)).status).toBe(404);
  });
});
