import { describe, expect, it } from "vitest"
import { swipeStep } from "@/lib/swipe"

describe("swipeStep", () => {
  it("moves forward on a left swipe and back on a right one", () => {
    expect(swipeStep(-48, 0)).toBe(1)
    expect(swipeStep(48, 0)).toBe(-1)
  })

  it("ignores a swipe under the 48px threshold", () => {
    expect(swipeStep(-47, 0)).toBe(0)
  })

  it("ignores a swipe that is not at least twice as wide as it is tall", () => {
    expect(swipeStep(-60, 40)).toBe(0)
  })

  it("never treats a vertical scroll as a swipe", () => {
    expect(swipeStep(0, -200)).toBe(0)
  })
})
