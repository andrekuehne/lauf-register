import jsQR from "jsqr";

/**
 * The text of every QR code on a page (an inline SVG of class "qr"), as a QR
 * decoder reads it: each SVG is drawn into a bitmap, module by module, and
 * handed to jsQR.
 */
export function qrTexts(html: string): string[] {
  return [...html.matchAll(/<svg[^>]*class="qr"[^>]*>[\s\S]*?<\/svg>/g)].map((m) => decode(m[0]));
}

const SCALE = 4;

function decode(svg: string): string {
  const size = Number(svg.match(/viewBox="0 0 (\d+) \1"/)?.[1]);
  if (!size) throw new Error(`QR code without a square viewBox: ${svg.slice(0, 120)}`);
  const width = size * SCALE;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  // Dark modules are drawn as runs along a row: M<x> <y>h<length>v1h-<length>z
  for (const [, x, y, length] of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let row = Number(y) * SCALE; row < (Number(y) + 1) * SCALE; row++) {
      for (let col = Number(x) * SCALE; col < (Number(x) + Number(length)) * SCALE; col++) {
        const i = (row * width + col) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      }
    }
  }
  const result = jsQR(pixels, width, width);
  if (!result) throw new Error("QR code could not be read");
  return result.data;
}

/** The full-screen QR layer of a page (hidden until opened), or "" when the page has none. */
export function qrLayer(html: string): string {
  return html.match(/<aside[^>]*id="qr-layer"[\s\S]*?<\/aside>/)?.[0] ?? "";
}
