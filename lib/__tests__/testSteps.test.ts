import { describe, expect, it } from "vitest"
import { storedTestStepsSchema, testStepsSchema } from "@/lib/validation/schemas"

const step = (over: Partial<{ id: string; action: string; expected_result: string }> = {}) => ({
  id: crypto.randomUUID(),
  action: "Open the sign-up form",
  expected_result: "The form appears",
  ...over,
})

describe("write schema vs read schema", () => {
  it("refuses to save an empty test case", () => {
    expect(testStepsSchema.safeParse([]).success).toBe(false)
  })

  it("accepts an empty test case when reading one back", () => {
    // The bug this exists for: thirteen of sixteen live missions store [], and
    // parsing them with the write schema reported every one as corrupt.
    expect(storedTestStepsSchema.safeParse([]).success).toBe(true)
  })

  it("still rejects a malformed step on the read path", () => {
    // Laxer about count, not about shape — a genuinely broken row must still
    // be distinguishable from an empty one.
    expect(storedTestStepsSchema.safeParse([{ action: "no id" }]).success).toBe(false)
    expect(storedTestStepsSchema.safeParse("not an array").success).toBe(false)
  })

  it("does not cap length on the read path", () => {
    // A row could hold more than the form allows — an older cap, or a direct
    // write. Rendering it is better than calling it broken.
    const many = Array.from({ length: 20 }, () => step())
    expect(testStepsSchema.safeParse(many).success).toBe(false)
    expect(storedTestStepsSchema.safeParse(many).success).toBe(true)
  })
})
