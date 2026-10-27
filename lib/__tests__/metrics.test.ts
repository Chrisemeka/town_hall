import { describe, expect, it } from "vitest"
import { capacityFor, change, fills, formatDuration, median, monthsBack, paidReportsSold, percentile, previous, rangeFor } from "@/lib/metrics"

const now = new Date("2026-10-27T12:00:00Z")

describe("ranges", () => {
  it("defaults to 30 days and knows the Lagos month", () => {
    expect(rangeFor(undefined, now).days).toBe(30)
    expect(rangeFor("7", now).from.toISOString()).toBe("2026-10-20T12:00:00.000Z")
    // Midnight 1 Oct in Lagos is 23:00 on 30 Sep in UTC.
    expect(rangeFor("month", now).from.toISOString()).toBe("2026-09-30T23:00:00.000Z")
  })

  it("compares against the same length immediately before", () => {
    const p = previous(rangeFor("7", now))
    expect(p.to.toISOString()).toBe("2026-10-20T12:00:00.000Z")
    expect(p.from.toISOString()).toBe("2026-10-13T12:00:00.000Z")
  })

  it("lists six months oldest first, across a year", () => {
    expect(monthsBack(new Date("2026-02-10T00:00:00Z"), 6)).toEqual([
      "2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01",
    ])
  })
})

describe("distributions", () => {
  it("median and p95 by nearest rank, null when empty", () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 100], 0.95)).toBe(100)
    expect(median([])).toBeNull()
  })
})

describe("time to fill", () => {
  it("is the Nth report for N slots, and skips missions still filling", () => {
    const times = new Map([
      ["a", ["2026-10-03T00:00:00Z", "2026-10-02T00:00:00Z"]],
      ["b", ["2026-10-05T00:00:00Z"]],
    ])
    const out = fills(
      [
        { id: "a", createdAt: "2026-10-01T00:00:00Z", testersNeeded: 2 },
        { id: "b", createdAt: "2026-10-01T00:00:00Z", testersNeeded: 3 },
        { id: "c", createdAt: "2026-10-01T00:00:00Z", testersNeeded: null },
      ],
      times,
    )
    expect(out).toEqual([{ ms: 2 * 24 * 3600 * 1000, at: "2026-10-03T00:00:00Z" }])
    expect(formatDuration(out[0].ms)).toBe("2.0 days")
    expect(formatDuration(5 * 3600 * 1000)).toBe("5 h")
  })
})

describe("the rest", () => {
  it("scales capacity, counts paid reports and states change", () => {
    expect(capacityFor(30)).toBe(200)
    expect(capacityFor(7)).toBe(47)
    expect(paidReportsSold({ starter: 4, pro: 3 }, (p) => (p === "pro" ? 10 : 5))).toBe(50)
    expect(change(12, 10)).toBe("+20%")
    expect(change(5, 10)).toBe("−50%")
    expect(change(3, 0)).toBe("new")
  })
})
