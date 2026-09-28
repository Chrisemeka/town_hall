import { describe, expect, it } from "vitest"
import {
  testerStep1Schema,
  updateProfileSchema,
  verificationStepSchemaFor,
} from "@/lib/validation/schemas"

const BASE = { fullName: "Ada Lovelace", timezone: "Africa/Lagos" }
const step1 = (country: string, phone: string) => testerStep1Schema.safeParse({ ...BASE, country, phone })
const phoneIssue = (r: ReturnType<typeof step1>) =>
  r.success ? undefined : r.error.issues.find((i) => i.path[0] === "phone")

// The fixture from the bug report: every valid number is also possible, so
// .isValid() is not over-strict, and it stays.
const CASES: [country: string, valid: string, invalid: string][] = [
  ["BW", "+267 71234567", "+267 801234567809"],
  ["NG", "+234 801 234 5678", "+234 801 234"],
  ["ZA", "+27 82 123 4567", "+27 82 12"],
  ["GH", "+233 24 123 4567", "+233 24 12"],
  ["KE", "+254 712 345678", "+254 712 34"],
  ["US", "+1 415 555 2671", "+1 415 555"],
]

describe("phone validity per country", () => {
  for (const [country, valid, invalid] of CASES) {
    it(`${country}: accepts ${valid}, rejects ${invalid}`, () => {
      expect(step1(country, valid).success).toBe(true)
      expect(phoneIssue(step1(country, invalid))).toBeDefined()
    })
  }

  it("still rejects the reported number, and says nothing Nigerian", () => {
    const issue = phoneIssue(step1("BW", "+267 801234567809"))
    expect(issue).toBeDefined()
    expect(issue?.message).not.toMatch(/\+234/)
  })

  it("normalises to E.164 on the way through, unchanged", () => {
    const r = step1("NG", "+234 801 234 5678")
    expect(r.success && r.data.phone).toBe("+2348012345678")
  })
})

describe("phone must belong to the selected country", () => {
  it("rejects a Nigerian number with Botswana selected, on the phone field", () => {
    const issue = phoneIssue(step1("BW", "+234 8012345678"))
    expect(issue?.message).toMatch(/Botswana/)
  })

  it("accepts a +1 number with the US and with Canada selected", () => {
    // Calling-code comparison: the parser names +1 415 as US only, and a
    // Canadian with that number must not be refused.
    expect(step1("US", "+1 415 555 2671").success).toBe(true)
    expect(step1("CA", "+1 415 555 2671").success).toBe(true)
  })

  it("does not report a mismatch for a country with no metadata", () => {
    // BV is selectable with no calling code; the check has nothing to compare.
    expect(phoneIssue(step1("BV", "+234 801 234 5678"))).toBeUndefined()
  })

  it("keeps the step save buildable, partial, and checked", () => {
    // Zod 4 throws on .partial() of a refined object — this would throw at
    // build time if the refine went on before .partial().
    const schema = verificationStepSchemaFor("tester")
    expect(schema.safeParse({}).success).toBe(true)
    expect(schema.safeParse({ phone: "+234 801 234 5678" }).success).toBe(true)
    expect(schema.safeParse({ country: "BW", phone: "+234 801 234 5678" }).success).toBe(false)
    expect(verificationStepSchemaFor("builder").safeParse({ country: "NG", phone: "+234 801 234 5678" }).success).toBe(true)
  })

  it("applies to the profile editor too", () => {
    expect(updateProfileSchema.safeParse({ country: "BW", phone: "+234 801 234 5678" }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ country: "NG", phone: "+234 801 234 5678" }).success).toBe(true)
  })
})
