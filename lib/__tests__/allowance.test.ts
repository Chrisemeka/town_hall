import { describe, expect, it } from "vitest"
import {
  balance,
  cohortEligible,
  held,
  monthOf,
  release,
  reserve,
  type LedgerRow,
  type Slots,
} from "@/lib/allowance"

// The arithmetic that decides what a builder can spend and what the cohort may
// be paid against. Every case here is one that costs someone money if wrong.

const OCT = new Date("2026-10-15T12:00:00Z")
const NOV = new Date("2026-11-15T12:00:00Z")

const grant = (slots = 3): LedgerRow => ({ kind: "grant", bucket: "grant", period: null, slots })
const earned = (slots = 1): LedgerRow => ({ kind: "earned", bucket: "earned", period: null, slots })
const reserved = (bucket: string, slots: number, period: string | null = null): LedgerRow => ({
  kind: "reserved",
  bucket,
  period,
  slots: -slots,
})
const released = (bucket: string, slots: number, period: string | null = null): LedgerRow => ({
  kind: "released",
  bucket,
  period,
  slots,
})

describe("monthOf — Africa/Lagos, UTC+1", () => {
  it("puts 23:30 UTC on 31 October in November", () => {
    expect(monthOf(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01")
  })
  it("keeps 22:59 UTC on 31 October in October", () => {
    expect(monthOf(new Date("2026-10-31T22:59:00Z"))).toBe("2026-10-01")
  })
  it("rolls the year", () => {
    expect(monthOf(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01")
  })
})

describe("balance", () => {
  it("gives Pro its monthly entitlement with no rows at all", () => {
    expect(balance(10, [], OCT)).toEqual({ monthly: 10, grant: 0, earned: 0, total: 10 })
  })

  it("gives Community only what the ledger holds", () => {
    expect(balance(0, [grant(), earned(), earned()], OCT)).toEqual({
      monthly: 0,
      grant: 3,
      earned: 2,
      total: 5,
    })
  })

  it("resets the monthly pool when the month turns, and leaves the rest", () => {
    const rows = [grant(), reserved("monthly", 10, "2026-10-01"), reserved("grant", 1)]
    expect(balance(10, rows, OCT).monthly).toBe(0)
    expect(balance(10, rows, NOV)).toEqual({ monthly: 10, grant: 2, earned: 0, total: 12 })
  })

  it("clamps the monthly pool at zero after a mid-month downgrade", () => {
    const rows = [reserved("monthly", 5, "2026-10-01"), earned()]
    expect(balance(0, rows, OCT)).toEqual({ monthly: 0, grant: 0, earned: 1, total: 1 })
  })
})

describe("reserve — spend order", () => {
  it("spends Pro's monthly allowance before earned credit", () => {
    const b = balance(10, [earned(), earned(), earned(), earned()], OCT)
    expect(reserve(b, 5, OCT)).toEqual([{ bucket: "monthly", period: "2026-10-01", slots: 5 }])
  })

  it("splits a reservation that spans pools, one entry per pool", () => {
    const b = { monthly: 2, grant: 3, earned: 4, total: 9 }
    expect(reserve(b, 5, OCT)).toEqual([
      { bucket: "monthly", period: "2026-10-01", slots: 2 },
      { bucket: "grant", period: null, slots: 3 },
    ])
  })

  it("spends grant before earned", () => {
    const b = { monthly: 0, grant: 1, earned: 4, total: 5 }
    expect(reserve(b, 3, OCT)).toEqual([
      { bucket: "grant", period: null, slots: 1 },
      { bucket: "earned", period: null, slots: 2 },
    ])
  })

  it("caps at a partial balance rather than refusing", () => {
    const b = balance(0, [grant()], OCT)
    const slots = reserve(b, 5, OCT)
    expect(slots.reduce((n, s) => n + s.slots, 0)).toBe(3)
  })

  it("reserves nothing at zero", () => {
    expect(reserve(balance(0, [], OCT), 5, OCT)).toEqual([])
  })
})

describe("held and release", () => {
  const mission = [reserved("monthly", 3, "2026-10-01"), reserved("earned", 2)]

  it("returns the unused remainder, earned first", () => {
    expect(release(held(mission), 1)).toEqual([
      { bucket: "earned", period: null, slots: 2 },
      { bucket: "monthly", period: "2026-10-01", slots: 2 },
    ])
  })

  it("returns nothing when every slot was filled", () => {
    expect(release(held(mission), 5)).toEqual([])
    expect(release(held(mission), 7)).toEqual([])
  })

  it("releases once: closing again over its own output returns nothing", () => {
    const first = release(held(mission), 1)
    const after = [...mission, ...first.map((s) => released(s.bucket, s.slots, s.period))]
    expect(release(held(after), 1)).toEqual([])
  })

  it("handles reopen-and-close cumulatively", () => {
    // Open 5 grant, 3 reports, close → 2 back. Reopen 5 earned, 2 more reports.
    const rows = [reserved("grant", 5), released("grant", 2), reserved("earned", 5)]
    expect(release(held(rows), 5)).toEqual([{ bucket: "earned", period: null, slots: 3 }])
  })

  it("holds nothing for a mission published before the ledger", () => {
    expect(release(held([]), 0)).toEqual([])
  })

  it("sends an October release back to October, where it no longer counts in November", () => {
    const rows: LedgerRow[] = [reserved("monthly", 5, "2026-10-01")]
    const back = release(held(rows), 2)
    expect(back).toEqual([{ bucket: "monthly", period: "2026-10-01", slots: 3 }])
    const after = [...rows, ...back.map((s: Slots) => released(s.bucket, s.slots, s.period))]
    expect(balance(10, after, NOV).monthly).toBe(10)
    expect(balance(10, after, OCT).monthly).toBe(8)
  })
})

describe("cohortEligible", () => {
  it("lets the cohort serve Pro's monthly and the signup grant, never earned", () => {
    expect(cohortEligible("monthly")).toBe(true)
    expect(cohortEligible("grant")).toBe(true)
    expect(cohortEligible("earned")).toBe(false)
  })
})
