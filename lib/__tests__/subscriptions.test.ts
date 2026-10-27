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
  it("is what was paid, spread over the months it covers; comped is zero", () => {
    const month = { amount_ngn: 30000, period_start: "2026-10-01T00:00:00Z", period_end: "2026-11-01T00:00:00Z" }
    const quarter = { amount_ngn: 45000, period_start: "2026-10-01T00:00:00Z", period_end: "2027-01-01T00:00:00Z" }
    const comped = { amount_ngn: null, period_start: "2026-10-01T00:00:00Z", period_end: null }
    expect(monthlyAmount(month)).toBe(30000)
    expect(monthlyAmount(quarter)).toBe(15000)
    expect(mrr([month, quarter, comped])).toBe(45000)
  })
})
