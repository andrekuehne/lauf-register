import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { adminRacePath, asAdmin, newRace, ORIGIN, posterPath, request } from "./http";
import { qrLayer, qrTexts } from "./qr";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

describe("the A4 poster", () => {
  it("shows the Race's name and date, “Hier anmelden”, its public link written out and as a QR code", async () => {
    const race = await newRace("Nikolauslauf", "2026-12-09");

    const res = await asAdmin(posterPath(race));

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Nikolauslauf");
    expect(html).toContain("9. Dezember 2026");
    expect(html).toContain("Hier anmelden");
    expect(html).toContain(`${ORIGIN}${race}`);
    expect(qrTexts(html)).toEqual([`${ORIGIN}${race}`]);
  });

  it("is only for signed-in Admins, and answers 404 for an unknown Race", async () => {
    const race = await newRace("Nikolauslauf");

    expect((await request(posterPath(race))).status).toBe(403);
    expect((await asAdmin(posterPath("/r/unbekannt"))).status).toBe(404);
  });
});

describe("the Race's admin page", () => {
  it("links to the poster and offers the QR layer with the Race's public link", async () => {
    const race = await newRace("Nikolauslauf");

    const html = await (await asAdmin(adminRacePath(race))).text();

    expect(html).toContain(`href="${posterPath(race)}"`);
    expect(html).toContain("QR-Code zeigen");
    expect(qrLayer(html)).toContain(`${ORIGIN}${race}`);
    expect(qrTexts(qrLayer(html))).toEqual([`${ORIGIN}${race}`]);
  });
});

/** The part of the registration page for one step of the flow. */
function step(html: string, name: string): string {
  return html.match(new RegExp(`<section data-step="${name}"[\\s\\S]*?</section>`))?.[0] ?? "";
}

describe("the public registration page", () => {
  it("carries the QR layer with the Race's public link written out and as a QR code", async () => {
    const race = await newRace("Nikolauslauf");

    const html = await (await request(race)).text();

    expect(qrLayer(html)).toContain(`${ORIGIN}${race}`);
    expect(qrLayer(html)).toContain("Link teilen");
    expect(qrLayer(html)).toContain("Schließen");
    expect(qrTexts(qrLayer(html))).toEqual([`${ORIGIN}${race}`]);
  });

  it("offers “QR-Code zeigen” on step 1 and the Done screen only", async () => {
    const race = await newRace("Nikolauslauf");

    const html = await (await request(race)).text();

    const withButton = ["duration", "single-or-pair", "division", "details", "details-2", "check", "done"].filter((name) =>
      step(html, name).includes("data-qr-open"),
    );
    expect(withButton).toEqual(["duration", "done"]);
    expect(html.match(/<button[^>]*data-qr-open/g)).toHaveLength(2);
    expect(step(html, "done").indexOf("QR-Code zeigen")).toBeGreaterThan(step(html, "done").indexOf("Weitere Person anmelden"));
  });

  it("speaks English on the English page", async () => {
    const race = await newRace("Nikolauslauf");

    const html = await (await request(race, { headers: { cookie: "lang=en" } })).text();

    expect(step(html, "duration")).toContain("Show QR code");
    expect(qrLayer(html)).toContain("Share link");
    expect(qrLayer(html)).toContain("Close");
    expect(qrTexts(qrLayer(html))).toEqual([`${ORIGIN}${race}`]);
  });
});
