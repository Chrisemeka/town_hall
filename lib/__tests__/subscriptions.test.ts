import { describe, expect, it } from "vitest"
import { allowanceEffect, changeKind, defaultPeriodEnd, endOfLagosDay, monthlyAmount, mrr } from "@/lib/subscriptions"

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
