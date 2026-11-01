import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { unsubscribeLinks, unsubscribeToken, verifyUnsubscribe } from "@/lib/unsubscribe"

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"

beforeEach(() => vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret-long-and-random"))
afterEach(() => vi.unstubAllEnvs())

describe("unsubscribe tokens", () => {
  it("round-trips", () => {
    expect(verifyUnsubscribe(A, unsubscribeToken(A))).toBe(true)
  })

  it("fails for another account", () => {
    expect(verifyUnsubscribe(B, unsubscribeToken(A))).toBe(false)
  })

  it("fails when tampered, or malformed", () => {
    const t = unsubscribeToken(A)
    const flipped = (t[0] === "a" ? "b" : "a") + t.slice(1)
    expect(verifyUnsubscribe(A, flipped)).toBe(false)
    expect(verifyUnsubscribe(A, t.slice(1))).toBe(false)
    expect(verifyUnsubscribe(A, "")).toBe(false)
  })

  it("compares in constant time", () => {
    expect(readFileSync("lib/unsubscribe.ts", "utf8")).toContain("timingSafeEqual(")
  })

  it("fails for a token signed for another purpose", () => {
    const other = createHmac("sha256", "test-secret-long-and-random").update("password-reset:" + A).digest("hex")
    expect(verifyUnsubscribe(A, other)).toBe(false)
  })

  it("fails closed when the secret is missing, and refuses to mint one", () => {
    const t = unsubscribeToken(A)
    vi.stubEnv("UNSUBSCRIBE_SECRET", "")
    expect(verifyUnsubscribe(A, t)).toBe(false)
    expect(() => unsubscribeToken(A)).toThrow(/UNSUBSCRIBE_SECRET/)
  })

  it("builds absolute page and one-click links carrying a token that verifies", () => {
    const { page, oneClick } = unsubscribeLinks(A, "https://www.twnhall.com")
    expect(page.startsWith("https://www.twnhall.com/unsubscribe?a=")).toBe(true)
    expect(oneClick.startsWith("https://www.twnhall.com/api/unsubscribe?a=")).toBe(true)
    const t = new URL(oneClick).searchParams.get("t")!
    expect(verifyUnsubscribe(new URL(oneClick).searchParams.get("a")!, t)).toBe(true)
  })
})
