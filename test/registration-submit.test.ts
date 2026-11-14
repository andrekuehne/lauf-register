import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { asAdmin, newRace, request } from "./http";

// Storage is shared by the tests in a file: start each test without Races
// (deleting a Race also deletes its Registrations).
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

let attempts = 0;
const freshAttemptId = () => `attempt-${++attempts}-${crypto.randomUUID()}`;

const anna = { gender: "F", title: "dr", firstName: "Anna", lastName: "Muster", birthYear: 1985, club: "LG Nord" };
const clara = { gender: "F", title: "none", firstName: "Clara", lastName: "Muster", birthYear: 2015, club: "LG Nord" };
const ben = { gender: "M", title: "none", firstName: "Ben", lastName: "Beispiel", birthYear: 1990, club: null };
const emil = { gender: "M", title: "none", firstName: "Emil", lastName: "Beispiel", birthYear: 2017, club: null };

function registration(overrides: Record<string, unknown> = {}) {
  return {
    attemptId: freshAttemptId(),
    duration: 60,
    consent: true,
    participants: [anna],
    ...overrides,
  };
}

function submit(raceLink: string, body: unknown) {
  return request(`${raceLink}/registrations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function numberOf(res: Response): Promise<number> {
  expect(res.status).toBe(200);
  return ((await res.json()) as { number: number }).number;
}

describe("submitting a Registration", () => {
  it("stores a single Participant and returns Registration number 1", async () => {
    const race = await newRace("Stundenlauf");

    const res = await submit(race, registration());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ number: 1 });
  });

  it("numbers singles from 1 and Pairs from 1001, each on its own", async () => {
    const race = await newRace("Stundenlauf");
    const numbers = [];

    for (const participants of [
      [anna],
      [anna, clara],
      [ben],
      [ben, emil],
      [anna, ben],
      [emil, clara],
      [emil],
    ]) {
      numbers.push(await numberOf(await submit(race, registration({ duration: 30, participants }))));
    }

    expect(numbers).toEqual([1, 1001, 2, 1002, 1003, 1004, 3]);
  });

  it("numbers each Race on its own", async () => {
    const first = await newRace("Lauf A");
    const second = await newRace("Lauf B");

    await submit(first, registration());
    await submit(first, registration({ participants: [anna, ben] }));

    expect(await numberOf(await submit(second, registration()))).toBe(1);
    expect(await numberOf(await submit(second, registration({ participants: [ben, anna] })))).toBe(1001);
  });

  it("counts stored Registrations on the admin Race list", async () => {
    const busy = await newRace("Voller Lauf", "2026-12-10");
    const quiet = await newRace("Ruhiger Lauf", "2026-12-09");
    await submit(busy, registration());
    await submit(busy, registration({ participants: [ben, anna] }));
    await submit(quiet, registration());

    const html = await (await asAdmin("/admin")).text();
    expect(html).toMatch(/Voller Lauf[\s\S]*2 Anmeldungen[\s\S]*Ruhiger Lauf[\s\S]*1 Anmeldung\b/);
  });
});

describe("repeating a submit", () => {
  it("returns the same Registration number for a repeated attempt ID and stores nothing new", async () => {
    const race = await newRace("Stundenlauf");
    const body = registration();

    const first = await submit(race, body);
    const repeat = await submit(race, body);
    const fresh = await submit(race, registration());

    expect(await first.json()).toEqual({ number: 1 });
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toEqual({ number: 1 });
    expect(await fresh.json()).toEqual({ number: 2 });
    expect(await (await asAdmin("/admin")).text()).toContain("2 Anmeldungen");
  });

  it("gives a double tap (two submits at once) one Registration", async () => {
    const race = await newRace("Stundenlauf");
    const body = registration({ participants: [anna, ben] });

    const responses = await Promise.all([submit(race, body), submit(race, body)]);

    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(await Promise.all(responses.map((r) => r.json()))).toEqual([{ number: 1001 }, { number: 1001 }]);
    expect(await (await asAdmin("/admin")).text()).toContain("1 Anmeldung<");
  });

  it("treats the same attempt ID in another Race as a new Registration", async () => {
    const first = await newRace("Lauf A");
    const second = await newRace("Lauf B");
    const body = registration();
    await submit(first, registration());
    await submit(first, body);

    const res = await submit(second, body);

    expect(await res.json()).toEqual({ number: 1 });
  });
});

describe("validating a submit", () => {
  const long = "x".repeat(101);
  const withAnna = (changes: Record<string, unknown>) => registration({ participants: [{ ...anna, ...changes }] });

  // [what's wrong, request body, path of the reported issue]
  const cases: [string, unknown, string][] = [
    ["not an object", "Anna", ""],
    ["no attempt ID", registration({ attemptId: undefined }), "attemptId"],
    ["a malformed attempt ID", registration({ attemptId: "<script>" }), "attemptId"],
    ["an unknown Duration", registration({ duration: 45 }), "duration"],
    ["consent not ticked", registration({ consent: false }), "consent"],
    ["no Participants", registration({ participants: undefined }), "participants"],
    ["an empty Participant list", registration({ participants: [] }), "participants"],
    ["three Participants", registration({ participants: [anna, ben, clara] }), "participants"],
    ["a Participant that isn't an object", registration({ participants: ["Anna"] }), "participants.0"],
    ["no Gender", withAnna({ gender: undefined }), "participants.0.gender"],
    ["an unknown Gender", withAnna({ gender: "X" }), "participants.0.gender"],
    ["Gender in lowercase export coding", withAnna({ gender: "w" }), "participants.0.gender"],
    ["an unknown Title", withAnna({ title: "prof" }), "participants.0.title"],
    ["the removed Title Frau", withAnna({ title: "frau" }), "participants.0.title"],
    ["the removed Title Kids", withAnna({ title: "kids" }), "participants.0.title"],
    ["no Title", withAnna({ title: undefined }), "participants.0.title"],
    ["an empty first name", withAnna({ firstName: "  " }), "participants.0.firstName"],
    ["a missing last name", withAnna({ lastName: undefined }), "participants.0.lastName"],
    ["an overlong last name", withAnna({ lastName: long }), "participants.0.lastName"],
    ["a three-digit birth year", withAnna({ birthYear: 985 }), "participants.0.birthYear"],
    ["a birth year as text", withAnna({ birthYear: "1985" }), "participants.0.birthYear"],
    ["a fractional birth year", withAnna({ birthYear: 1985.5 }), "participants.0.birthYear"],
    ["a birth year before 1800", withAnna({ birthYear: 1799 }), "participants.0.birthYear"],
    ["a birth year after the Race's year", withAnna({ birthYear: 2027 }), "participants.0.birthYear"],
    ["a club that isn't text", withAnna({ club: 42 }), "participants.0.club"],
    ["an overlong club", withAnna({ club: long }), "participants.0.club"],
    [
      "a bad second Participant",
      registration({ participants: [anna, { ...ben, firstName: "" }] }),
      "participants.1.firstName",
    ],
  ];

  it.each(cases)("rejects %s with a message and stores nothing", async (_, body, path) => {
    const race = await newRace("Stundenlauf");

    const res = await submit(race, body);

    expect(res.status).toBe(400);
    const { issues } = (await res.json()) as { issues: { path: string; message: string }[] };
    expect(issues).toContainEqual({ path, message: expect.stringMatching(/\w{3,}/) });
    expect(await (await submit(race, registration())).json()).toEqual({ number: 1 });
  });

  it("rejects a body that isn't JSON", async () => {
    const race = await newRace("Stundenlauf");

    const res = await request(`${race}/registrations`, { method: "POST", body: "{not json" });

    expect(res.status).toBe(400);
  });

  it("accepts the edges: a birth year in the Race's year, and no or an empty club", async () => {
    const race = await newRace("Stundenlauf");

    const res = await submit(
      race,
      registration({
        participants: [
          { ...ben, birthYear: 2026, club: "   " },
          { ...ben, birthYear: 1800, club: undefined },
        ],
      }),
    );

    expect(res.status).toBe(200);
  });
});

describe("submitting to an unknown Race", () => {
  it("answers 404", async () => {
    const res = await submit("/r/zzzzzzzzzz", registration());

    expect(res.status).toBe(404);
  });
});
