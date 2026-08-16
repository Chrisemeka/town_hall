import { describe, expect, it } from "vitest"
import { countryName } from "@/lib/vocabulary"

describe("countryName", () => {
  // These render inside a <select> on /verify/[role], which means they are
  // server-rendered and then hydrated. If the two runs disagree by so much as
  // one character, React throws a hydration error — which is exactly what
  // happened on FK before the locale was pinned: Node produced "Falkland
  // Islands" and the browser produced "Falkland Islands (Islas Malvinas)".
  //
  // Every region below has a disputed or aliased English name, so they are the
  // ones most likely to move if the locale is ever loosened.
  it.each([
    ["FK", "Falkland Islands"],
    ["MM", "Myanmar (Burma)"],
    ["CI", "Côte d’Ivoire"],
    ["TL", "Timor-Leste"],
    ["MK", "North Macedonia"],
    ["NG", "Nigeria"],
  ])("renders %s identically on any runtime", (code, expected) => {
    expect(countryName(code)).toBe(expected)
  })

  it("pins the locale rather than taking the runtime's", () => {
    // Note the limit of this one: on a machine already running en-US, dropping
    // the locale argument still passes here. The hardcoded strings above are
    // what catch it everywhere else — this asserts the intent directly.
    const pinned = new Intl.DisplayNames(["en-US"], { type: "region" })
    for (const code of ["FK", "MM", "CI", "TL", "MK"]) {
      expect(countryName(code)).toBe(pinned.of(code))
    }
  })
})
