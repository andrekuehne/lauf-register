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

/** The full-screen QR layers of a page (hidden until opened). */
export function qrLayers(html: string): string[] {
  return [...html.matchAll(/<aside[^>]*class="qr-layer"[\s\S]*?<\/aside>/g)].map((m) => m[0]);
}

/** The page's only QR layer, or "" when it has none. */
export function qrLayer(html: string): string {
  const layers = qrLayers(html);
  if (layers.length > 1) throw new Error(`Expected at most one QR layer, found ${layers.length}`);
  return layers[0] ?? "";
}

/** The QR layer that the QR button in `part` (e.g. a Race's card) opens, or "" when there is none. */
export function qrLayerOpenedBy(html: string, part: string): string {
  const id = part.match(/<button[^>]*data-qr-open="([^"]+)"/)?.[1];
  return (id && qrLayers(html).find((layer) => layer.includes(`id="${id}"`))) || "";
}
