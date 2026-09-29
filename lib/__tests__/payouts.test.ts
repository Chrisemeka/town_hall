import { describe, expect, it } from "vitest"
import {
  PAYOUT_RATES,
  cohortSlots,
  memberAt,
  openToCohort,
  payableReports,
  payoutFor,
  payoutMonth,
  periodsFrom,
  shiftMonth,
  type FiledReport,
  type Period,
} from "@/lib/payouts"
import type { LedgerRow } from "@/lib/allowance"
import { cell } from "@/lib/csv"

// What the cohort is owed. Each case is a person paid wrongly if it breaks.

const OCT = "2026-10-01"
const ALWAYS: Period[] = [{ from: "2026-01-01T00:00:00Z", to: null }]

let seq = 0
const report = (over: Partial<FiledReport> = {}): FiledReport => ({
  id: `r${++seq}`,
  testerId: "t1",
  missionId: "m1",
  createdAt: "2026-10-10T12:00:00Z",
  rating: null,
  ...over,
})
const reserved = (bucket: string, slots: number): LedgerRow => ({
  kind: "reserved",
  bucket,
  period: bucket === "monthly" ? OCT : null,
  slots: -slots,
})

describe("payoutFor — rate and bonus edges", () => {
  it("pays the per-report rate", () => {
    expect(payoutFor(1).total).toBe(PAYOUT_RATES.perReportNgn)
    expect(payoutFor(0).total).toBe(0)
  })
  it("pays no bonus at 9", () => {
    expect(payoutFor(9)).toEqual({ base: 9_000, bonus: 0, total: 9_000 })
  })
  it("pays the bonus at exactly 10", () => {
    expect(payoutFor(10)).toEqual({ base: 10_000, bonus: 3_000, total: 13_000 })
  })
  it("pays one bonus, not more, at 11", () => {
    expect(payoutFor(11)).toEqual({ base: 11_000, bonus: 3_000, total: 14_000 })
  })
})

describe("cohortSlots — the cohort serves monthly and grant, never earned", () => {
  it("counts Pro monthly and grant slots", () => {
    expect(cohortSlots([reserved("monthly", 5)])).toBe(5)
    expect(cohortSlots([reserved("grant", 3)])).toBe(3)
  })
  it("counts no earned slots", () => {
    expect(cohortSlots([reserved("earned", 5)])).toBe(0)
  })
  it("counts only the eligible part of a mixed mission, net of releases", () => {
    const rows = [reserved("grant", 2), reserved("earned", 3), { kind: "released", bucket: "grant", period: null, slots: 1 }]
    expect(cohortSlots(rows)).toBe(1)
  })
})

describe("payableReports", () => {
  const periods = new Map([["t1", ALWAYS], ["t2", ALWAYS]])

  it("pays the first cohort reports on a mission up to its cohort slots, in filing order", () => {
    const late = report({ testerId: "t1", createdAt: "2026-10-12T00:00:00Z" })
    const early = report({ testerId: "t2", createdAt: "2026-10-11T00:00:00Z" })
    const payable = payableReports([late, early], new Map([["m1", 1]]), periods)
    expect([...payable]).toEqual([early.id])
  })

  it("pays nothing on a mission funded from earned credit", () => {
    expect(payableReports([report()], new Map([["m1", 0]]), periods).size).toBe(0)
  })

  it("does not pay reports filed before joining or after leaving", () => {
    const joined: Period[] = [{ from: "2026-10-05T00:00:00Z", to: "2026-10-20T00:00:00Z" }]
    const before = report({ createdAt: "2026-10-04T23:59:00Z" })
    const during = report({ createdAt: "2026-10-10T00:00:00Z" })
    const after = report({ createdAt: "2026-10-20T00:00:00Z" })
    const payable = payableReports([before, during, after], new Map([["m1", 5]]), new Map([["t1", joined]]))
    expect([...payable]).toEqual([during.id])
  })

  it("does not pay a report by someone never in the cohort", () => {
    expect(payableReports([report({ testerId: "stranger" })], new Map([["m1", 5]]), periods).size).toBe(0)
  })
})

describe("periodsFrom — the change log is the membership history", () => {
  it("keeps an earlier period when someone re-joins", () => {
    const periods = periodsFrom([
      { to: "member", at: "2026-03-01T00:00:00Z" },
      { to: "not_member", at: "2026-04-01T00:00:00Z" },
      { to: "member", at: "2026-06-01T00:00:00Z" },
    ])
    expect(memberAt(periods, "2026-03-15T00:00:00Z")).toBe(true)
    expect(memberAt(periods, "2026-05-01T00:00:00Z")).toBe(false)
    expect(memberAt(periods, "2026-07-01T00:00:00Z")).toBe(true)
  })
})

describe("openToCohort", () => {
  it("closes a mission to the cohort once its paid slots are filed", () => {
    const periods = new Map([["t1", ALWAYS]])
    const slots = new Map([["m1", 1], ["m2", 2], ["m3", 0]])
    const filed = [report({ missionId: "m1" }), report({ missionId: "m2" })]
    const payable = payableReports(filed, slots, periods)
    expect([...openToCohort(["m1", "m2", "m3"], slots, filed, payable)]).toEqual(["m2"])
  })
})

describe("payoutMonth", () => {
  const periods = new Map([["t1", ALWAYS]])
  const slots = new Map([["m1", 20]])

  it("puts a report at 23:50 WAT on 31 October in October, and 00:10 on 1 November in November", () => {
    const lateOct = report({ createdAt: "2026-10-31T22:50:00Z" }) // 23:50 WAT
    const earlyNov = report({ createdAt: "2026-10-31T23:10:00Z" }) // 00:10 WAT
    const reports = [lateOct, earlyNov]
    const payable = payableReports(reports, slots, periods)
    expect(payoutMonth(OCT, reports, payable, periods).rows[0].payable).toBe(1)
    expect(payoutMonth("2026-11-01", reports, payable, periods).rows[0].payable).toBe(1)
  })

  it("flags a low rating and pays the same total", () => {
    const low = Array.from({ length: 10 }, () => report({ rating: 2 }))
    const high = Array.from({ length: 10 }, () => report({ testerId: "t1", rating: 5 }))
    const payableLow = payableReports(low, slots, periods)
    const payableHigh = payableReports(high, slots, periods)
    const a = payoutMonth(OCT, low, payableLow, periods).rows[0]
    const b = payoutMonth(OCT, high, payableHigh, periods).rows[0]
    expect(a.flagged).toBe(true)
    expect(b.flagged).toBe(false)
    expect(a.total).toBe(b.total)
    expect(a.total).toBe(13_000)
  })

  it("shows unpaid cohort reports rather than hiding them, and sums the month", () => {
    const reports = [report(), report({ missionId: "earned-only" })]
    const payable = payableReports(reports, slots, periods)
    const sheet = payoutMonth(OCT, reports, payable, periods)
    expect(sheet.rows[0]).toMatchObject({ payable: 1, unpaid: 1, total: 1_000 })
    expect(sheet.totalNgn).toBe(1_000)
  })

  it("leaves out someone who was not a member that month", () => {
    const left = new Map<string, Period[]>([["t1", [{ from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" }]]])
    expect(payoutMonth(OCT, [], new Set(), left).rows).toEqual([])
  })
})

describe("shiftMonth", () => {
  it("steps across a year", () => {
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01")
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01")
  })
})

describe("the CSV a tester name lands in", () => {
  it("neutralises a name starting with =", () => {
    expect(cell('=HYPERLINK("http://evil","pay me")')).toBe(`"'=HYPERLINK(""http://evil"",""pay me"")"`)
  })
})
