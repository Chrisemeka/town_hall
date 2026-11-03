import { describe, expect, it } from "vitest"
import {
  balance,
  carryOver,
  cohortEligible,
  held,
  monthOf,
  release,
  reserve,
  type LedgerRow,
  type Slots,
} from "@/lib/allowance"
import { planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"

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
  // The one place a wrong number gives cohort supply away: a Starter account
  // read as Pro is five paid reports a month for nothing. From the stored
  // column, through the same two calls lib/allowanceDb.ts makes.
  it.each([
    [null, 0],
    ["community", 0],
    ["starter", 5],
    ["pro", 10],
  ])("gives plan_id %s a monthly entitlement of %i", (planId, monthly) => {
    expect(balance(planFor(planIdFor(planId)).monthlyReports, [], OCT).monthly).toBe(monthly)
  })

  it("gives Pro its monthly entitlement with no rows at all", () => {
    expect(balance(10, [], OCT)).toEqual({ monthly: 10, carried: 0, grant: 0, earned: 0, total: 10 })
  })

  it("gives Community only what the ledger holds", () => {
    expect(balance(0, [grant(), earned(), earned()], OCT)).toEqual({
      monthly: 0,
      carried: 0,
      grant: 3,
      earned: 2,
      total: 5,
    })
  })

  it("resets the monthly pool when the month turns, and leaves the rest", () => {
    const rows = [grant(), reserved("monthly", 10, "2026-10-01"), reserved("grant", 1)]
    expect(balance(10, rows, OCT).monthly).toBe(0)
    expect(balance(10, rows, NOV)).toEqual({ monthly: 10, carried: 0, grant: 2, earned: 0, total: 12 })
  })

  it("clamps the monthly pool at zero after a mid-month downgrade", () => {
    const rows = [reserved("monthly", 5, "2026-10-01"), earned()]
    expect(balance(0, rows, OCT)).toEqual({ monthly: 0, carried: 0, grant: 0, earned: 1, total: 1 })
  })
})

describe("reserve — spend order", () => {
  it("spends Pro's monthly allowance before earned credit", () => {
    const b = balance(10, [earned(), earned(), earned(), earned()], OCT)
    expect(reserve(b, 5, OCT)).toEqual([{ bucket: "monthly", period: "2026-10-01", slots: 5 }])
  })

  it("splits a reservation that spans pools, one entry per pool", () => {
    const b = { monthly: 2, carried: 0, grant: 3, earned: 4, total: 9 }
    expect(reserve(b, 5, OCT)).toEqual([
      { bucket: "monthly", period: "2026-10-01", slots: 2 },
      { bucket: "grant", period: null, slots: 3 },
    ])
  })

  it("spends grant before earned", () => {
    const b = { monthly: 0, carried: 0, grant: 1, earned: 4, total: 5 }
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

  it("lets the cohort serve carried slots: paid for, even after a lapse (C1)", () => {
    expect(cohortEligible("carried")).toBe(true)
  })
})

const carried = (slots: number): LedgerRow => ({ kind: "carried", bucket: "carried", period: null, slots })
const NOV_2 = new Date("2026-11-02T10:00:00Z")

describe("carryOver", () => {
  it("turns an ended month's release into one carried entry with a null period", () => {
    expect(carryOver([{ bucket: "monthly", period: "2026-10-01", slots: 2 }], NOV_2)).toEqual([
      { bucket: "carried", period: null, slots: 2 },
    ])
  })

  it("sums two ended months into one entry", () => {
    const back: Slots[] = [
      { bucket: "monthly", period: "2026-10-01", slots: 2 },
      { bucket: "monthly", period: "2026-09-01", slots: 1 },
    ]
    expect(carryOver(back, NOV_2)).toEqual([{ bucket: "carried", period: null, slots: 3 }])
  })

  it("carries nothing from this month: it returns to this month's pool", () => {
    expect(carryOver([{ bucket: "monthly", period: "2026-11-01", slots: 2 }], NOV_2)).toEqual([])
  })

  it("carries nothing from pools that do not expire", () => {
    const back: Slots[] = [
      { bucket: "grant", period: null, slots: 1 },
      { bucket: "earned", period: null, slots: 1 },
      { bucket: "carried", period: null, slots: 1 },
    ]
    expect(carryOver(back, NOV_2)).toEqual([])
  })

  it("carries nothing from nothing", () => {
    expect(carryOver([], NOV_2)).toEqual([])
  })

  it("carries nothing at the month edge: a close read at 23:59:59 on the 31st is still that month", () => {
    const lastSecond = new Date("2026-10-31T22:59:59Z") // 23:59:59 Lagos
    expect(carryOver([{ bucket: "monthly", period: "2026-10-01", slots: 2 }], lastSecond)).toEqual([])
  })
})

describe("the carried pool", () => {
  it("is counted, and is not eaten by the monthly clamp after a downgrade", () => {
    // Pro to Starter with 10 reserved this month and 2 carried.
    const rows = [reserved("monthly", 10, "2026-11-01"), carried(2)]
    expect(balance(5, rows, NOV)).toEqual({ monthly: 0, carried: 2, grant: 0, earned: 0, total: 2 })
  })

  it("is spent after monthly and before grant and earned, with a null period", () => {
    const b = { monthly: 1, carried: 2, grant: 1, earned: 1, total: 5 }
    expect(reserve(b, 5, NOV)).toEqual([
      { bucket: "monthly", period: "2026-11-01", slots: 1 },
      { bucket: "carried", period: null, slots: 2 },
      { bucket: "grant", period: null, slots: 1 },
      { bucket: "earned", period: null, slots: 1 },
    ])
  })

  it("comes back after earned and grant, before monthly, and releases once", () => {
    const rows = [
      reserved("monthly", 1, "2026-11-01"),
      reserved("carried", 1),
      reserved("grant", 1),
      reserved("earned", 1),
    ]
    const back = release(held(rows), 0)
    expect(back.map((s) => s.bucket)).toEqual(["earned", "grant", "carried", "monthly"])
    const after = [...rows, ...back.map((s) => released(s.bucket, s.slots, s.period))]
    expect(release(held(after), 0)).toEqual([])
  })

  it("holds the worked example: 5 in October, 3 received, closed on 2 November", () => {
    const rows: LedgerRow[] = [reserved("monthly", 5, "2026-10-01")]
    const back = release(held(rows), 3)
    const carry = carryOver(back, NOV_2)
    expect(back).toEqual([{ bucket: "monthly", period: "2026-10-01", slots: 2 }])
    expect(carry).toEqual([{ bucket: "carried", period: null, slots: 2 }])

    const after = [
      ...rows,
      ...back.map((s) => released(s.bucket, s.slots, s.period)),
      ...carry.map((s) => carried(s.slots)),
    ]
    // Starter in November: a fresh 5, plus the 2 paid for and not delivered.
    expect(balance(5, after, NOV_2)).toMatchObject({ monthly: 5, carried: 2, total: 7 })
    // A second close releases nothing, so carries nothing.
    const again = release(held(after), 3)
    expect(again).toEqual([])
    expect(carryOver(again, NOV_2)).toEqual([])
  })
})
