import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { CLOSED_GRACE, graceAllows, startToken, verifyStartToken } from "@/lib/reportStart"
import { sign } from "@/lib/signing"

const M = "33333333-3333-4333-8333-333333333333"
const T = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const AT = Date.parse("2026-11-01T10:00:00Z")

beforeEach(() => vi.stubEnv("SIGNING_SECRET", "test-secret"))
afterEach(() => vi.unstubAllEnvs())

describe("start tokens", () => {
  it("round-trips to the time it was issued", () => {
    expect(verifyStartToken(startToken(M, T, AT), M, T)).toBe(AT)
  })

  it("fails for another mission or another tester", () => {
    const t = startToken(M, T, AT)
    expect(verifyStartToken(t, OTHER, T)).toBeNull()
    expect(verifyStartToken(t, M, OTHER)).toBeNull()
  })

  it("fails with a moved issuedAt or a tampered signature", () => {
    const [, sig] = startToken(M, T, AT).split(".")
    expect(verifyStartToken(`${AT - 60_000}.${sig}`, M, T)).toBeNull()
    expect(verifyStartToken(`${AT}.${(sig[0] === "a" ? "b" : "a") + sig.slice(1)}`, M, T)).toBeNull()
  })

  it("fails for anything malformed, or no token at all", () => {
    for (const bad of [undefined, null, "", "abc", `${AT}`, `${AT}.`, `x.${"a".repeat(64)}`, `${startToken(M, T, AT)}.extra`]) {
      expect(verifyStartToken(bad, M, T)).toBeNull()
    }
  })

  it("fails for a signature minted for another purpose", () => {
    const other = sign("tester-digest:", `${M}:${T}:${AT}`)
    expect(verifyStartToken(`${AT}.${other}`, M, T)).toBeNull()
  })

  it("compares in constant time, through lib/signing", () => {
    expect(readFileSync("lib/signing.ts", "utf8")).toContain("timingSafeEqual(")
    expect(readFileSync("lib/reportStart.ts", "utf8")).toContain("verifySigned(")
  })
})

describe("graceAllows", () => {
  const CLOSED = "2026-11-01T12:00:00.000Z"
  const closedMs = Date.parse(CLOSED)

  it("takes a report started before the close and arriving inside the grace", () => {
    expect(graceAllows(AT, CLOSED, closedMs + 60_000)).toBe(true)
    expect(graceAllows(AT, CLOSED, closedMs + CLOSED_GRACE)).toBe(true)
  })

  it("refuses one started after the close", () => {
    expect(graceAllows(closedMs + 1, CLOSED, closedMs + 60_000)).toBe(false)
  })

  it("refuses one arriving after the grace", () => {
    expect(graceAllows(AT, CLOSED, closedMs + CLOSED_GRACE + 1)).toBe(false)
  })

  it("gives no grace without a token, or without a recorded close", () => {
    expect(graceAllows(null, CLOSED, closedMs)).toBe(false)
    expect(graceAllows(AT, null, closedMs)).toBe(false)
  })

  it("is 24 hours", () => {
    expect(CLOSED_GRACE).toBe(86_400_000)
  })
})
