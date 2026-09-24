import { describe, expect, it } from "vitest"
import { CSV_BOM, cell, neutralise, quote, toCsv } from "@/lib/csv"

/**
 * A deliberately small RFC 4180 reader, so "survives a round trip" means the
 * values come back rather than that the output matches a string I typed.
 * Asserting my own expected output would only prove the writer agrees with
 * itself.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (c === '"') {
        quoted = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"' && field === "") {
      quoted = true
      i++
      continue
    }
    if (c === ",") {
      row.push(field)
      field = ""
      i++
      continue
    }
    if (c === "\r" && text[i + 1] === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i += 2
      continue
    }
    field += c
    i++
  }
  row.push(field)
  rows.push(row)
  return rows
}

describe("neutralise", () => {
  it("defuses every leading character a spreadsheet treats as a formula", () => {
    // The attack: a tester writes this in an issue summary, the builder opens
    // the export, and it runs.
    expect(neutralise('=HYPERLINK("http://evil","click")')).toBe(
      '\'=HYPERLINK("http://evil","click")',
    )
    expect(neutralise("+1")).toBe("'+1")
    expect(neutralise("-5")).toBe("'-5")
    expect(neutralise("@sum(A1)")).toBe("'@sum(A1)")
    // Some readers strip leading whitespace and then parse what follows, so
    // these are the same attack wearing a hat.
    expect(neutralise("\t=cmd")).toBe("'\t=cmd")
    expect(neutralise("\r=cmd")).toBe("'\r=cmd")
  })

  it("leaves ordinary text alone", () => {
    // Only a LEADING character is a formula. Neutralising these would corrupt
    // real content for no gain.
    expect(neutralise("a=b")).toBe("a=b")
    expect(neutralise("5-3")).toBe("5-3")
    expect(neutralise("hello@example")).toBe("hello@example")
    expect(neutralise("")).toBe("")
    expect(neutralise("Checkout button does nothing")).toBe(
      "Checkout button does nothing",
    )
  })
})

describe("quote", () => {
  it("quotes only when it has to", () => {
    expect(quote("plain")).toBe("plain")
    expect(quote("a,b")).toBe('"a,b"')
    expect(quote("line\nbreak")).toBe('"line\nbreak"')
  })

  it("doubles an embedded quote", () => {
    expect(quote('say "hi"')).toBe('"say ""hi"""')
  })
})

describe("cell", () => {
  it("neutralises before quoting, not after", () => {
    // Reversed, the apostrophe lands outside the quotes — '"=cmd" — where the
    // spreadsheet never sees it and the formula runs anyway. The two
    // spellings look near-identical in a diff and one of them does nothing.
    const out = cell('=a,b"c')
    expect(out.startsWith('"\'=')).toBe(true)
    expect(out).toBe('"\'=a,b""c"')
  })

  it("renders an absent value as an empty cell, not as text", () => {
    expect(cell(null)).toBe("")
    expect(cell(undefined)).toBe("")
    expect(cell(NaN)).toBe("")
    // A spreadsheet user should not have to filter out the word "null".
    expect(cell(null)).not.toContain("null")
  })

  it("renders numbers and booleans", () => {
    expect(cell(0)).toBe("0")
    expect(cell(4)).toBe("4")
    expect(cell(false)).toBe("false")
  })
})

describe("toCsv", () => {
  it("writes a header and a row", () => {
    expect(toCsv(["a", "b"], [[1, 2]])).toBe("a,b\r\n1,2")
  })

  it("survives a round trip with commas, quotes and newlines in one field", () => {
    const nasty = 'He said "go", then\nleft'
    const rows = [["Ada Lovelace", nasty, 4]]
    const parsed = parseCsv(toCsv(["Tester", "Comment", "Rating"], rows))

    expect(parsed[0]).toEqual(["Tester", "Comment", "Rating"])
    expect(parsed[1][0]).toBe("Ada Lovelace")
    expect(parsed[1][1]).toBe(nasty)
    expect(parsed[1][2]).toBe("4")
  })

  it("round-trips a neutralised formula as the text it became", () => {
    const parsed = parseCsv(toCsv(["Issue"], [["=1+1"]]))
    // The apostrophe is inside the value, which is what makes the cell inert.
    expect(parsed[1][0]).toBe("'=1+1")
  })

  it("writes a header-only file when there is nothing to export", () => {
    // Still valid CSV, rather than an empty file a spreadsheet refuses.
    expect(toCsv(["a", "b"], [])).toBe("a,b")
  })

  it("separates records with CRLF, which is what Excel wants", () => {
    expect(toCsv(["a"], [["1"], ["2"]])).toBe("a\r\n1\r\n2")
  })
})

describe("the byte-order mark", () => {
  it("is the one Excel needs to read UTF-8", () => {
    // Without it Excel uses the local codepage and mangles Nigerian names and
    // the naira sign.
    expect(CSV_BOM).toBe("﻿")
    expect(CSV_BOM + toCsv(["a"], [["₦1,000"]])).toContain("₦")
  })
})
