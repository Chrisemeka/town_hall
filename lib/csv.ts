// Writing CSV that a spreadsheet opens safely.
//
// Pure and import-free, like lib/access.ts: this is the part that has to be
// right, and it should be testable without a database or a network.

/**
 * A field beginning with one of these is a FORMULA to Excel and Google
 * Sheets, not text.
 *
 * Every field in a Twnhall export is attacker-supplied: a tester writes the
 * issue summary and the steps to reproduce, and the builder opens the file.
 * `=HYPERLINK("http://evil","click")` in an issue summary becomes a live link
 * in the builder's spreadsheet.
 *
 * Tab and carriage return are here for the same reason — some versions strip
 * leading whitespace and then read what follows as a formula, so `\t=cmd` is
 * the same attack wearing a hat.
 */
const FORMULA_LEADS = ["=", "+", "-", "@", "\t", "\r"]

/**
 * Defuses a formula by prefixing a single quote, which spreadsheets read as
 * "the rest of this is text".
 *
 * ACCEPTED COST, written down so it is not "fixed" later: a legitimate `-5`
 * exports as `'-5`, and so does a phone number written `+2348012345678`.
 * Prefixing is the standard mitigation, and a visible apostrophe is a far
 * smaller problem than a formula that runs. If this ever needs to be smarter,
 * the answer is a numeric check before the prefix, not removing the prefix.
 *
 * Only a LEADING character counts. `a=b` and `5-3` are ordinary text and are
 * left alone — neutralising those would corrupt real content for no gain.
 */
export function neutralise(value: string): string {
  return FORMULA_LEADS.some((lead) => value.startsWith(lead)) ? `'${value}` : value
}

/** RFC 4180: quote when the value contains a quote, comma or line break, and
 *  double any embedded quote. */
export function quote(value: string): string {
  return /["\n\r,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * One cell, ready to write.
 *
 * NEUTRALISE THEN QUOTE, and the order is the whole point. Reversed, the
 * apostrophe lands outside the quotes — `'"=cmd"` — where the spreadsheet
 * never sees it and the formula runs anyway. The two spellings look
 * near-identical in a diff and one of them does nothing.
 */
export function cell(value: unknown): string {
  // null, undefined and NaN become an empty cell rather than the text "null",
  // which is what a spreadsheet user would otherwise have to filter out.
  if (value === null || value === undefined) return ""
  if (typeof value === "number" && !Number.isFinite(value)) return ""
  return quote(neutralise(String(value)))
}

/** RFC 4180 says CRLF between records, and Excel is the fussiest reader. */
const RECORD_SEPARATOR = "\r\n"

/**
 * The byte-order mark.
 *
 * Without it Excel reads the file as the local codepage and mangles anything
 * non-ASCII — which here means Nigerian names and the naira sign. Exported
 * separately from the body so the body stays comparable in a test.
 */
export const CSV_BOM = "﻿"

export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(cell).join(","))
    .join(RECORD_SEPARATOR)
}
