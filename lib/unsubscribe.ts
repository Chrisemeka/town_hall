import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordEvent } from "@/lib/events"
import { unsubscribeSchema } from "@/lib/validation/schemas"

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

/**
 * Opts the account out, if the link is good. One answer for a bad link and a
 * missing account alike — false — so neither path can be used to learn whether
 * an account exists. Opting out twice is still true. Used by the /unsubscribe
 * page's button and by the one-click POST; a GET never reaches this.
 */
export async function unsubscribeByLink(a: unknown, t: unknown): Promise<boolean> {
  const parsed = unsubscribeSchema.safeParse({ a, t })
  if (!parsed.success || !verifyUnsubscribe(parsed.data.a, parsed.data.t)) return false

  const { data, error } = await createAdminClient()
    .from("accounts")
    .update({ digest_opted_out_at: new Date().toISOString() })
    .eq("id", parsed.data.a)
    .eq("type", "tester")
    .is("digest_opted_out_at", null)
    .select("user_id")
  if (error) {
    console.error("[unsubscribe] update failed:", error.message)
    return false
  }
  const row = data?.[0]
  if (row) {
    await recordEvent({
      name: "notifications.digest_off",
      profileId: row.user_id as string,
      accountType: "tester",
      props: { source: "email" },
    })
  }
  return true
}
