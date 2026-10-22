import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import PricingPage from "@/app/(public)/pricing/page"
import { PlanSection } from "@/components/settings/PlanSection"
import { PLANS } from "@/lib/plans"
import { PLAN_IDS } from "@/lib/vocabulary"

// The prices a Nigerian founder reads are lib/plans.ts's, character for
// character. A page that computes one from a rate drifts every time it moves.

describe("/pricing", () => {
  const html = renderToStaticMarkup(createElement(PricingPage))

  it("renders all three tiers, cheapest first", () => {
    const at = PLAN_IDS.map((id) => html.indexOf(`>${PLANS[id].name}</h3>`))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it("prints both figures exactly as lib/plans.ts writes them", () => {
    for (const plan of Object.values(PLANS)) {
      if (!plan.price) continue
      expect(html).toContain(plan.price.naira)
      expect(html).toContain(plan.price.dollars)
    }
  })

  it("writes no price of its own", () => {
    const src = readFileSync("app/(public)/pricing/page.tsx", "utf8")
    expect(src).not.toMatch(/₦\s?\d|\$\d/)
  })

  it("calls no tier the best value — both cost the same per report (§7.3)", () => {
    expect(html).not.toMatch(/best value|most popular|recommended/i)
  })
})

describe("PlanSection", () => {
  it.each(PLAN_IDS)("names %s as the account's plan and describes the other two", (id) => {
    const html = renderToStaticMarkup(createElement(PlanSection, { planId: id }))
    const yours = html.indexOf("Your plan")
    expect(yours).toBeGreaterThan(-1)
    // The plan you are on comes first, before either of the others.
    expect(html.indexOf(PLANS[id].name)).toBeLessThan(yours)
    for (const other of PLAN_IDS.filter((p) => p !== id)) {
      expect(html.indexOf(`>${PLANS[other].name}</h3>`)).toBeGreaterThan(yours)
    }
  })
})
