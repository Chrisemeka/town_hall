import { describe, expect, it } from "vitest"
import {
  NO_VALUE,
  averageRating,
  formatRating,
  formatRatio,
  giveTakeRatio,
  ratioCaption,
  reciprocityFrom,
} from "@/lib/reciprocity"

// The arithmetic is where the mistakes live, and two of them have a specific
// shape: a number that does not exist must not render as zero.

describe("giveTakeRatio", () => {
  it("divides given by received", () => {
    expect(giveTakeRatio(6, 3)).toBe(2)
    expect(giveTakeRatio(3, 6)).toBe(0.5)
    expect(giveTakeRatio(4, 4)).toBe(1)
  })

  it("is null when received is 0, not Infinity", () => {
    // Six reports given and none received is not an infinite ratio — the
    // question has no answer yet. Infinity would render as "∞" or "Infinity"
    // depending on the formatter, and both are wrong.
    expect(giveTakeRatio(6, 0)).toBeNull()
    expect(giveTakeRatio(0, 0)).toBeNull()
  })

  it("is null rather than NaN for a negative or absent divisor", () => {
    expect(giveTakeRatio(1, -1)).toBeNull()
  })
})

describe("averageRating", () => {
  it("averages the ratings that exist", () => {
    expect(averageRating([5, 4])).toBe(4.5)
    expect(averageRating([3])).toBe(3)
  })

  it("excludes nulls rather than counting them as zero", () => {
    // An unrated submission is not a zero-rated one. Counting it would drag a
    // tester's average down for work a builder simply has not reviewed yet.
    expect(averageRating([5, 4, null])).toBe(4.5)
    expect(averageRating([5, null, null])).toBe(5)
  })

  it("is null when nothing has been rated", () => {
    expect(averageRating([])).toBeNull()
    expect(averageRating([null, null])).toBeNull()
  })
})

describe("formatting an absent number", () => {
  it("renders a dash, never a zero", () => {
    // The lesson recovered with averageRating: "must render as '—', never as
    // 0.0, or an unrated tester looks terrible."
    expect(formatRatio(null)).toBe(NO_VALUE)
    expect(formatRating(null)).toBe(NO_VALUE)
    expect(formatRatio(null)).not.toBe("0.0")
    expect(formatRating(null)).not.toContain("0")
  })

  it("renders one decimal place when there is a number", () => {
    expect(formatRatio(2)).toBe("2.0")
    expect(formatRatio(0.3333)).toBe("0.3")
    expect(formatRating(4.5)).toBe("4.5 / 5")
  })

  it("renders a real zero ratio as a zero", () => {
    // Given nothing, received some: that IS zero, and it is not the same as
    // "no answer". The dash is reserved for the undefined case.
    expect(formatRatio(giveTakeRatio(0, 4))).toBe("0.0")
  })
})

describe("reciprocityFrom", () => {
  const base = { given: 0, received: 0, approved: 0, ratings: [] as (number | null)[] }

  it("reports an untouched account as empty", () => {
    expect(reciprocityFrom(base).empty).toBe(true)
  })

  it("is not empty once anything has happened in either direction", () => {
    expect(reciprocityFrom({ ...base, given: 1 }).empty).toBe(false)
    expect(reciprocityFrom({ ...base, received: 1 }).empty).toBe(false)
  })

  it("carries the counts through and derives the rest", () => {
    const r = reciprocityFrom({ given: 6, received: 3, approved: 5, ratings: [5, 4] })
    expect(r).toMatchObject({ given: 6, received: 3, approved: 5, ratio: 2, rating: 4.5 })
    expect(r.empty).toBe(false)
  })

  it("leaves both derived numbers null when there is nothing to derive", () => {
    const r = reciprocityFrom({ given: 2, received: 0, approved: 0, ratings: [null] })
    expect(r.ratio).toBeNull()
    expect(r.rating).toBeNull()
  })
})

describe("ratioCaption", () => {
  const of = (given: number, received: number) =>
    ratioCaption(reciprocityFrom({ given, received, approved: 0, ratings: [] }))

  it("does not scold someone who has received more than they gave", () => {
    // That person is exactly who the paid tier is for. The copy should not
    // make them feel caught.
    const caption = of(1, 5)
    expect(caption).toMatch(/evens it up/)
    expect(caption.toLowerCase()).not.toMatch(/should|owe|behind|need to/)
  })

  it("distinguishes 'nothing back yet' from 'nothing at all'", () => {
    expect(of(3, 0)).toMatch(/Nothing has come back/)
    expect(of(0, 0)).toMatch(/fills in once/)
  })

  it("acknowledges an even or positive balance", () => {
    expect(of(5, 5)).toMatch(/at least as much/)
    expect(of(9, 3)).toMatch(/at least as much/)
  })
})
