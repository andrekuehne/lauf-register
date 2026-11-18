// The Anmeldetisch updates itself: every write that changes what it shows is
// pushed to its connected screens over a WebSocket (docs/adr/0006).

import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DeskUpdate } from "../src/shared/desk-update";
import { pageText, registrationToggle } from "./admin-html";
import { anna, ben, editForm, registration } from "./fixtures";
import {
  ADMIN,
  ORIGIN,
  deskPath,
  newRace,
  nextNumbersForm,
  numberOf,
  postDelete,
  postEdit,
  postNextNumbers,
  postUnreserve,
  request,
  reserveConfirmed,
  setRegistration,
  submit,
  submitWhileDeskUnreachable,
} from "./http";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

/** Where the Anmeldetisch of the Race behind a public link connects to. */
const livePath = (raceLink: string) => `${deskPath(raceLink)}/live`;

/** The WebSocket upgrade a browser on the admin site sends, signed in as the test Admin unless other headers are given. */
const upgrade = (raceLink: string, headers: Record<string, string> = { "x-test-admin": ADMIN }) =>
  request(livePath(raceLink), { headers: { upgrade: "websocket", origin: ORIGIN, ...headers } });

/** A connected Anmeldetisch: the updates it has received, in order. */
type Screen = { updates: DeskUpdate[]; next: () => Promise<DeskUpdate>; close: () => void };

const open: WebSocket[] = [];
afterEach(() => {
  for (const ws of open.splice(0)) ws.close();
});

/** Connects an Anmeldetisch screen to the Race behind a public link. */
async function connect(raceLink: string): Promise<Screen> {
  const res = await upgrade(raceLink);
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  open.push(ws);
  const updates: DeskUpdate[] = [];
  let seen = 0;
  const waiting: (() => void)[] = [];
  ws.addEventListener("message", (event) => {
    updates.push(JSON.parse(event.data as string) as DeskUpdate);
    for (const wake of waiting.splice(0)) wake();
  });
  /** The next update not yet taken, waiting for it if need be. */
  const next = async (): Promise<DeskUpdate> => {
    const deadline = Date.now() + 2000;
    while (updates.length <= seen) {
      if (Date.now() > deadline) throw new Error("No update arrived");
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
        setTimeout(resolve, 50);
      });
    }
    return updates[seen++]!;
  };
  return { updates, next, close: () => ws.close() };
}

/** A changed row as it reads on screen. */
const rowText = (update: DeskUpdate, index = 0) => pageText(update.changed[index]!.html);

describe("connecting an Anmeldetisch", () => {
  it("refuses an anonymous request", async () => {
    const race = await newRace("Stundenlauf");

    const res = await upgrade(race, {});

    expect(res.status).toBe(403);
    expect(res.webSocket).toBeNull();
  });

  it("answers a request without the upgrade, signed in, with 426: what the screen checks its sign-in by", async () => {
    const race = await newRace("Stundenlauf");

    expect((await request(livePath(race), { headers: { "x-test-admin": ADMIN } })).status).toBe(426);
    expect((await request(livePath(race))).status).toBe(403);
  });

  it("refuses a page of another site, which the browser would send the Admin's sign-in along from", async () => {
    const race = await newRace("Stundenlauf");

    const res = await upgrade(race, { "x-test-admin": ADMIN, origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(res.webSocket).toBeNull();
  });
});

describe("what a connected Anmeldetisch is sent", () => {
  it("a Participant registering on a phone: the new Registration's row as stored, and the numbers left", async () => {
    const race = await newRace("Stundenlauf");
    const screen = await connect(race);

    await submit(race, registration({ participants: [{ ...ben, title: "dr" }, anna], duration: 30 }));

    const update = await screen.next();
    expect(update.changed).toHaveLength(1);
    expect(update.deleted).toEqual([]);
    expect(rowText(update)).toMatch(/^1001 .*Mixed-Paar · Halbstundenlauf.*Dr\. Ben Beispiel · 1990 · ohne Verein.*Dr\. Anna Muster · 1985 · LG Nord/);
    expect(pageText(update.status)).toContain("✓ Offen");
    expect(pageText(update.status)).toContain("Paare: noch 998 Startnummern frei.");
  });

  it("a Registration edited: its row as stored now, under the same id", async () => {
    const race = await newRace("Stundenlauf");
    const screen = await connect(race);
    await submit(race, registration({ participants: [anna] }));
    const { id } = (await screen.next()).changed[0]!;

    expect((await postEdit(race, 1, editForm(7, 30, [{ ...anna, club: "TV Süd" }]))).status).toBe(303);

    const update = await screen.next();
    expect(update.changed.map((row) => row.id)).toEqual([id]);
    expect(rowText(update)).toMatch(/^7 vorher 1 .*Frauen · Halbstundenlauf.*Dr\. Anna Muster · 1985 · TV Süd/);
    expect(update.deleted).toEqual([]);
  });

  it("a Registration deleted: its id, and the numbers left", async () => {
    const race = await newRace("Stundenlauf");
    const screen = await connect(race);
    await submit(race, registration({ participants: [anna] }));
    const { id } = (await screen.next()).changed[0]!;

    expect((await postDelete(race, 1)).status).toBe(303);

    const update = await screen.next();
    expect(update.deleted).toEqual([id]);
    expect(update.changed).toEqual([]);
    expect(pageText(update.status)).toContain("Einzelne: noch 998 Startnummern frei.");
  });

  it("numbers reserved that a Registration had: its row under its new number, and the numbers left", async () => {
    const race = await newRace("Stundenlauf");
    const screen = await connect(race);
    await submit(race, registration({ participants: [anna] })); // 1
    await submit(race, registration({ participants: [ben] })); // 2
    const { id } = (await screen.next()).changed[0]!;
    await screen.next();

    expect((await reserveConfirmed(race, "1")).status).toBe(200);

    const update = await screen.next();
    expect(update.changed.map((row) => row.id)).toEqual([id]);
    expect(rowText(update)).toMatch(/^3 vorher 1 .*Dr\. Anna Muster/);
    expect(pageText(update.status)).toContain("Einzelne: noch 996 Startnummern frei.");
  });

  it("numbers unreserved: the numbers left", async () => {
    const race = await newRace("Stundenlauf");
    const screen = await connect(race);
    await reserveConfirmed(race, "5-9");
    expect(pageText((await screen.next()).status)).toContain("Einzelne: noch 994 Startnummern frei.");

    expect((await postUnreserve(race, 5, 9)).status).toBe(303);

    const update = await screen.next();
    expect(update).toMatchObject({ changed: [], deleted: [] });
    expect(pageText(update.status)).toContain("Einzelne: noch 999 Startnummern frei.");
  });

  it("a Next number changed: the numbers left", async () => {
    const race = await newRace("Stundenlauf");
    const screen = await connect(race);

    expect((await postNextNumbers(race, { ...(await nextNumbersForm(race)), nextSingleNumber: "900" })).status).toBe(303);

    const update = await screen.next();
    expect(update).toMatchObject({ changed: [], deleted: [] });
    expect(pageText(update.status)).toContain("Einzelne: noch 100 Startnummern frei.");
  });

  it("Registration closed and opened: the toggle as it is now, asking before opening as on the page", async () => {
    const race = await newRace("Stundenlauf");
    const screen = await connect(race);

    expect((await setRegistration(race, false)).status).toBe(303);
    const closed = registrationToggle((await screen.next()).status);
    expect((await setRegistration(race, true)).status).toBe(303);
    const opened = registrationToggle((await screen.next()).status);

    expect(closed?.state).toBe("✓ Geschlossen");
    expect(closed?.offer.confirm).toContain("Nächste Startnummern: Einzelne 1, Paare 1001.");
    expect(opened?.state).toBe("✓ Offen");
  });
});

describe("a notification that fails", () => {
  it("never fails the write: the Registration is stored and the phone gets its number", async () => {
    const race = await newRace("Stundenlauf");

    const res = await submitWhileDeskUnreachable(race, registration({ participants: [anna] }));

    expect(await numberOf(res)).toBe(1);
    const screen = await connect(race);
    await submit(race, registration({ participants: [ben] }));
    expect(rowText(await screen.next())).toMatch(/^2 /);
  });
});
