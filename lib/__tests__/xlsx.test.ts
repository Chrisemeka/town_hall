import { describe, expect, it } from "vitest"
import { crc32, sheetNames, toXlsx, xmlText } from "@/lib/xlsx"

// The zip and XML were also opened with openpyxl when this was written; these
// pin the rules Excel enforces with a repair prompt rather than an error.

describe("sheetNames", () => {
  it("strips the characters Excel forbids", () => {
    expect(sheetNames(["Payment: card / bank [beta]?*\\"])).toEqual(["Payment card bank beta"])
  })

  it("caps at 31 characters", () => {
    const [name] = sheetNames(["A very long mission title that keeps going and going"])
    expect(name.length).toBeLessThanOrEqual(31)
  })

  it("de-duplicates ignoring case, staying within 31", () => {
    const long = "x".repeat(40)
    const names = sheetNames(["Auth flow", "auth FLOW", long, long])
    expect(names[1]).toBe("auth FLOW (2)")
    expect(names[3].endsWith(" (2)")).toBe(true)
    expect(names[3].length).toBeLessThanOrEqual(31)
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length)
  })

  it("never yields an empty, quoted or reserved name", () => {
    expect(sheetNames(["", "'''", "History"])).toEqual(["Mission", "Mission (2)", "Mission (3)"])
  })
})

describe("xmlText", () => {
  it("escapes markup and drops the control characters XML forbids", () => {
    expect(xmlText(`a & <b> "c"\u0000\u000B`)).toBe("a &amp; &lt;b&gt; &quot;c&quot;")
  })

  it("keeps tabs and line breaks, which testers write", () => {
    expect(xmlText("one\ttwo\nthree")).toBe("one\ttwo\nthree")
  })
})

describe("toXlsx", () => {
  it("computes the standard CRC-32", () => {
    // The check value every CRC-32 implementation is tested against.
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926)
  })

  it("writes a formula-looking string as text, never as a formula", () => {
    const xml = new TextDecoder().decode(
      toXlsx([{ name: "S", headers: ["Issue"], rows: [["=HYPERLINK(\"http://evil\")"]] }]),
    )
    expect(xml).toContain('t="inlineStr"')
    expect(xml).not.toContain("<f>")
  })
})
