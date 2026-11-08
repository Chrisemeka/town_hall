import "server-only"

import { applySubscription } from "@/lib/billing"
import { billingNotice } from "@/lib/subscriptions"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapSubscription, mapTransaction } from "@/lib/paystack/client"
import { planIdForCode } from "@/lib/paystack/config"
import { settleCharge } from "@/lib/paystack/charges"
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
  // A different code on the row: a late event for an older subscription.
  if (!active || (active.provider_subscription_id && active.provider_subscription_id !== sub.subscriptionCode)) return "unmatched"

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
    default:
      return "ignored"
  }
}
