import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/actions/billing", () => ({
  startSubscription: () => undefined,
  cancelSubscription: () => undefined,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }))
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import PricingPage from "@/app/(public)/pricing/page"
import { PlanSection } from "@/components/settings/PlanSection"
import { PLANS } from "@/lib/plans"
import { PLAN_IDS, type PlanId } from "@/lib/vocabulary"
import type { PlanBilling } from "@/lib/subscriptions"

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

  it("says undelivered reports come back as carried reports", () => {
    const answer = html.slice(html.indexOf("Do unused monthly reports roll over?"))
    expect(answer).toMatch(/come back as carried reports, which don(&#x27;|')t expire/)
  })

  it("answers cancelling and refunds with a link to the policy", () => {
    const answer = html.slice(html.indexOf("Can I cancel, or get a refund?"))
    expect(answer).toContain('href="/refunds"')
  })

  it("calls no tier the best value — both cost the same per report (§7.3)", () => {
    expect(html).not.toMatch(/best value|most popular|recommended/i)
  })
})

describe("the paid calls to action", () => {
  const html = renderToStaticMarkup(createElement(PricingPage))

  it("go to Settings → Plan, and the page says it renews", () => {
    expect(html).toContain("Get Starter")
    expect(html).toContain("Get Pro")
    expect(html.match(/href="\/settings\?tab=plan"/g)).toHaveLength(2)
    expect(html).toContain("It renews every month until you cancel.")
    expect(html).toMatch(/cancel any time in Settings → Plan/)
  })

  it("no longer says there is no checkout, or that plans don't renew", () => {
    expect(html).not.toMatch(/no checkout|payment link|renew by itself/i)
  })

  it("describes the offer, never an account", () => {
    expect(html).not.toMatch(/you(&#x27;|')re on|your plan renews on|reports used/i)
  })
})

const BILLING: PlanBilling = { kind: "none", periodEnd: null, amountNgn: null, cardLast4: null, configured: true, testMode: false }
const NOW = new Date("2026-11-04T10:00:00Z")
const section = (planId: PlanId, over: Partial<PlanBilling> = {}, notice?: string) =>
  renderToStaticMarkup(createElement(PlanSection, { planId, billing: { ...BILLING, ...over }, now: NOW, notice })).replace(/&#x27;/g, "'")

describe("PlanSection, each state renders its controls and no others", () => {
  const END = "2026-12-04T00:00:00Z"

  it("Community can subscribe to both, and shows no renewal date", () => {
    const html = section("community")
    expect(html).toContain("Subscribe — ₦15,000")
    expect(html).toContain("Subscribe — ₦30,000")
    expect(html).not.toContain("Cancel plan")
    expect(html).not.toMatch(/renews on/)
  })

  it("the sheet states the amount, that it repeats, until when, and how to stop", () => {
    const html = section("community")
    expect(html).toContain("You pay ₦15,000 today, then ₦15,000 on the 4th of every month until you cancel.")
    expect(html).toContain("Cancel any time in Settings → Plan")
    expect(html).toContain("Payment is by card, through Paystack.")
    expect(html).toContain("Continue to payment")
  })

  it("shows no subscribe control until Paystack is configured", () => {
    const html = section("community", { configured: false })
    expect(html).not.toMatch(/subscribe|continue to payment/i)
    expect(html).toContain("Get in touch")
  })

  it("a manual plan says when it ends and has no controls", () => {
    const html = section("starter", { kind: "manual", periodEnd: END })
    expect(html).toContain("arranged directly, ends on 4 Dec 2026")
    expect(html).not.toMatch(/Subscribe —|Cancel plan|Pay now/)
  })

  it("a renewing plan shows the date, amount and card, and Cancel", () => {
    const html = section("starter", { kind: "renewing", periodEnd: END, amountNgn: 15000, cardLast4: "4081" })
    expect(html).toContain("renews on 4 Dec 2026")
    expect(html).toContain("₦15,000")
    expect(html).toContain("card ending 4081")
    expect(html).toContain("Cancel plan")
    expect(html).not.toMatch(/Subscribe —|Pay now/)
  })

  it("a cancelled plan says until when, with no controls", () => {
    const html = section("pro", { kind: "cancelled", periodEnd: END })
    expect(html).toContain("Pro until 4 Dec 2026. You won't be charged again.")
    expect(html).not.toMatch(/Subscribe —|Cancel plan|Pay now/)
  })

  it("a failed payment shows the deadline and Pay now", () => {
    const html = section("starter", { kind: "attention", periodEnd: END })
    expect(html).toContain("Pay by 7 Dec 2026 to keep Starter.")
    expect(html).toContain("Pay now")
    expect(html).not.toContain("Subscribe —")
  })

  it("shows the test-mode tag only in test mode", () => {
    expect(section("community", { testMode: true })).toContain("Test mode — no real money moves")
    expect(section("community")).not.toContain("Test mode")
  })

  it("says what happened on the way back from Paystack, and nothing for an unknown value", () => {
    expect(section("community", {}, "pending")).toContain("We're confirming your payment")
    expect(section("community", {}, "not_completed")).toContain("No payment was taken.")
    expect(section("community", {}, "<script>")).not.toContain("<script>")
  })

  it("never shows a meter or calls a tier best value", () => {
    for (const planId of PLAN_IDS) expect(section(planId)).not.toMatch(/reports used|of \d+ used|best value/i)
  })
})

describe("PlanSection", () => {
  it.each(PLAN_IDS)("names %s as the account's plan and describes the other two", (id) => {
    const html = section(id)
    const yours = html.indexOf("Your plan")
    expect(yours).toBeGreaterThan(-1)
    // The plan you are on comes first, before either of the others.
    expect(html.indexOf(PLANS[id].name)).toBeLessThan(yours)
    for (const other of PLAN_IDS.filter((p) => p !== id)) {
      expect(html.indexOf(`>${PLANS[other].name}</h3>`)).toBeGreaterThan(yours)
    }
  })
})
