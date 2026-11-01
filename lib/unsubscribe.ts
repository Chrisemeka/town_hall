import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { recordEvent } from "@/lib/events"
import { sign, verifySigned } from "@/lib/signing"
import { unsubscribeSchema } from "@/lib/validation/schemas"

// The daily digest's unsubscribe token: HMAC-SHA256 over a purpose prefix and
// the tester account id, keyed by SIGNING_SECRET (lib/signing.ts). It never
// expires — an unsubscribe link in any old email must still work — and the
// prefix scopes it to this one email, so it cannot be replayed against
// anything else.

const PURPOSE = "tester-digest:"

/**
 * Throws when SIGNING_SECRET is missing — loud, not a fallback key: a digest
 * sent without a working unsubscribe is worse than no digest. The cron step
 * that calls this catches and reports it.
 */
export function unsubscribeToken(accountId: string): string {
  return sign(PURPOSE, accountId)
}

/** Constant-time. False for anything malformed, and when the secret is missing. */
export function verifyUnsubscribe(accountId: string, token: string): boolean {
  return verifySigned(PURPOSE, accountId, token)
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
