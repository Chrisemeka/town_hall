import "server-only"

import { applySubscription } from "@/lib/billing"
import { billingNotice } from "@/lib/subscriptions"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSubscription, mapSubscription, mapTransaction } from "@/lib/paystack/client"
import { runBillingActionsLater } from "@/lib/paystack/actions"
import { planIdForCode } from "@/lib/paystack/config"
import { settleCharge } from "@/lib/paystack/charges"
import { handleRefundEvent } from "@/lib/paystack/refunds"
import { emailBuilder, site } from "@/lib/paystack/notify"
import { planIdFor } from "@/lib/vocabulary"
import { eventFields, type PaystackOutcome } from "@/lib/paystack/eventFields"

export { eventFields, type PaystackOutcome }

// What a verified Paystack webhook does. A throw is a 500 and a redelivery, so
// every handler is safe to run twice: a second delivery finds the payment
// reference, the codes already attached, or the change already scheduled.

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {})

type Row = {
  profile_id: string
  plan_id: string
  period_end: string | null
  provider_status: string | null
  provider_subscription_id: string | null
}
const COLUMNS = "profile_id, plan_id, period_end, provider_status, provider_subscription_id"

async function activeByCode(code: string | null): Promise<Row | null> {
  if (!code) return null
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .select(COLUMNS)
    .eq("status", "active")
    .eq("source", "paystack")
    .eq("provider_subscription_id", code)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Row | null
}

/** Paystack made the subscription: fill in the codes the charge couldn't know. */
async function subscriptionCreated(data: unknown): Promise<PaystackOutcome> {
  const sub = mapSubscription(data)
  const planId = planIdForCode(sub.planCode)
  if (!sub.customerCode || !planId || !sub.subscriptionCode) return "unmatched"

  const { data: row, error } = await createAdminClient()
    .from("subscriptions")
    .select(COLUMNS)
    .eq("status", "active")
    .eq("source", "paystack")
    .eq("provider_customer_id", sub.customerCode)
    .eq("plan_id", planId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const active = row as Row | null
  // No row yet: this routinely beats the charge, whose own fetch fills it.
  // A different code on the row: a late event for an older subscription, or the
  // subscription a duplicate charge made before Paystack had sent its code.
  if (!active || (active.provider_subscription_id && active.provider_subscription_id !== sub.subscriptionCode)) {
    await switchOffUnwanted(sub.subscriptionCode, sub.emailToken)
    return "unmatched"
  }

  const result = await applySubscription({
    action: "attach",
    userId: active.profile_id,
    source: "paystack",
    periodEnd: sub.nextPaymentDate,
    providerSubscriptionId: sub.subscriptionCode,
    providerEmailToken: sub.emailToken,
    providerPlanCode: sub.planCode,
    providerStatus: sub.status,
    cardLast4: sub.card.last4,
    cardBrand: sub.card.brand,
  })
  return result === "ok" ? "settled" : "unmatched"
}

/**
 * A subscription whose own charge we recorded as a duplicate or stray (§7) is
 * switched off, even when its code arrived only now. Anything else is left
 * alone: nothing here guesses which subscription to stop.
 */
async function switchOffUnwanted(code: string, token: string | null): Promise<void> {
  const full = await fetchSubscription(code)
  const refs = full.ok ? full.data.invoiceReferences : []
  if (!refs.length) return
  const admin = createAdminClient()
  const { data: unwanted, error } = await admin.from("subscription_payments").select("profile_id").in("reference", refs).in("kind", ["duplicate", "stray"]).limit(1)
  if (error) throw new Error(error.message)
  const profileId = unwanted?.[0]?.profile_id
  if (!profileId) return
  // ponytail: written here rather than through apply_subscription, because no plan changes; the key keeps it to one.
  await admin
    .from("billing_actions")
    .upsert(
      { kind: "disable_subscription", profile_id: profileId, subscription_code: code, email_token: token ?? (full.ok ? full.data.emailToken : null), idempotency_key: `disable:${code}` },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    )
  runBillingActionsLater()
}

async function paymentFailed(data: unknown): Promise<PaystackOutcome> {
  const row = await activeByCode(mapSubscription(obj(data).subscription).subscriptionCode)
  if (!row) return "unmatched"
  if (row.provider_status === "attention") return "duplicate"

  const result = await applySubscription({ action: "attach", userId: row.profile_id, source: "paystack", providerStatus: "attention" })
  if (result !== "ok") return "unmatched"
  emailBuilder(row.profile_id, "subscription-payment-failed", billingNotice("payment_failed", planIdFor(row.plan_id), { periodEnd: row.period_end, site: site() }))
  return "settled"
}

/**
 * Cancelled at Paystack: by our Cancel (already scheduled), on Paystack's hosted
 * page, or by Paystack. It matches on the exact code, because disabling a
 * subscription a newer one replaced also lands here, and that ends nothing.
 */
async function subscriptionStopped(data: unknown): Promise<PaystackOutcome> {
  const row = await activeByCode(mapSubscription(data).subscriptionCode)
  if (!row) return "duplicate"
  // Our own Switch to Starter turned it off; scheduleDowngrade() schedules Starter.
  if (row.provider_status === "switching") return "duplicate"

  const { data: scheduled, error } = await createAdminClient()
    .from("subscriptions")
    .select("id")
    .eq("profile_id", row.profile_id)
    .eq("status", "scheduled")
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (scheduled) return "duplicate"

  const result = await applySubscription({
    action: "schedule",
    userId: row.profile_id,
    planId: "community",
    source: "paystack",
    reason: "Cancelled at Paystack",
  })
  if (result !== "ok") return "unmatched"
  emailBuilder(row.profile_id, "subscription-cancelled", billingNotice("cancelled", planIdFor(row.plan_id), { periodEnd: row.period_end, site: site() }))
  return "settled"
}

/**
 * subscription.expiring_cards: each of our renewing subscriptions named gets one
 * email asking for a new card, linking the page that fetches a fresh Paystack link.
 * ponytail: a redelivery emails again; Paystack sends this monthly, so a second
 * copy is the worst case. Key it on app_events if that ever matters.
 */
async function cardsExpiring(data: unknown): Promise<PaystackOutcome> {
  const codes = (Array.isArray(data) ? data : [])
    .map((d) => mapSubscription(obj(d).subscription).subscriptionCode)
    .filter((c): c is string => !!c)
  if (!codes.length) return "ignored"
  const { data: rows, error } = await createAdminClient()
    .from("subscriptions")
    .select("profile_id, plan_id, provider_status, card_last4")
    .eq("status", "active")
    .eq("source", "paystack")
    .in("provider_subscription_id", codes)
  if (error) throw new Error(error.message)
  for (const r of rows ?? []) {
    emailBuilder(r.profile_id, "card-expiring", billingNotice("card_expiring", planIdFor(r.plan_id), { cardLast4: r.card_last4, site: site() }))
  }
  return rows?.length ? "settled" : "unmatched"
}

export async function handlePaystackEvent(event: unknown): Promise<PaystackOutcome> {
  const root = obj(event)
  switch (root.event) {
    case "charge.success":
      return settleCharge(mapTransaction(root.data))
    case "subscription.create":
      return subscriptionCreated(root.data)
    case "invoice.payment_failed":
      return paymentFailed(root.data)
    case "subscription.not_renew":
    case "subscription.disable":
      return subscriptionStopped(root.data)
    case "subscription.expiring_cards":
      return cardsExpiring(root.data)
    case "refund.pending":
    case "refund.processing":
    case "refund.needs-attention":
    case "refund.processed":
    case "refund.failed":
      return handleRefundEvent(root.event, root.data)
    default:
      return "ignored"
  }
}
