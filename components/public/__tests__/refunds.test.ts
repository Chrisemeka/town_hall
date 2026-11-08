import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/actions/billing", () => ({
  startSubscription: () => undefined,
  cancelSubscription: () => undefined,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }))
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
import { planNotice, type PlanBilling } from "@/lib/subscriptions"

// The billing policy is a promise a builder can hold us to in a dispute. It
// says only what is true the day it ships (docs/specs/SPEC-billing-policy.md).

// Decided 4 Nov 2026: builders pay through a Paystack subscription, so Paystack
// is named on the public pages. If that changes, so does this.
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

  it("says the plan renews and where to stop it (MSA, Section B)", () => {
    expect(html).toContain("Your plan renews every month until you cancel.")
    expect(html).toContain("Cancel any time in Settings → Plan.")
    expect(html).toContain("you won't be charged again")
    expect(html).not.toContain("doesn't renew by itself")
    expect(html).not.toMatch(/payment link/i)
    expect(html).toContain("We don't promise a turnaround time.")
  })

  it("states the grace and the charge date", () => {
    expect(html).toContain("your plan stays for 3 more days")
    expect(html).toContain("the 28th if you subscribe on the 29th–31st")
  })

  it("still promises a refund for a charge after cancelling (B4)", () => {
    expect(html).toContain("charged after you cancelled")
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

  it("authorises the recurring charge and says how to stop it", () => {
    expect(html).toContain("Paid plans are subscriptions that renew monthly")
    expect(html).toContain("You can cancel at any time in Settings")
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

  it("names what a subscription keeps, and what it never sees", () => {
    expect(html).toContain("your card's last four digits and brand")
    expect(html).toContain("we never see or store your card number or security code")
  })
})

describe("links to the policy", () => {
  it("the footer links it", () => {
    expect(render(createElement(PublicFooter))).toContain('href="/refunds"')
  })

  it("a paid plan's settings link it; Community's only once it can subscribe", () => {
    const now = new Date()
    const off = { configured: false, testMode: false }
    const billing = (kind: PlanBilling["kind"], env = off): PlanBilling => ({ kind, periodEnd: null, amountNgn: null, cardLast4: null, ...env })
    expect(render(createElement(PlanSection, { planId: "starter", billing: billing("manual"), now }))).toContain('href="/refunds"')
    expect(render(createElement(PlanSection, { planId: "pro", billing: billing("renewing"), now }))).toContain('href="/refunds"')
    expect(render(createElement(PlanSection, { planId: "community", billing: billing("none"), now }))).not.toContain('href="/refunds"')
    expect(render(createElement(PlanSection, { planId: "community", billing: billing("none", { configured: true, testMode: false }), now }))).toContain('href="/refunds"')
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
