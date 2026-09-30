import { describe, expect, it } from "vitest"
import {
  RATE_LIMITS,
  hitMemory,
  normaliseEmail,
  rateLimitKey,
  retryAfterSeconds,
  tooManyMessage,
  type MemoryBuckets,
} from "@/lib/rateLimit"

// A window boundary, so arithmetic is readable: 3600 divides it.
const T0 = 1_800_000_000_000 - (1_800_000_000_000 % 3_600_000)

describe("hitMemory — the fixed window", () => {
  it("passes under the limit, refuses the next, passes again in the next window", () => {
    const b: MemoryBuckets = new Map()
    for (let i = 0; i < 3; i++) expect(hitMemory(b, "k", 3, 3600, T0 + i).ok).toBe(true)
    expect(hitMemory(b, "k", 3, 3600, T0 + 10)).toEqual({ ok: false, retryAfter: 3600 })
    expect(hitMemory(b, "k", 3, 3600, T0 + 3_600_000).ok).toBe(true)
  })

  it("keys are independent — sign-in's IP and email buckets", () => {
    const b: MemoryBuckets = new Map()
    const ip = rateLimitKey("signin:ip", "1.2.3.4")
    const email = rateLimitKey("signin:email", "a@b.com")
    expect(hitMemory(b, email, 1, 900, T0).ok).toBe(true)
    expect(hitMemory(b, email, 1, 900, T0).ok).toBe(false)
    expect(hitMemory(b, ip, 1, 900, T0).ok).toBe(true)
  })
})

describe("retryAfterSeconds", () => {
  it("counts to the end of the window and is never 0", () => {
    expect(retryAfterSeconds(T0, 3600)).toBe(3600)
    expect(retryAfterSeconds(T0 + 3_599_000, 3600)).toBe(1)
  })
})

describe("normaliseEmail", () => {
  it("puts Test@x.com and test@x.com in one bucket", () => {
    expect(rateLimitKey("signin:email", normaliseEmail(" Test@X.com "))).toBe(
      rateLimitKey("signin:email", normaliseEmail("test@x.com")),
    )
  })
})

describe("RATE_LIMITS", () => {
  it("every degrade rule's fallback is stricter than its limit but still lets someone in", () => {
    for (const [name, rule] of Object.entries(RATE_LIMITS)) {
      if (rule.mode !== "degrade") continue
      expect(rule.fallback, name).toBeGreaterThan(0)
      expect(rule.fallback, name).toBeLessThan(rule.limit)
    }
  })

  it("the cost-bearing rules fail closed", () => {
    for (const name of ["submit:account", "publish:account", "project:account", "export:account"] as const) {
      expect(RATE_LIMITS[name].mode).toBe("closed")
    }
  })
})

describe("tooManyMessage", () => {
  it("says when, in plain words, and never the limit or the window", () => {
    expect(tooManyMessage(30)).toBe("Too many attempts. Try again in a minute.")
    expect(tooManyMessage(600)).toBe("Too many attempts. Try again in 10 minutes.")
    for (const rule of Object.values(RATE_LIMITS)) {
      const msg = tooManyMessage(rule.windowSeconds)
      expect(msg).not.toContain(String(rule.limit))
      expect(msg).not.toContain(String(rule.windowSeconds))
      expect(msg).not.toMatch(/ of |seconds|attempts left/)
    }
  })
})
