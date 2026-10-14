import { describe, expect, it } from "vitest"
import { NAV, navIsActive } from "@/lib/appNav"

describe("NAV", () => {
  it("gives every account three destinations, each with a short label that fits a bar cell", () => {
    for (const { links } of Object.values(NAV)) {
      expect(links).toHaveLength(3)
      for (const l of links) expect(l.short.length, l.short).toBeLessThanOrEqual(9)
    }
  })

  it("never shows a builder a tester destination, or the reverse", () => {
    const builder = new Set(NAV.builder.links.map((l) => l.href))
    for (const l of NAV.tester.links) expect(builder.has(l.href), l.href).toBe(false)
  })
})

describe("navIsActive", () => {
  it("matches a parent destination exactly", () => {
    expect(navIsActive("/dashboard", "/dashboard")).toBe(true)
    expect(navIsActive("/dashboard/missions", "/dashboard")).toBe(false)
    expect(navIsActive("/explore/missions", "/explore")).toBe(false)
  })

  it("matches a leaf destination and what sits under it", () => {
    expect(navIsActive("/explore/missions/x", "/explore/missions")).toBe(true)
    expect(navIsActive("/dashboard/abc123", "/dashboard/missions")).toBe(false)
  })
})
