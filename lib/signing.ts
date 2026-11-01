import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

// One secret for every signed value the app hands out, each scoped by its
// purpose prefix so a token minted for one thing can never verify as another:
// "tester-digest:" (lib/unsubscribe.ts) and "report-start:" (lib/reportStart.ts).
// SIGNING_SECRET is server-only, never NEXT_PUBLIC_. Changing it invalidates
// every token already handed out — every unsubscribe link ever sent included.

/** HMAC-SHA256, hex. Throws when the secret is missing: nothing is signed with a fallback key. */
export function sign(purpose: string, message: string): string {
  const secret = process.env.SIGNING_SECRET
  if (!secret) throw new Error("SIGNING_SECRET is not set")
  return createHmac("sha256", secret).update(purpose + message).digest("hex")
}

/** Constant-time. False for anything malformed, and when the secret is missing. */
export function verifySigned(purpose: string, message: string, signature: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(signature)) return false
  let expected: string
  try {
    expected = sign(purpose, message)
  } catch {
    return false
  }
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))
}
