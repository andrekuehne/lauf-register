import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("placeholder page", () => {
  it("serves a German HTML page at the root", async () => {
    const res = await exports.default.fetch("https://example.com/");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    const html = await res.text();
    expect(html).toContain('<html lang="de">');
    expect(html).toContain("Lauf-Register");
  });

  it("renders in standards mode with intact inline styles", async () => {
    const html = await (await exports.default.fetch("https://example.com/")).text();

    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    const style = html.match(/<style>([^<]*)<\/style>/)?.[1] ?? "";
    expect(style).toContain("font");
    expect(style).not.toMatch(/&(quot|amp|lt|gt|#\d+);/);
  });

  it("answers unknown paths with a German 404 page", async () => {
    const res = await exports.default.fetch("https://example.com/gibt-es-nicht");

    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Seite nicht gefunden");
  });
});
