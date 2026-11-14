// A minimal .xlsx writer: one sheet of plain values (text and numbers), no
// formulas, no macros. Strings go into a shared string table, as Excel itself
// writes them, so importers that only know Excel's own files read them too.

import { strToU8, zipSync } from "fflate";

export type Cell = string | number | null;

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const OFFICE_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml";

/** Escapes text for XML and drops the control characters XML 1.0 can't hold. */
const xmlText = (text: string) =>
  text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 0 → "A", 13 → "N", 26 → "AA" */
function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function sheetXml(rows: Cell[][], stringIndex: (text: string) => number): string {
  const rowXml = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${columnName(c)}${r + 1}`;
      if (value === null || value === "") return "";
      if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="s"><v>${stringIndex(value)}</v></c>`;
    });
    return `<row r="${r + 1}">${cells.join("")}</row>`;
  });
  return `${XML_HEAD}<worksheet xmlns="${MAIN_NS}"><sheetData>${rowXml.join("")}</sheetData></worksheet>`;
}

const STYLES =
  `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}">` +
  '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

/** A workbook with a single sheet holding `rows` (null or "" leaves a cell empty). */
export function xlsxWorkbook(sheetName: string, rows: Cell[][]): Uint8Array<ArrayBuffer> {
  const strings: string[] = [];
  const indexOf = new Map<string, number>();
  const stringIndex = (text: string) => {
    let index = indexOf.get(text);
    if (index === undefined) {
      index = strings.push(text) - 1;
      indexOf.set(text, index);
    }
    return index;
  };
  const sheet = sheetXml(rows, stringIndex);
  const sharedStrings =
    `${XML_HEAD}<sst xmlns="${MAIN_NS}" count="${strings.length}" uniqueCount="${strings.length}">` +
    strings.map((s) => `<si><t xml:space="preserve">${xmlText(s)}</t></si>`).join("") +
    "</sst>";

  const parts: Record<string, string> = {
    "[Content_Types].xml":
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="${OFFICE_TYPE}.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${OFFICE_TYPE}.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="${OFFICE_TYPE}.styles+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="${OFFICE_TYPE}.sharedStrings+xml"/>` +
      `</Types>`,
    "_rels/.rels":
      `${XML_HEAD}<Relationships xmlns="${REL_NS}">` +
      `<Relationship Id="rId1" Type="${DOC_REL}/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    "xl/workbook.xml":
      `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${DOC_REL}">` +
      `<sheets><sheet name="${xmlText(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
      `</workbook>`,
    "xl/_rels/workbook.xml.rels":
      `${XML_HEAD}<Relationships xmlns="${REL_NS}">` +
      `<Relationship Id="rId1" Type="${DOC_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${DOC_REL}/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId3" Type="${DOC_REL}/sharedStrings" Target="sharedStrings.xml"/>` +
      `</Relationships>`,
    "xl/worksheets/sheet1.xml": sheet,
    "xl/styles.xml": STYLES,
    "xl/sharedStrings.xml": sharedStrings,
  };
  const zip = zipSync(Object.fromEntries(Object.entries(parts).map(([path, xml]) => [path, strToU8(xml)])), { level: 6 });
  // A copy backed by a plain ArrayBuffer, as Response bodies are typed.
  return new Uint8Array(zip);
}
