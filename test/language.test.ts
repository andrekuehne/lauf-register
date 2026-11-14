import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const get = (path: string, init?: RequestInit) =>
  exports.default.fetch(`https://example.com${path}`, { redirect: "manual", ...init });

describe("language switch", () => {
  it("serves German by default and offers a switch to English", async () => {
    const html = await (await get("/")).text();

    expect(html).toContain('<html lang="de">');
    expect(html).toMatch(/<a [^>]*href="\/\?lang=en"[^>]*>English<\/a>/);
  });

  it("remembers the chosen language in a cookie and redirects back to the same page", async () => {
    const res = await get("/gibt-es-nicht?lang=en&x=1");

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/gibt-es-nicht?x=1");
    expect(res.headers.get("set-cookie")).toMatch(/^lang=en;.*Path=\//);
  });

  it("serves pages in English when the cookie says so", async () => {
    const home = await (await get("/", { headers: { cookie: "lang=en" } })).text();
    const notFound = await get("/gibt-es-nicht", { headers: { cookie: "lang=en" } });

    expect(home).toContain('<html lang="en">');
    expect(home).toMatch(/<a [^>]*href="\/\?lang=de"[^>]*>Deutsch<\/a>/);
    expect(notFound.status).toBe(404);
    expect(await notFound.text()).toContain("Page not found");
  });

  it("ignores unknown languages", async () => {
    const res = await get("/?lang=xx");

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<html lang="de">');
  });
});
