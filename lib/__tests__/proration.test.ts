import { afterEach, describe, expect, it } from "vitest"
import { lagosDay, upgradeRefund } from "@/lib/proration"

// SPEC-paystack-plan-changes §2.1: Starter ₦15,000 paid 4 Nov, next charge 4 Dec.
const NOV = { periodStart: "2026-11-04T09:00:00+01:00", periodEnd: "2026-12-04T09:00:00+01:00", baseNgn: 15000 }

const TABLE: [string, number, number][] = [
  ["2026-11-04T15:00:00+01:00", 29, 14500],
  ["2026-11-14T10:00:00+01:00", 19, 9500],
  ["2026-11-14T00:30:00+01:00", 19, 9500], // 13 Nov 23:30 UTC: a UTC date gives ₦10,000
  ["2026-11-13T23:59:00+01:00", 20, 10000],
  ["2026-12-03T20:00:00+01:00", 0, 0],
]

const ZONE = process.env.TZ
afterEach(() => {
  process.env.TZ = ZONE
})

describe.each(["UTC", "America/Los_Angeles"])("with the process in %s", (tz) => {
  it.each(TABLE)("Pro paid %s refunds %i days, ₦%i", (at, days, amount) => {
    process.env.TZ = tz
    const r = upgradeRefund({ ...NOV, upgradeAt: at })
    expect(r).toEqual({ refundableDays: days, daysInPeriod: 30, amountNgn: amount })
  })

  it("lagosDay gives the Lagos date, not the process's", () => {
    process.env.TZ = tz
    expect(lagosDay("2026-11-13T23:30:00Z")).toBe("2026-11-14")
    expect(lagosDay(new Date("2026-11-13T22:59:00Z"))).toBe("2026-11-13")
  })
})

describe("upgradeRefund", () => {
  it("the next billing date's own day is outside the period: ₦0", () => {
    expect(upgradeRefund({ ...NOV, upgradeAt: "2026-12-04T08:00:00+01:00" }).amountNgn).toBe(0)
  })

  it("after a failed renewal no paid period contains the day: ₦0", () => {
    expect(upgradeRefund({ ...NOV, upgradeAt: "2026-12-05T10:00:00+01:00" }).amountNgn).toBe(0)
  })

  it("base reduced by a prior refund: ⌊12,000 × 19 ÷ 30⌋", () => {
    expect(upgradeRefund({ ...NOV, baseNgn: 12000, upgradeAt: "2026-11-14T10:00:00+01:00" }).amountNgn).toBe(7600)
  })

  it("a February period: ⌊15,000 × 18 ÷ 28⌋", () => {
    const r = upgradeRefund({ periodStart: "2027-02-01T09:00:00+01:00", periodEnd: "2027-03-01T09:00:00+01:00", baseNgn: 15000, upgradeAt: "2027-02-10T12:00:00+01:00" })
    expect(r).toEqual({ refundableDays: 18, daysInPeriod: 28, amountNgn: 9642 })
  })

  it("nothing left to refund is ₦0", () => {
    expect(upgradeRefund({ ...NOV, baseNgn: 0, upgradeAt: "2026-11-14T10:00:00+01:00" }).amountNgn).toBe(0)
  })
})
