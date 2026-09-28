import { describe, expect, it } from "vitest"
import { phoneErrorFor, phoneExampleFor, phoneHintFor } from "@/lib/phoneExample"

describe("phoneHintFor", () => {
  it("shows the selected country's example", () => {
    expect(phoneHintFor("BW")).toMatch(/\+267/)
    expect(phoneHintFor("NG")).toMatch(/\+234/)
  })

  it("falls back to the generic hint without throwing where there is no metadata", () => {
    for (const country of ["BV", "HM", "AQ", ""]) {
      expect(phoneExampleFor(country)).toBeNull()
      expect(phoneHintFor(country)).toBe("Include your country code.")
    }
  })
})

describe("phoneErrorFor", () => {
  it("keeps the example visible when an error replaces the helper", () => {
    expect(phoneErrorFor(["Bad number."], "BW")?.[0]).toMatch(/^Bad number\. A Botswana number looks like \+267/)
  })

  it("passes through when there is no error or no example", () => {
    expect(phoneErrorFor(undefined, "BW")).toBeUndefined()
    expect(phoneErrorFor(["Bad number."], "BV")).toEqual(["Bad number."])
  })
})
