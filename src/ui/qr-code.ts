// A Race's QR code, made in the Worker and sent inline with the page (no extra
// request, no outside QR service).

import { encode } from "uqr";

/** Room around the code, in modules: the 4 the QR standard asks for. */
const QUIET_ZONE = 4;

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * The QR code of a Race's public link as an inline SVG, one unit per module:
 * the dark modules as runs along each row in a single path. It scales to
 * whatever size the page gives it.
 */
export function qrCodeSvg(link: string): string {
  // Medium error correction: still scans when the print is a bit smudged or the screen reflects.
  const { size, data } = encode(link, { ecc: "M", border: QUIET_ZONE });
  let path = "";
  data.forEach((row, y) => {
    for (let x = 0; x < size; x++) {
      if (!row[x]) continue;
      const start = x;
      while (x + 1 < size && row[x + 1]) x++;
      const length = x - start + 1;
      path += `M${start} ${y}h${length}v1h-${length}z`;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR-Code: ${escapeAttr(link)}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${path}"/></svg>`
  );
}
