import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { disableSubscription, fetchSubscription, isAlreadyOff } from "@/lib/paystack/client"
import { later } from "@/lib/paystack/notify"

// Work owed to Paystack that may fail and must be retried: billing_actions.
// Runs through after() right after something is queued, and in the daily cron.

const LEASE_MS = 5 * 60 * 1000
const BATCH = 50

type Action = { id: string; subscription_code: string | null; email_token: string | null; attempts: number }

/** Returns how many actions finished. Never throws. */
export async function runBillingActions(): Promise<number> {
  const admin = createAdminClient()
  // ponytail: PR 3 adds create_subscription here.
  const { data, error } = await admin
    .from("billing_actions")
    .select("id, subscription_code, email_token, attempts")
    .is("done_at", null)
    .eq("kind", "disable_subscription")
    .limit(BATCH)
  if (error) {
    console.error("[paystack/actions] read failed:", error.message)
    return 0
  }

  let done = 0
  for (const action of (data ?? []) as Action[]) {
    const now = new Date()
    // Claims before it calls: the after() run and the cron sweep can't both
    // work the same row. No row back means another runner has it.
    const { data: claimed } = await admin
      .from("billing_actions")
      .update({ claimed_until: new Date(now.getTime() + LEASE_MS).toISOString(), attempts: action.attempts + 1 })
      .eq("id", action.id)
      .is("done_at", null)
      .or(`claimed_until.is.null,claimed_until.lt.${now.toISOString()}`)
      .select("id")
    if (!claimed?.length) continue

    const failure = await disable(action)
    if (failure) {
      console.error("[paystack/actions] disable failed:", action.subscription_code, failure)
      await admin.from("billing_actions").update({ last_error: failure.slice(0, 500) }).eq("id", action.id)
    } else {
      await admin.from("billing_actions").update({ done_at: new Date().toISOString(), last_error: null }).eq("id", action.id)
      done++
    }
  }
  return done
}

/** null when the subscription is off; otherwise why it may not be. */
async function disable(action: Action): Promise<string | null> {
  if (!action.subscription_code) return "No subscription code"
  let token = action.email_token
  if (!token) {
    const sub = await fetchSubscription(action.subscription_code)
    if (!sub.ok) return isAlreadyOff(sub) ? null : sub.message
    token = sub.data.emailToken
    if (!token) return "Paystack gave no email token"
  }
  const res = await disableSubscription({ code: action.subscription_code, token })
  return res.ok || isAlreadyOff(res) ? null : res.message
}

export const runBillingActionsLater = (): void => later(() => runBillingActions())
