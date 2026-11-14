// Reads a downloaded .xlsx back for assertions: sheet names and the first sheet's cells.
// Also checks the package hangs together (declared parts exist, relationships
// point at real parts), which spreadsheet programs insist on.
// Understands what spreadsheet files commonly hold for plain values: shared or
// inline strings and numbers. Missing cells read as null.

import { strFromU8, unzipSync } from "fflate";

export type Cell = string | number | null;

const unescapeXml = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** "A" → 0, "N" → 13, "AA" → 26 */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)![0];
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

/** The text of an <si> or <is> element (joined <t> runs). */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]!)).join("");

export function readXlsx(bytes: Uint8Array): { sheetNames: string[]; rows: Cell[][] } {
  const files = unzipSync(bytes);
  const file = (path: string) => {
    const content = files[path];
    if (!content) throw new Error(`${path} missing from the .xlsx`);
    return strFromU8(content);
  };
  for (const m of file("[Content_Types].xml").matchAll(/PartName="\/([^"]+)"/g)) file(m[1]!);
  for (const [rels, dir] of [["_rels/.rels", ""], ["xl/_rels/workbook.xml.rels", "xl/"]] as const) {
    for (const m of file(rels).matchAll(/Target="([^"]+)"/g)) file(dir + m[1]!);
  }
  const workbook = file("xl/workbook.xml");
  const sheetNames = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => unescapeXml(m[1]!));
  const shared = files["xl/sharedStrings.xml"]
    ? [...file("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!))
    : [];

  const rows: Cell[][] = [];
  for (const row of file("xl/worksheets/sheet1.xml").matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Cell[] = [];
    for (const cell of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1]!;
      const body = cell[2] ?? "";
      const index = columnIndex(attrs.match(/\br="([A-Z]+\d+)"/)![1]!);
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let parsed: Cell = null;
      if (type === "inlineStr") parsed = textOf(body);
      else if (type === "s" && value !== undefined) parsed = shared[Number(value)]!;
      else if (type === "str" && value !== undefined) parsed = unescapeXml(value);
      else if (value !== undefined) parsed = Number(value);
      while (cells.length < index) cells.push(null);
      cells[index] = parsed;
    }
    rows.push(cells);
  }
  return { sheetNames, rows };
}
