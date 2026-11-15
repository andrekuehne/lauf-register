import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { links, raceCard, registrationToggle } from "./admin-html";
import {
  ADMIN,
  adminRacePath,
  asAdmin,
  newRace,
  ORIGIN,
  postRace,
  publicLinks,
  request,
  setRegistration,
  setRegistrationOnRacePage,
} from "./http";
import { qrLayerOpenedBy, qrLayers, qrTexts } from "./qr";

// Storage is shared by the tests in a file: start each test without Races.
beforeEach(async () => {
  await env.DB.exec("DELETE FROM races");
});

describe("admin area", () => {
  it("rejects requests without a signed-in Admin", async () => {
    const list = await request("/admin");
    const create = await postRace({ name: "Heimlich", date: "2026-12-09" }, {});

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
    expect(await (await asAdmin("/admin")).text()).not.toContain("Heimlich");
  });

  it("lets an Admin create a Race and see it in the list", async () => {
    const res = await postRace({ name: "Stundenlauf 09.12.2026", date: "2026-12-09" });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin");
    const html = await (await asAdmin("/admin")).text();
    expect(html).toContain("Stundenlauf 09.12.2026");
    expect(html).toContain("09.12.2026");
    expect(html).toContain("0 Anmeldungen");
    expect(html).toContain(ADMIN);
  });

  it("refuses a Race without a name or with an invalid date", async () => {
    const noName = await postRace({ name: "   ", date: "2026-12-09" });
    const badDate = await postRace({ name: "Kaputt", date: "2026-02-30" });

    expect(noName.status).toBe(400);
    expect(await noName.text()).toContain("Bitte einen Namen eingeben");
    expect(badDate.status).toBe(400);
    expect(await badDate.text()).toContain("Bitte ein gültiges Datum wählen");
    expect(await publicLinks()).toEqual([]);
  });

  it("gives every Race its own random public link", async () => {
    await postRace({ name: "Lauf A", date: "2026-12-09" });
    await postRace({ name: "Lauf B", date: "2026-12-10" });

    const tokens = (await publicLinks()).map((link) => link.slice("/r/".length));
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
    for (const token of tokens) expect(token).toMatch(/^[a-km-np-z2-9]{10}$/);
    expect(tokens.some((t) => /^\d+$/.test(t))).toBe(false);
  });
});

describe("the Race cards on the admin start page", () => {
  it("offer each Race's Registrations, its public page and its own QR code, without the link written out", async () => {
    const nikolaus = await newRace("Nikolauslauf", "2026-12-09");
    const silvester = await newRace("Silvesterlauf", "2026-12-31");

    const html = await (await asAdmin("/admin")).text();

    for (const [name, link] of [["Nikolauslauf", nikolaus], ["Silvesterlauf", silvester]] as const) {
      const card = raceCard(html, name);
      expect(links(card)).toEqual([
        { text: "Anmeldungen ansehen", href: adminRacePath(link) },
        { text: "Anmeldeseite", href: link },
      ]);
      expect(card).not.toContain(`${ORIGIN}${link}`);
      expect(card).toMatch(/<button[^>]*data-qr-open[^>]*>\s*QR-Code\s*<\/button>/);
      const layer = qrLayerOpenedBy(html, card);
      expect(layer).toContain(name);
      expect(qrTexts(layer)).toEqual([`${ORIGIN}${link}`]);
    }
    expect(qrLayers(html)).toHaveLength(2);
  });
});

describe("opening and closing Registration", () => {
  it("starts a new Race closed and lets an Admin open and close it again", async () => {
    const link = await newRace("Stundenlauf", "2026-12-09", { open: false });
    const closedCard = raceCard(await (await asAdmin("/admin")).text(), "Stundenlauf");

    const opened = await setRegistration(link, true);
    const openCard = raceCard(await (await asAdmin("/admin")).text(), "Stundenlauf");
    const closed = await setRegistration(link, false);
    const closedAgainCard = raceCard(await (await asAdmin("/admin")).text(), "Stundenlauf");

    expect(registrationToggle(closedCard)).toEqual({
      state: "✓ Geschlossen",
      offer: {
        text: "Offen",
        open: "1",
        confirm: "Anmeldung für ‚Stundenlauf‘ öffnen? Teilnehmende können sich dann über den Link anmelden.",
      },
    });
    expect(opened.status).toBe(303);
    expect(opened.headers.get("location")).toBe("/admin");
    expect(registrationToggle(openCard)).toEqual({
      state: "✓ Offen",
      offer: {
        text: "Geschlossen",
        open: "0",
        confirm: "Anmeldung für ‚Stundenlauf‘ schließen? Neue Anmeldungen gehen dann nur noch am Anmeldetisch.",
      },
    });
    expect(closed.status).toBe(303);
    expect(registrationToggle(closedAgainCard)?.state).toBe("✓ Geschlossen");
  });

  it("shows each Race's own state in the list", async () => {
    await newRace("Offener Lauf", "2026-12-10");
    await newRace("Geschlossener Lauf", "2026-12-09", { open: false });

    const html = await (await asAdmin("/admin")).text();

    expect(registrationToggle(raceCard(html, "Offener Lauf"))?.state).toBe("✓ Offen");
    expect(registrationToggle(raceCard(html, "Geschlossener Lauf"))?.state).toBe("✓ Geschlossen");
  });

  it("offers the same toggle on the Race's own page, and returns there after toggling", async () => {
    const link = await newRace("Stundenlauf", "2026-12-09", { open: false });
    const closedPage = await (await asAdmin(adminRacePath(link))).text();

    const opened = await setRegistrationOnRacePage(link, true);
    const openPage = await (await asAdmin(adminRacePath(link))).text();

    expect(registrationToggle(closedPage)?.state).toBe("✓ Geschlossen");
    expect(opened.status).toBe(303);
    expect(opened.headers.get("location")).toBe(adminRacePath(link));
    expect(registrationToggle(openPage)?.state).toBe("✓ Offen");
    expect(await (await request(link)).text()).toContain('id="flow"');
  });

  it("refuses to open or close without a signed-in Admin, for an unknown Race, or with a bad value", async () => {
    const link = await newRace("Stundenlauf", "2026-12-09", { open: false });

    const anonymous = await setRegistration(link, true, {});
    const unknown = await setRegistration("/r/zzzzzzzzzz", true);
    const badValue = await setRegistration(link, "ja");

    expect(anonymous.status).toBe(403);
    expect(unknown.status).toBe(404);
    expect(badValue.status).toBe(400);
    expect(registrationToggle(raceCard(await (await asAdmin("/admin")).text(), "Stundenlauf"))?.state).toBe("✓ Geschlossen");
  });
});

describe("public Race link", () => {
  it("shows the Race's name, date and registration form while Registration is open", async () => {
    const link = await newRace("Stundenlauf 09.12.2026", "2026-12-09");

    const res = await request(link);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Stundenlauf 09.12.2026");
    expect(html).toContain("Mittwoch, 9. Dezember 2026");
    expect(html).toContain('id="flow"');
  });

  it("shows the closed page instead of the form while Registration is closed", async () => {
    const link = await newRace("Stundenlauf 09.12.2026", "2026-12-09", { open: false });

    const res = await request(link);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Stundenlauf 09.12.2026");
    expect(html).toContain("Anmeldung geschlossen");
    expect(html).toContain("Anmeldetisch");
    expect(html).not.toContain('id="flow"');
  });

  it("shows the registration form again after reopening", async () => {
    const link = await newRace("Stundenlauf", "2026-12-09");
    await setRegistration(link, false);
    await setRegistration(link, true);

    expect(await (await request(link)).text()).toContain('id="flow"');
  });

  it("shows a friendly German not-found page for an unknown token", async () => {
    const res = await request("/r/zzzzzzzz");

    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Lauf nicht gefunden");
  });
});
