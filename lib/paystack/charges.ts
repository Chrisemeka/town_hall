import "server-only"

import { applySubscription, type BillingAction } from "@/lib/billing"
import { recordEvent } from "@/lib/events"
import { PLANS } from "@/lib/plans"
import { billingNotice, disableActionFor, provisionalPeriodEnd } from "@/lib/subscriptions"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSubscription, listSubscriptions, type PaystackSubscription, type PaystackTransaction } from "@/lib/paystack/client"
import { planIdForCode } from "@/lib/paystack/config"
import { emailBuilder, later, site } from "@/lib/paystack/notify"
import { runBillingActions } from "@/lib/paystack/actions"

// settleCharge(): the ONE place a charge becomes a plan. The return page and the
// webhook both call it, and whichever lands second gets 'duplicate' from
// apply_subscription, under the account lock.

export type SettleOutcome = "settled" | "duplicate" | "unmatched" | "mismatch" | "duplicate_charge"

/** Outcomes that mean money arrived and no plan came of it: billing_mismatch. */
export const BILLING_PROBLEMS: readonly string[] = ["unmatched", "mismatch", "duplicate_charge"]

type ActiveRow = {
  id: string
  account_id: string | null
  profile_id: string
  plan_id: string
  source: string
  payment_reference: string | null
  period_end: string | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
  provider_email_token: string | null
  card_last4: string | null
}

const ACTIVE_COLUMNS =
  "id, account_id, profile_id, plan_id, source, payment_reference, period_end, provider_customer_id, provider_subscription_id, provider_email_token, card_last4"

/** A date Paystack gave that is really ahead of this charge, or a month on from it. */
function periodEndFrom(next: string | null, paidAt: string | null): string {
  const paid = paidAt ?? new Date().toISOString()
  return next && Date.parse(next) > Date.parse(paid) ? next : provisionalPeriodEnd(paid)
}

/** Newest active subscription for this customer and plan, if Paystack has made it yet. */
async function findSubscription(customer: string | null, planCode: string | null): Promise<PaystackSubscription | null> {
  if (!customer || !planCode) return null
  const res = await listSubscriptions({ customer, plan: planCode })
  return res.ok ? (res.data.find((s) => s.status === "active" && s.subscriptionCode) ?? null) : null
}

export async function settleCharge(tx: PaystackTransaction): Promise<SettleOutcome> {
  // Underpayment is the attack; overpayment is a pricing change mid-checkout.
  // Neither is automatic.
  const planId = planIdForCode(tx.planCode)
  if (tx.status !== "success" || tx.currency !== "NGN" || !planId || !tx.reference || tx.amountNgn !== PLANS[planId].amountNgn) {
    console.error("[paystack/settle] refused:", tx.reference, tx.status, tx.currency, tx.amountNgn)
    return "mismatch"
  }

  const admin = createAdminClient()
  const { data: checkout, error } = await admin
    .from("paystack_checkouts")
    .select("reference, profile_id, plan_id, kind, replaces_subscription_id, completed_at")
    .eq("reference", tx.reference)
    .maybeSingle()
  if (error) throw new Error(error.message)

  return checkout ? settleFirstCharge(tx, planId, checkout) : settleRenewal(tx, planId)
}

async function settleFirstCharge(
  tx: PaystackTransaction,
  planId: "starter" | "pro",
  checkout: { reference: string; profile_id: string; plan_id: string; kind: string; replaces_subscription_id: string | null; completed_at: string | null },
): Promise<SettleOutcome> {
  if (tx.metadata.profile_id !== checkout.profile_id || checkout.plan_id !== planId) {
    console.error("[paystack/settle] checkout disagrees with the charge:", tx.reference)
    return "mismatch"
  }
  if (checkout.completed_at) return "duplicate"

  const admin = createAdminClient()
  const complete = () => admin.from("paystack_checkouts").update({ completed_at: new Date().toISOString() }).eq("reference", checkout.reference)

  const { data, error } = await admin
    .from("subscriptions")
    .select(ACTIVE_COLUMNS)
    .eq("profile_id", checkout.profile_id)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw new Error(error.message)
  const active = data as ActiveRow | null

  // Two tabs both paid, or a superseded page was paid. Never a plan change: the
  // money stays on the alert until a person refunds it (PR 3 makes that
  // automatic). Its own reference on the row is a race with the other path, not
  // a second payment, and a replaced row is what a resubscribe is for.
  if (
    active?.source === "paystack" &&
    active.payment_reference !== checkout.reference &&
    active.id !== checkout.replaces_subscription_id
  ) {
    console.error("[paystack/settle] duplicate charge:", checkout.reference)
    await complete()
    return "duplicate_charge"
  }

  const sub = await findSubscription(tx.customerCode, tx.planCode)
  const periodEnd = periodEndFrom(sub?.nextPaymentDate ?? null, tx.paidAt)

  // The failed subscription would otherwise be retried a month from now. Queued
  // with the payment or not at all.
  const actions: BillingAction[] = checkout.kind === "resubscribe" && active ? disableActionFor(active) : []

  const result = await applySubscription({
    action: "start",
    userId: checkout.profile_id,
    planId,
    source: "paystack",
    periodEnd,
    amountNgn: tx.amountNgn,
    paymentReference: checkout.reference,
    paymentKind: checkout.kind === "new" ? "first" : checkout.kind,
    reason: "Paystack subscription",
    providerCustomerId: tx.customerCode,
    providerSubscriptionId: sub?.subscriptionCode ?? tx.subscriptionCode,
    providerEmailToken: sub?.emailToken ?? null,
    providerPlanCode: tx.planCode,
    providerStatus: sub?.status ?? "active",
    cardLast4: tx.card.last4,
    cardBrand: tx.card.brand,
    actions,
  })

  if (result === "duplicate") {
    await complete()
    return "duplicate"
  }
  if (result !== "ok") return "unmatched"

  await complete()
  if (actions.length) later(() => runBillingActions())
  await recordEvent({ name: "plan.changed", profileId: checkout.profile_id, accountType: "builder", props: { from: active?.plan_id ?? "community", to: planId, source: "paystack" } })
  emailBuilder(checkout.profile_id, "subscription-started", billingNotice("started", planId, { periodEnd, cardLast4: tx.card.last4, site: site() }))
  return "settled"
}

async function settleRenewal(tx: PaystackTransaction, planId: "starter" | "pro"): Promise<SettleOutcome> {
  const admin = createAdminClient()
  const base = () => admin.from("subscriptions").select(ACTIVE_COLUMNS).eq("status", "active").eq("source", "paystack").limit(1)

  let row: ActiveRow | null = null
  if (tx.customerCode) {
    const { data, error } = await base().eq("provider_customer_id", tx.customerCode).eq("plan_id", planId).maybeSingle()
    if (error) throw new Error(error.message)
    row = data as ActiveRow | null
  }
  if (!row && tx.subscriptionCode) {
    const { data, error } = await base().eq("provider_subscription_id", tx.subscriptionCode).maybeSingle()
    if (error) throw new Error(error.message)
    row = data as ActiveRow | null
  }
  if (!row) return "unmatched"
  // A charge from a different subscription than the one this plan is on: an old
  // one that should be off. It renews nothing.
  if (tx.subscriptionCode && row.provider_subscription_id && tx.subscriptionCode !== row.provider_subscription_id) return "unmatched"

  // A charge on a plan that is cancelled or changing: PR 3 refunds it. Until
  // then it extends nothing and reaches a person.
  const { data: scheduled, error } = await admin
    .from("subscriptions")
    .select("id")
    .eq("profile_id", row.profile_id)
    .eq("status", "scheduled")
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (scheduled) return "unmatched"

  const code = row.provider_subscription_id ?? tx.subscriptionCode
  const sub = code ? await fetchSubscription(code) : null
  const fresh = sub?.ok ? sub.data : null
  const periodEnd = periodEndFrom(fresh?.nextPaymentDate ?? null, tx.paidAt)

  const result = await applySubscription({
    action: "extend",
    userId: row.profile_id,
    source: "paystack",
    periodEnd,
    amountNgn: tx.amountNgn,
    paymentReference: tx.reference,
    paymentKind: "renewal",
    providerCustomerId: tx.customerCode,
    providerSubscriptionId: code,
    providerEmailToken: fresh?.emailToken ?? null,
    providerPlanCode: tx.planCode,
    // A payment that landed clears a failed one.
    providerStatus: fresh?.status ?? "active",
    cardLast4: tx.card.last4,
    cardBrand: tx.card.brand,
  })
  if (result === "duplicate") return "duplicate"
  if (result !== "ok") return "unmatched"

  emailBuilder(row.profile_id, "subscription-renewed", billingNotice("renewed", planId, { periodEnd, periodStart: row.period_end, cardLast4: tx.card.last4 ?? row.card_last4, site: site() }))
  return "settled"
}
