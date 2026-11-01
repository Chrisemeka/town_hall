"use server"

import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAccount } from "@/lib/auth"
import { recordEvent } from "@/lib/events"
import { checkRateLimit, clientIp } from "@/lib/rateLimitDb"
import { tooManyMessage } from "@/lib/rateLimit"
import { unsubscribeByLink } from "@/lib/unsubscribe"
import { digestEmailSchema, renderedAtSchema } from "@/lib/validation/schemas"

/**
 * Clears the Available Test Cases counter up to when the page was rendered —
 * not clicked: anything published between the render and the mount stays new,
 * because the tester has not seen it. Called on mount by MarkMissionsSeen,
 * never during the page render, which a link prefetch can trigger for a page
 * nobody opened.
 *
 * Only ever forward, and never past now: a client claiming a future time is
 * clamped. The conditional update makes "forward only" atomic without an RPC.
 */
export async function markMissionsSeen(renderedAt: string): Promise<void> {
  const { userId } = await requireAccount("tester")
  const parsed = renderedAtSchema.safeParse(renderedAt)
  if (!parsed.success) return

  const at = new Date(Math.min(Date.parse(parsed.data), Date.now())).toISOString()
  const { error } = await createAdminClient()
    .from("accounts")
    .update({ missions_seen_at: at })
    .eq("user_id", userId)
    .eq("type", "tester")
    .lt("missions_seen_at", at)
  if (error) console.error("[markMissionsSeen] update failed:", error.message)
}

/**
 * The Settings switch for the daily digest. Turning it back on also moves
 * digest_through to now, so switching on later never sends a backlog.
 */
export async function setDigestEmail(on: boolean): Promise<{ ok: boolean }> {
  const { userId } = await requireAccount("tester")
  const parsed = digestEmailSchema.safeParse(on)
  if (!parsed.success) return { ok: false }

  const now = new Date().toISOString()
  const { error } = await createAdminClient()
    .from("accounts")
    .update(parsed.data ? { digest_opted_out_at: null, digest_through: now } : { digest_opted_out_at: now })
    .eq("user_id", userId)
    .eq("type", "tester")
  if (error) {
    console.error("[setDigestEmail] update failed:", error.message)
    return { ok: false }
  }
  await recordEvent({
    name: parsed.data ? "notifications.digest_on" : "notifications.digest_off",
    profileId: userId,
    accountType: "tester",
    props: { source: "settings" },
  })
  return { ok: true }
}

export type UnsubscribeState = { status: "idle" | "done" | "invalid" | "limited"; message?: string }

/**
 * The /unsubscribe page's button — the only way that page writes. The page
 * itself is a GET and never unsubscribes: mail scanners and link previews open
 * every link in an email. No sign-in: the token is the authority.
 */
export async function unsubscribeFromEmail(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const rate = await checkRateLimit(["unsubscribe:ip", clientIp(await headers())])
  if (!rate.ok) return { status: "limited", message: tooManyMessage(rate.retryAfter) }
  return (await unsubscribeByLink(formData.get("a"), formData.get("t"))) ? { status: "done" } : { status: "invalid" }
}
