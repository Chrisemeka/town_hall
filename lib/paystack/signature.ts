// Webhook signature verification, ported by hand from the payments-wip tag.
//
// A webhook endpoint is a public URL that moves money: anyone can POST to it,
// so the signature is the only thing separating a real payment notification
// from someone typing one. Verified against the RAW body — parsing first and
// re-serialising changes the bytes and the signature no longer matches.

import { createHmac, timingSafeEqual } from "node:crypto"

/** Constant-time compare that tolerates unequal lengths.
 *
 *  timingSafeEqual throws when the buffers differ in size, and a plain `===`
 *  leaks the position of the first wrong byte to anyone who can measure it. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Paystack signs the raw body with HMAC-SHA512 keyed on the secret key itself
 * (not a separate signing secret) and sends it as `x-paystack-signature`.
 */
export function verifyPaystackSignature(rawBody: string, header: string | null, secretKey: string): boolean {
  if (!header || !secretKey) return false
  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest("hex")
  return safeEqual(expected, header)
}
