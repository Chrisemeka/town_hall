import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { COUNTRIES, countryName, normalizeSkills } from "@/lib/vocabulary"

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

  it("never asks the runtime, whose ICU data differs between Node and the browser", () => {
    // Chrome names FK "Falkland Islands (Islas Malvinas)" even for a pinned
    // en-US locale. The list is data so both sides render the same string.
    const src = readFileSync("lib/vocabulary.ts", "utf8")
    expect(src).not.toMatch(/new Intl\.(DisplayNames|Collator)/)
    for (const code of COUNTRIES) expect(countryName(code)).not.toBe(code)
  })
})

describe("normalizeSkills", () => {
  it("leaves a canonical list alone", () => {
    expect(normalizeSkills(["Frontend", "QA", "AI/ML"])).toEqual(["Frontend", "QA", "AI/ML"])
  })

  it("rewrites a custom entry to canonical casing when one matches", () => {
    // "frontend" is the same claim as "Frontend" — storing both would put two
    // near-identical tags on the same profile.
    expect(normalizeSkills(["frontend"])).toEqual(["Frontend"])
    expect(normalizeSkills(["ai/ml", "DEVOPS", "nOn-TeChNiCaL uSeR"])).toEqual([
      "AI/ML",
      "DevOps",
      "Non-technical user",
    ])
  })

  it("keeps custom tags exactly as the user cased them", () => {
    expect(normalizeSkills(["Rust", "gRPC", "k8s"])).toEqual(["Rust", "gRPC", "k8s"])
  })

  it("deduplicates case-insensitively, first spelling wins", () => {
    expect(normalizeSkills(["React", "react", "REACT"])).toEqual(["React"])
    expect(normalizeSkills(["QA", "qa"])).toEqual(["QA"])
  })

  it("deduplicates a custom entry against its canonical twin", () => {
    // The pair that would otherwise slip through: one arrives custom, one
    // canonical, and they only collide after canonicalisation.
    expect(normalizeSkills(["frontend", "Frontend"])).toEqual(["Frontend"])
  })

  it("trims and collapses whitespace", () => {
    expect(normalizeSkills(["  Frontend  "])).toEqual(["Frontend"])
    expect(normalizeSkills(["Machine   Learning"])).toEqual(["Machine Learning"])
    expect(normalizeSkills(["  Non-technical    user "])).toEqual(["Non-technical user"])
  })

  it("collapses whitespace before comparing, not after", () => {
    // "Non-technical    user" only matches the canonical entry once its inner
    // run of spaces is squashed.
    expect(normalizeSkills(["Non-technical    user", "Non-technical user"])).toEqual([
      "Non-technical user",
    ])
  })

  it("drops entries that are only whitespace", () => {
    expect(normalizeSkills(["", "   ", "QA"])).toEqual(["QA"])
  })

  it("mixes canonical and custom without disturbing order", () => {
    expect(normalizeSkills(["backend", "Rust", "QA", "rust"])).toEqual(["Backend", "Rust", "QA"])
  })

  it("is idempotent", () => {
    const once = normalizeSkills(["frontend", "  Rust ", "FRONTEND"])
    expect(normalizeSkills(once)).toEqual(once)
  })
})
