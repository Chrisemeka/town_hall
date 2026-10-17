import { describe, expect, it } from "vitest"
import { NAV, activeNavHref, navCurrent, navIsActive } from "@/lib/appNav"
import type { AccountType } from "@/lib/access"

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
  it("matches the href and what sits under it, segment-wise", () => {
    expect(navIsActive("/dashboard", "/dashboard")).toBe(true)
    expect(navIsActive("/dashboard/missions", "/dashboard")).toBe(true)
    expect(navIsActive("/explore/missions/x", "/explore/missions")).toBe(true)
    expect(navIsActive("/settings", "/settings")).toBe(true)
  })

  it("never matches a longer word", () => {
    expect(navIsActive("/dashboardx", "/dashboard")).toBe(false)
    expect(navIsActive("/dashboard/abc123", "/dashboard/missions")).toBe(false)
  })
})

describe("activeNavHref", () => {
  // Every page.tsx under (developer) and (tester), params filled with p1/m1.
  const ROUTES: [string, AccountType, string | null][] = [
    ["/dashboard", "builder", "/dashboard"],
    ["/dashboard/new", "builder", "/dashboard"],
    ["/dashboard/p1", "builder", "/dashboard"],
    ["/dashboard/p1/edit", "builder", "/dashboard"],
    ["/dashboard/p1/mission/new", "builder", "/dashboard"],
    ["/dashboard/p1/mission/m1", "builder", "/dashboard"],
    ["/dashboard/p1/mission/m1/edit", "builder", "/dashboard"],
    ["/dashboard/missions", "builder", "/dashboard/missions"],
    ["/dashboard/feedback", "builder", "/dashboard/feedback"],
    ["/settings", "builder", null],
    ["/settings", "tester", null],
    ["/tester", "tester", "/tester"],
    ["/explore", "tester", "/explore"],
    ["/explore/missions", "tester", "/explore/missions"],
    ["/explore/project/p1", "tester", "/explore"],
    // Outside the nav's tree: follows the page's breadcrumb, Explore › … .
    ["/mission/m1", "tester", "/explore"],
    ["/dashboardx", "builder", null],
    ["/missionx", "tester", null],
    // A builder href never lights for a tester, nor the reverse.
    ["/dashboard", "tester", null],
    ["/explore", "builder", null],
  ]

  it.each(ROUTES)("%s (%s) → %s", (pathname, account, expected) => {
    expect(activeNavHref(pathname, account)).toBe(expected)
  })

  it.each(ROUTES)("%s (%s) lights at most one link", (pathname, account) => {
    const lit = NAV[account].links.filter((l) => l.href === activeNavHref(pathname, account))
    expect(lit.length).toBeLessThanOrEqual(1)
  })
})

describe("navCurrent", () => {
  it("is page on the destination and true on a page it owns", () => {
    expect(navCurrent("/dashboard", "/dashboard")).toBe("page")
    expect(navCurrent("/dashboard/new", "/dashboard")).toBe("true")
    expect(navCurrent("/mission/m1", "/explore")).toBe("true")
  })
})
