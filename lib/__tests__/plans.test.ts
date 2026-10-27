import { describe, expect, it } from "vitest"
import { PLANS, SIGNUP_GRANT, otherPlans, planFor, priceLine } from "@/lib/plans"

// /pricing and /settings both read these, so the numbers are asserted once
// here. The copy lines are held to the numeric fields beside them: a string
// saying "20" next to a field saying 10 is exactly the drift this file exists
// to stop.

describe("the tiers", () => {
  it("carries the compensation model's numbers", () => {
    expect(PLANS.pro).toMatchObject({ monthlyReports: 10, testersPerMission: 5, activeMissions: 5 })
    expect(PLANS.starter).toMatchObject({ monthlyReports: 5, testersPerMission: 5, activeMissions: 3 })
    expect(PLANS.community).toMatchObject({ monthlyReports: 0, testersPerMission: 5, activeMissions: 2 })
    expect(SIGNUP_GRANT).toBe(3)
    // Written by hand, naira first. Compensation doc §7.1, ₦1,350 = $1.
    expect(PLANS.pro.price).toEqual({ naira: "₦30,000", dollars: "~$22" })
    expect(PLANS.starter.price).toEqual({ naira: "₦15,000", dollars: "~$11" })
    expect(PLANS.community.price).toBeNull()
  })

  it("states each number in its copy", () => {
    expect(PLANS.pro.includes).toContain(`${PLANS.pro.monthlyReports} tester reports a month`)
    expect(PLANS.starter.includes).toContain(`${PLANS.starter.monthlyReports} tester reports a month`)
    expect(PLANS.community.includes).toContain(`${SIGNUP_GRANT} tester reports to get you started`)
    for (const plan of Object.values(PLANS)) {
      expect(plan.includes).toContain(`Up to ${plan.testersPerMission} testers on a test case`)
      expect(plan.includes).toContain(`${plan.activeMissions} active test cases at once`)
    }
  })

  it("gives Community no monthly line", () => {
    expect(PLANS.community.includes.some((l) => /a month/.test(l) && /report/.test(l))).toBe(false)
  })

  it("lists nothing that does not exist", () => {
    for (const plan of Object.values(PLANS)) {
      for (const line of plan.includes) {
        expect(line).not.toMatch(/priority|queue|shareable/i)
      }
    }
  })

  it("prints the naira figure first, the dollar beside it", () => {
    expect(priceLine(PLANS.pro)).toBe("₦30,000 / month · ~$22")
    expect(priceLine(PLANS.community)).toBe("Free")
  })

  it("prices every report the same on both paid tiers — no volume discount (§7.3)", () => {
    const perReport = (p: typeof PLANS.pro) =>
      Number((p.price?.naira ?? "").replace(/\D/g, "")) / p.monthlyReports
    expect(perReport(PLANS.starter)).toBe(perReport(PLANS.pro))
  })

  it("resolves a plan and the other two, cheapest first", () => {
    expect(planFor("starter").id).toBe("starter")
    expect(otherPlans("pro").map((p) => p.id)).toEqual(["community", "starter"])
    expect(otherPlans("starter").map((p) => p.id)).toEqual(["community", "pro"])
    expect(otherPlans("community").map((p) => p.id)).toEqual(["starter", "pro"])
  })
})
