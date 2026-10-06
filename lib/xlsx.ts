// A minimal .xlsx writer: one workbook, several sheets, strings and numbers.
//
// Pure and import-free, like lib/csv.ts. An .xlsx is a zip of a few XML files;
// this writes the zip uncompressed ("stored"), which every reader accepts, so
// no compression library is needed and nothing is added to the bundle.
//
// ponytail: no styles, widths, dates or formulas — the export needs none. If it
// ever does, that is the point to take a library (exceljs) rather than grow this.

export type Cell = string | number | null | undefined
export type Sheet = { name: string; headers: readonly string[]; rows: readonly Cell[][] }

/* ── sheet names ─────────────────────────────────────────────────────── */

/**
 * Excel refuses a workbook whose sheet names break its rules, and "refuses"
 * means a repair prompt that drops the sheet: at most 31 characters, none of
 * [ ] : * ? / \, no leading or trailing apostrophe, not empty, not "History",
 * and unique ignoring case. Mission titles break all of these freely.
 */
export function sheetNames(titles: readonly string[]): string[] {
  const used = new Set<string>()
  return titles.map((title) => {
    let base = title.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim()
    base = base.replace(/^'+|'+$/g, "").trim()
    if (!base || base.toLowerCase() === "history") base = "Mission"
    base = base.slice(0, 31).trim()

    let name = base
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const suffix = ` (${n})`
      name = base.slice(0, 31 - suffix.length).trim() + suffix
    }
    used.add(name.toLowerCase())
    return name
  })
}

/* ── XML ─────────────────────────────────────────────────────────────── */

/**
 * Escapes for XML, and drops the control characters XML 1.0 forbids. A tester
 * can paste a \u0000 or \u000B into a step; left in, the file opens as corrupt.
 */
export function xmlText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 0 → A, 25 → Z, 26 → AA. */
function column(i: number): string {
  let s = ""
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  }
  return s
}

/**
 * A string is always written as an inline string, never a formula, so a
 * tester's "=HYPERLINK(...)" is text in Excel without the CSV's apostrophe
 * prefix (lib/csv.ts neutralise) — which here would show as a literal "'".
 */
function cellXml(value: Cell, ref: string): string {
  if (value === null || value === undefined || value === "") return ""
  if (typeof value === "number") {
    return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : ""
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`
}

function sheetXml(sheet: Sheet): string {
  const rows = [sheet.headers as readonly Cell[], ...sheet.rows].map(
    (row, r) =>
      `<row r="${r + 1}">${row.map((v, c) => cellXml(v, `${column(c)}${r + 1}`)).join("")}</row>`,
  )
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    // Freeze the header row, so it stays put while a long sheet scrolls.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetData>${rows.join("")}</sheetData></worksheet>`
  )
}

/* ── zip (stored) ────────────────────────────────────────────────────── */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const size = f.data.length

    // Local file header, 30 bytes + name. Method 0 (stored), flag 0x0800
    // (UTF-8 names), DOS date 1980-01-01 — a fixed date keeps output stable.
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, 0, true)
    lv.setUint16(12, 0x21, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)
    local.set(name, 30)

    // Central directory entry, 46 bytes + name.
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)

    locals.push(local, f.data)
    centrals.push(central)
    offset += local.length + size
  }

  const cdSize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)

  const out = new Uint8Array(offset + cdSize + end.length)
  let at = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/* ── workbook ────────────────────────────────────────────────────────── */

/** Sheet names are taken as given — pass them through sheetNames() first. */
export function toXlsx(sheets: readonly Sheet[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder()
  const NS = "http://schemas.openxmlformats.org"
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`

  const files = [
    {
      name: "[Content_Types].xml",
      text:
        `${xml}<Types xmlns="${NS}/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join("") +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      text:
        `${xml}<Relationships xmlns="${NS}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text:
        `${xml}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets>` +
        sheets
          .map((s, i) => `<sheet name="${xmlText(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join("") +
        `</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text:
        `${xml}<Relationships xmlns="${NS}/package/2006/relationships">` +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `</Relationships>`,
    },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(s) })),
  ]

  return zip(files.map((f) => ({ name: f.name, data: enc.encode(f.text) })))
}
