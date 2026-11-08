import { describe, expect, it } from "vitest"
import {
  GRACE_DAYS,
  allowanceEffect,
  billingDay,
  billingNotice,
  changeKind,
  defaultPeriodEnd,
  disableActionFor,
  endOfLagosDay,
  graceEnd,
  monthlyAmount,
  mrr,
  planBillingFor,
  provisionalPeriodEnd,
} from "@/lib/subscriptions"

describe("changeKind", () => {
  it("names every move", () => {
    expect(changeKind("community", "pro", false)).toBe("start")
    expect(changeKind("starter", "pro", true)).toBe("start")
    expect(changeKind("pro", "starter", true)).toBe("downgrade")
    expect(changeKind("pro", "community", true)).toBe("downgrade")
    expect(changeKind("pro", "pro", true)).toBe("extend")
    // A plan set before subscriptions existed has no row: choosing it records one.
    expect(changeKind("pro", "pro", false)).toBe("start")
    expect(changeKind("community", "community", false)).toBe("none")
  })
})

describe("dates", () => {
  it("defaults a month ahead in Lagos, clamped to the month's end", () => {
    expect(defaultPeriodEnd(new Date("2026-10-27T10:00:00Z"))).toBe("2026-11-27")
    expect(defaultPeriodEnd(new Date("2027-01-31T10:00:00Z"))).toBe("2027-02-28")
    // 23:30 UTC is already the next day in Lagos.
    expect(defaultPeriodEnd(new Date("2026-10-31T23:30:00Z"))).toBe("2026-12-01")
  })

  it("ends a period at the last second of its Lagos day", () => {
    expect(endOfLagosDay("2026-11-27")).toBe("2026-11-27T22:59:59.000Z")
  })
})

describe("a subscription's dates", () => {
  it("names the billing day in Lagos, and the 28th for the 29th–31st", () => {
    expect(billingDay(new Date("2026-11-04T10:00:00Z"))).toBe("4th")
    expect(billingDay(new Date("2026-11-01T10:00:00Z"))).toBe("1st")
    expect(billingDay(new Date("2026-11-02T10:00:00Z"))).toBe("2nd")
    expect(billingDay(new Date("2026-11-03T10:00:00Z"))).toBe("3rd")
    expect(billingDay(new Date("2026-11-11T10:00:00Z"))).toBe("11th")
    expect(billingDay(new Date("2026-11-22T10:00:00Z"))).toBe("22nd")
    expect(billingDay(new Date("2026-11-30T10:00:00Z"))).toBe("28th")
    // 23:30 UTC on the 3rd is already the 4th in Lagos.
    expect(billingDay(new Date("2026-11-03T23:30:00Z"))).toBe("4th")
  })

  it("gives three days of grace", () => {
    expect(GRACE_DAYS).toBe(3)
    expect(graceEnd("2026-12-04T00:00:00.000Z")).toBe("2026-12-07T00:00:00.000Z")
  })

  it("makes a provisional end a month on, clamped", () => {
    expect(provisionalPeriodEnd("2026-11-04T10:00:00.000Z")).toBe("2026-12-04T10:00:00.000Z")
    expect(provisionalPeriodEnd("2027-01-31T10:00:00.000Z")).toBe("2027-02-28T10:00:00.000Z")
  })
})

describe("planBillingFor", () => {
  const env = { configured: true, testMode: false }
  const row = { source: "paystack", period_end: "2026-12-04T00:00:00Z", amount_ngn: 15000, provider_status: "active", card_last4: "4081" }

  it("reads each state", () => {
    expect(planBillingFor("community", null, null, env).kind).toBe("none")
    expect(planBillingFor("starter", { ...row, source: "manual" }, null, env).kind).toBe("manual")
    expect(planBillingFor("starter", row, null, env).kind).toBe("renewing")
    expect(planBillingFor("starter", { ...row, provider_status: "attention" }, null, env).kind).toBe("attention")
  })

  it("reads cancelled from the scheduled row, never from provider_status", () => {
    expect(planBillingFor("starter", row, "community", env).kind).toBe("cancelled")
    expect(planBillingFor("starter", { ...row, provider_status: "non-renewing" }, null, env).kind).toBe("renewing")
    expect(planBillingFor("starter", { ...row, provider_status: "attention" }, "community", env).kind).toBe("cancelled")
  })

  it("treats a plan set before subscriptions existed as arranged directly", () => {
    expect(planBillingFor("pro", null, null, env).kind).toBe("manual")
  })
})

describe("disableActionFor", () => {
  it("queues one, keyed on the code, or none without a code", () => {
    expect(disableActionFor({ provider_subscription_id: "SUB_1", provider_email_token: "tok" })).toEqual([
      { kind: "disable_subscription", subscription_code: "SUB_1", email_token: "tok", idempotency_key: "disable:SUB_1" },
    ])
    expect(disableActionFor({ provider_subscription_id: null })).toEqual([])
  })
})

describe("billingNotice", () => {
  const site = "https://twnhall.com"
  const periodEnd = "2026-12-04T10:00:00Z"
  const kinds = ["started", "renewed", "renews_soon", "cancelled_ending", "manual_ending", "cancelled", "payment_failed", "lapsed"] as const

  it.each(kinds)("%s names the amount, and links Settings → Plan and the policy", (kind) => {
    const { body } = billingNotice(kind, "starter", { periodEnd, cardLast4: "4081", site })
    expect(body).toContain("₦15,000")
    expect(body).toContain("https://twnhall.com/settings?tab=plan")
    expect(body).toContain("https://twnhall.com/refunds")
  })

  it("carries the spec's subjects", () => {
    const subject = (kind: (typeof kinds)[number]) => billingNotice(kind, "pro", { periodEnd, site }).subject
    expect(subject("started")).toBe("You're on Pro")
    expect(subject("renewed")).toBe("Payment received for Pro")
    expect(subject("renews_soon")).toBe("Your Pro plan renews on 4 Dec 2026")
    expect(subject("cancelled_ending")).toBe("Your Pro plan ends on 4 Dec 2026")
    expect(subject("manual_ending")).toBe("Your Pro plan ends on 4 Dec 2026")
    expect(subject("cancelled")).toBe("Pro cancelled")
    expect(subject("payment_failed")).toBe("Your Pro payment didn't go through")
    expect(subject("lapsed")).toBe("Your Pro plan has ended")
  })

  it("gives the deadline after a failed payment, and says how to stop on first charge", () => {
    expect(billingNotice("payment_failed", "starter", { periodEnd, site }).body).toContain("Pay by 7 Dec 2026")
    const started = billingNotice("started", "starter", { periodEnd, cardLast4: "4081", site }).body
    expect(started).toContain("the card ending 4081")
    expect(started).toContain("Cancel any time in Settings → Plan")
    expect(started).toContain("on 4 Dec 2026")
  })
})

describe("allowanceEffect", () => {
  it("says what the allowance does, in its own numbers", () => {
    expect(allowanceEffect("start", "community", "pro")).toMatch(/full 10 reports/)
    expect(allowanceEffect("downgrade", "pro", "starter", { when: "now" })).toMatch(/drops to Starter's 5/)
    expect(allowanceEffect("downgrade", "pro", "community", { when: "period_end", periodEnd: "2026-11-27T22:59:59Z" })).toMatch(
      /^Nothing changes until 27 Nov 2026; then the monthly allowance becomes 0/,
    )
    expect(allowanceEffect("extend", "pro", "pro", { periodEnd: "2026-12-27T22:59:59Z" })).toMatch(/Pro continues to 27 Dec 2026/)
  })
})

describe("mrr", () => {
  const NOW = new Date("2026-10-15T00:00:00Z")
  const pay = (id: string, amount_ngn: number, period_start: string, period_end: string | null) => ({ id, amount_ngn, period_start, period_end })

  it("is what was paid, spread over the months each payment covers", () => {
    const month = pay("a", 30000, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")
    const quarter = pay("b", 45000, "2026-10-01T00:00:00Z", "2027-01-01T00:00:00Z")
    expect(monthlyAmount(month, [])).toBe(30000)
    expect(monthlyAmount(quarter, [])).toBe(15000)
    expect(mrr([month, quarter], [], NOW)).toBe(45000)
  })

  it("reads ₦15,000 after a ₦15,000 period is renewed once, not ₦7,500", () => {
    const first = pay("a", 15000, "2026-09-20T00:00:00Z", "2026-10-20T00:00:00Z")
    const renewal = pay("b", 15000, "2026-10-20T00:00:00Z", "2026-11-20T00:00:00Z")
    expect(mrr([first, renewal], [], NOW)).toBe(15000)
    expect(mrr([first, renewal], [], new Date("2026-10-25T00:00:00Z"))).toBe(15000)
  })

  it("leaves out a period that hasn't started, has ended, or never ends", () => {
    expect(mrr([pay("a", 15000, "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z")], [], NOW)).toBe(0)
    expect(mrr([pay("a", 15000, "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z")], [], NOW)).toBe(0)
    expect(mrr([pay("a", 15000, "2026-10-01T00:00:00Z", null)], [], NOW)).toBe(0)
    // The end is excluded: on the renewal instant the old payment no longer counts.
    expect(mrr([pay("a", 15000, "2026-09-15T00:00:00Z", "2026-10-15T00:00:00Z")], [], NOW)).toBe(0)
  })

  it("counts a refund only once the money has actually gone back", () => {
    const p = pay("a", 15000, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")
    const refund = (status: string) => [{ payment_id: "a", amount_ngn: 9500, status }]
    for (const status of ["processed", "settled_outside"]) expect(mrr([p], refund(status), NOW)).toBe(5500)
    for (const status of ["queued", "sending", "unknown", "pending", "processing", "needs_attention", "failed"]) {
      expect(mrr([p], refund(status), NOW)).toBe(15000)
    }
    expect(mrr([p], [{ payment_id: "other", amount_ngn: 9500, status: "processed" }], NOW)).toBe(15000)
  })
})
