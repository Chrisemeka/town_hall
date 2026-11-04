import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { safeEqual, verifyPaystackSignature } from "@/lib/paystack/signature"

// The rules that decide whether an unauthenticated POST may move money. Ported
// from the payments-wip tag's scripts/processors.test.mts.

const SECRET = "sk_test_paystack_secret"
const BODY = JSON.stringify({ event: "charge.success", data: { reference: "twnhall-sub-abc" } })
const SIG = createHmac("sha512", SECRET).update(BODY, "utf8").digest("hex")

describe("safeEqual", () => {
  it("compares, and doesn't throw on unequal lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true)
    expect(safeEqual("abc", "abd")).toBe(false)
    expect(safeEqual("abc", "abcd")).toBe(false)
    expect(safeEqual("", "")).toBe(true)
  })
})

describe("verifyPaystackSignature", () => {
  it("passes a valid signature", () => {
    expect(verifyPaystackSignature(BODY, SIG, SECRET)).toBe(true)
  })

  it("fails a missing header, an empty secret or one changed character", () => {
    expect(verifyPaystackSignature(BODY, null, SECRET)).toBe(false)
    expect(verifyPaystackSignature(BODY, "", SECRET)).toBe(false)
    expect(verifyPaystackSignature(BODY, SIG, "")).toBe(false)
    expect(verifyPaystackSignature(BODY, SIG.replace(/.$/, SIG.endsWith("0") ? "1" : "0"), SECRET)).toBe(false)
  })

  it("fails re-serialised JSON: the body is signed byte for byte", () => {
    expect(verifyPaystackSignature(JSON.stringify(JSON.parse(BODY), null, 2), SIG, SECRET)).toBe(false)
  })

  it("fails the wrong key, and a short header without throwing", () => {
    expect(verifyPaystackSignature(BODY, createHmac("sha512", "wrong").update(BODY).digest("hex"), SECRET)).toBe(false)
    expect(verifyPaystackSignature(BODY, "abc", SECRET)).toBe(false)
  })
})
