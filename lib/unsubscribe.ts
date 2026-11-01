import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

// The daily digest's unsubscribe token: HMAC-SHA256 over a purpose prefix and
// the tester account id, keyed by UNSUBSCRIBE_SECRET (server-only, never
// NEXT_PUBLIC_). It never expires — an unsubscribe link in any old email must
// still work — and the prefix scopes it to this one email, so it cannot be
// replayed against anything else.

const PURPOSE = "tester-digest:"

function sign(accountId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET
  // Loud, not a fallback key: a digest sent without a working unsubscribe is
  // worse than no digest. The cron step that calls this catches and reports it.
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not set")
  return createHmac("sha256", secret).update(PURPOSE + accountId).digest("hex")
}

export function unsubscribeToken(accountId: string): string {
  return sign(accountId)
}

/** Constant-time. False for anything malformed, and when the secret is missing. */
export function verifyUnsubscribe(accountId: string, token: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(token)) return false
  let expected: string
  try {
    expected = sign(accountId)
  } catch {
    return false
  }
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"))
}

/**
 * The page a person opens from the email (it asks first), and the RFC 8058
 * one-click endpoint Gmail's own Unsubscribe button posts to.
 */
export function unsubscribeLinks(accountId: string, site: string): { page: string; oneClick: string } {
  const query = `a=${encodeURIComponent(accountId)}&t=${unsubscribeToken(accountId)}`
  return { page: `${site}/unsubscribe?${query}`, oneClick: `${site}/api/unsubscribe?${query}` }
}
