import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import RefundsPage from "@/app/(public)/refunds/page"
import TermsPage from "@/app/(public)/terms/page"
import PrivacyPolicyPage from "@/app/(public)/privacy/page"
import { PublicFooter } from "@/components/public/PublicFooter"
import { PlanSection } from "@/components/settings/PlanSection"
import sitemap from "@/app/sitemap"
import { MERCHANT } from "@/lib/merchant"
import { PLANS, priceLine } from "@/lib/plans"
import { planNotice } from "@/lib/subscriptions"
import { PLAN_IDS } from "@/lib/vocabulary"

// The billing policy is a promise a builder can hold us to in a dispute. It
// says only what is true the day it ships (docs/specs/SPEC-billing-policy.md).

// B1, decided 3 Nov 2026: builders pay through a Paystack payment link, so
// Paystack is named on the public pages. If that changes, so does this.
const PAYS_THROUGH_PAYSTACK = true

/** React escapes apostrophes; the copy is compared as written. */
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el).replace(/&#x27;/g, "'")

describe("/refunds", () => {
  const html = render(createElement(RefundsPage))
  const src = readFileSync("app/(public)/refunds/page.tsx", "utf8")

  it("prints every paid plan's price through priceLine()", () => {
    for (const plan of Object.values(PLANS)) if (plan.price) expect(html).toContain(priceLine(plan))
  })

  it("writes no price of its own", () => {
    expect(src).not.toMatch(/₦\s?\d|\$\d/)
  })

  it("names the merchant and the support email", () => {
    expect(html).toContain(MERCHANT.legalName)
    expect(html).toContain(`href="mailto:${MERCHANT.supportEmail}"`)
  })

  it("links Pricing and the Terms", () => {
    expect(html).toContain('href="/pricing"')
    expect(html).toContain('href="/terms"')
  })

  it("offers no transaction that does not exist", () => {
    expect(html).not.toMatch(/subscribe|upgrade/i)
    expect(html).toContain("Your plan doesn't renew by itself.")
    expect(html).toContain("We don't promise a turnaround time.")
  })

  it("names Paystack only per B1", () => {
    expect(html.includes("Paystack")).toBe(PAYS_THROUGH_PAYSTACK)
  })
})

describe("/terms", () => {
  const html = render(createElement(TermsPage))

  it("makes the policy part of the terms", () => {
    expect(html).toContain('href="/refunds"')
  })

  it("no longer says there is no checkout", () => {
    expect(html).not.toMatch(/there is no checkout/i)
  })
})

describe("/privacy", () => {
  const html = render(createElement(PrivacyPolicyPage))

  it("names the NDPC and the billing retention (B7)", () => {
    expect(html).toContain("Nigeria Data Protection Commission")
    expect(html).toContain("We keep billing records for six years")
  })

  it("names where the database is", () => {
    expect(html).toContain("Ireland")
  })

  it("names Paystack only per B1", () => {
    expect(html.includes("Paystack")).toBe(PAYS_THROUGH_PAYSTACK)
  })
})

describe("links to the policy", () => {
  it("the footer links it", () => {
    expect(render(createElement(PublicFooter))).toContain('href="/refunds"')
  })

  it("a paid plan's settings link it, Community's don't, and neither offers a control", () => {
    for (const id of PLAN_IDS) {
      const html = render(createElement(PlanSection, { planId: id }))
      expect(html.includes('href="/refunds"')).toBe(id !== "community")
      expect(html).not.toMatch(/upgrade|subscribe/i)
    }
  })

  it("the sitemap lists it", () => {
    expect(sitemap().map((e: { url: string }) => e.url)).toContain("https://twnhall.com/refunds")
  })

  it("start and extend confirmations end with it; a downgrade's doesn't", () => {
    const site = "https://twnhall.com"
    const line = "Billing, cancelling and refunds: https://twnhall.com/refunds"
    expect(planNotice("start", "starter", { periodEnd: "2026-12-03", site }).body.endsWith(line)).toBe(true)
    expect(planNotice("extend", "pro", { periodEnd: "2026-12-03", site }).body.endsWith(line)).toBe(true)
    expect(planNotice("downgrade", "community", { when: "now", site }).body).not.toContain("/refunds")
  })
})
