import { describe, expect, it } from "vitest"
import { closeButtonPosition } from "@/lib/sheet"

// A 48px trigger centred in a bar of `bar` px, `inset` px from the right edge.
const trigger = (viewport: number, inset: number, bar: number, scrollY = 0) => {
  const top = (bar - 48) / 2 - scrollY
  return { top, bottom: top + 48, right: viewport - inset }
}

describe("closeButtonPosition", () => {
  it("sits on the trigger at 360px (px-4, 64px bar)", () => {
    expect(closeButtonPosition(trigger(360, 16, 64), 360, 306, 64)).toEqual({ top: 8, right: 16 })
  })

  it("sits on the trigger at 700px (medium:px-6, 56px bar)", () => {
    expect(closeButtonPosition(trigger(700, 24, 56), 700, 320, 56)).toEqual({ top: 4, right: 24 })
  })

  it("centres in the band when the trigger has scrolled above the viewport", () => {
    expect(closeButtonPosition(trigger(844, 24, 64, 300), 844, 360, 64)).toEqual({ top: 8, right: 24 })
  })

  it("is not offset by a classic scrollbar when given clientWidth", () => {
    // innerWidth 800, a 17px scrollbar: the page — and the trigger — lay out in 783.
    const t = trigger(783, 24, 64)
    expect(closeButtonPosition(t, 783, 360, 64)).toEqual({ top: 8, right: 24 })
    // innerWidth would have moved it 17px left.
    expect(closeButtonPosition(t, 800, 360, 64).right).toBe(41)
  })

  it("clamps so the 48px button stays inside the sheet", () => {
    expect(closeButtonPosition({ top: -10, bottom: 38, right: 100 }, 400, 200, 64)).toEqual({
      top: 0,
      right: 152,
    })
    expect(closeButtonPosition({ top: 8, bottom: 56, right: 420 }, 400, 200, 64).right).toBe(0)
  })
})
