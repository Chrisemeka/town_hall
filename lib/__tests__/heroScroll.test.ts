import { describe, expect, it } from "vitest"
import { heroProgress } from "@/lib/heroScroll"

// 1440 × 900: the region is 900 − 64 − 160 = 676 tall, the copy 344.
const REGION = 676
const COPY = 344

describe("heroProgress", () => {
  it("is 0 at rest", () => {
    expect(heroProgress(0, REGION, COPY)).toBe(0)
  })

  it("is 1 when the window's top reaches the copy's top", () => {
    // The copy's top sits (676 − 344) / 2 = 166 below the region's top.
    expect(heroProgress(REGION - 166, REGION, COPY)).toBe(1)
    expect(heroProgress(255, REGION, COPY)).toBe(0.5)
  })

  it("clamps past the cover point and above the top (overscroll)", () => {
    expect(heroProgress(5000, REGION, COPY)).toBe(1)
    expect(heroProgress(-40, REGION, COPY)).toBe(0)
  })

  it("is 0 before anything has been measured, not NaN", () => {
    expect(heroProgress(120, 0, 0)).toBe(0)
  })
})
