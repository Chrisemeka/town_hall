import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createSubscriptionFrom, disableSubscription, fetchSubscription, isAlreadyOff, listSubscriptions } from "@/lib/paystack/client"
import { planCodeFor } from "@/lib/paystack/config"
import { later } from "@/lib/paystack/notify"

// Work owed to Paystack that may fail and must be retried: billing_actions.
// Runs through after() right after something is queued, and in the daily cron.

const LEASE_MS = 5 * 60 * 1000
const BATCH = 50

type Action = {
  id: string
  kind: string
  profile_id: string
  subscription_code: string | null
  email_token: string | null
  payload: Record<string, unknown> | null
  attempts: number
  created_at: string
}

/** Returns how many actions finished. Never throws. */
export async function runBillingActions(): Promise<number> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("billing_actions")
    .select("id, kind, profile_id, subscription_code, email_token, payload, attempts, created_at")
    .is("done_at", null)
    .in("kind", ["disable_subscription", "create_subscription"])
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

    let failure: string | null
    try {
      failure = action.kind === "create_subscription" ? await create(action) : await disable(action)
    } catch (err) {
      failure = err instanceof Error ? err.message : "failed"
    }
    if (failure) {
      console.error("[paystack/actions]", action.kind, "failed:", action.subscription_code, failure)
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

/**
 * A downgrade's Starter subscription, which Paystack refused to create at the
 * time (SPEC-paystack-plan-changes §4). `subscription_code` is the Pro one: the
 * card's authorization is fetched from it again, never stored. One already made
 * by an attempt whose answer was lost is adopted, not made twice. null when
 * there's nothing left to do.
 */
async function create(action: Action): Promise<string | null> {
  const admin = createAdminClient()
  const plan = String(action.payload?.plan ?? "starter") as "starter" | "pro"
  const startDate = String(action.payload?.start_date ?? "")
  const customer = typeof action.payload?.customer === "string" ? action.payload.customer : null
  if (!action.subscription_code || !startDate) return "No subscription to copy the card from"

  const { data: scheduled, error } = await admin
    .from("subscriptions")
    .select("id, plan_id, provider_subscription_id")
    .eq("profile_id", action.profile_id)
    .eq("status", "scheduled")
    .maybeSingle()
  if (error) return error.message
  // Cancelled since, or already made: nothing to create.
  if (!scheduled || scheduled.plan_id !== plan || scheduled.provider_subscription_id) return null

  const planCode = planCodeFor(plan)
  let made = null as { subscriptionCode: string | null; emailToken: string | null } | null
  if (customer) {
    const existing = await listSubscriptions({ customer, plan: planCode })
    if (!existing.ok) return existing.message
    made = existing.data.find((s) => s.status === "active" && s.createdAt && Date.parse(s.createdAt) >= Date.parse(action.created_at)) ?? null
  }
  if (!made) {
    const res = await createSubscriptionFrom({ fromCode: action.subscription_code, planCode, startDate })
    if (!res.ok) return res.message
    made = res.data
  }

  await admin
    .from("subscriptions")
    .update({ provider_subscription_id: made.subscriptionCode, provider_email_token: made.emailToken, provider_plan_code: planCode })
    .eq("id", scheduled.id)
    .is("provider_subscription_id", null)
  return null
}

export const runBillingActionsLater = (): void => later(() => runBillingActions())
