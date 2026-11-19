import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const get = (path: string, init?: RequestInit) => exports.default.fetch(`https://example.com${path}`, init);

describe("privacy notice", () => {
  it("names the club as responsible, its data protection officer, the legal bases and the 30 days, in German", async () => {
    const res = await get("/datenschutz");

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<html lang="de">');
    expect(html).toContain("Hochschulsportgemeinschaft Universität Greifswald e.V.");
    expect(html).toContain("Datenschutzbeauftragter");
    expect(html).toContain("datenschutzbeauftragter@asd-seifert.de");
    expect(html).toContain("Art. 6 Abs. 1 lit. b DSGVO");
    expect(html).toContain("spätestens 30 Tage nach dem Lauf");
    expect(html).not.toContain("Einverst");
  });

  it("is in English when the language cookie says so", async () => {
    const html = await (await get("/datenschutz", { headers: { cookie: "lang=en" } })).text();

    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Privacy notice for registration");
    expect(html).toContain("Art. 6(1)(b) GDPR");
  });

  it("is linked, with the club's Impressum, at the bottom of every public page", async () => {
    const html = await (await get("/")).text();

    expect(html).toMatch(/<footer class="legal-links"><a href="\/datenschutz">Datenschutz<\/a> · <a href="https:\/\/www\.tri-hgwaii\.de\/[^"]*impressum\/">Impressum<\/a><\/footer>/);
  });
});
