import "server-only"

import { applySubscription, type BillingAction } from "@/lib/billing"
import { recordEvent } from "@/lib/events"
import { PLANS } from "@/lib/plans"
import { billingNotice, disableActionFor, provisionalPeriodEnd } from "@/lib/subscriptions"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchSubscription, listSubscriptions, verifyTransaction, type PaystackSubscription, type PaystackTransaction } from "@/lib/paystack/client"
import { planIdForCode } from "@/lib/paystack/config"
import { planIdFor } from "@/lib/vocabulary"
import { emailBuilder, later, site } from "@/lib/paystack/notify"
import { runBillingActions } from "@/lib/paystack/actions"
import { runRefunds } from "@/lib/paystack/refunds"

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

/**
 * The subscription that made this charge, if Paystack has made it yet: one
 * whose own invoices list the charge's reference. Newest first, and never just
 * "the newest active one", which could be an older subscription whose disable
 * hasn't landed. Null leaves it to subscription.create or the cron's reconcile.
 */
export async function findSubscription(customer: string | null, planCode: string | null, reference: string | null): Promise<PaystackSubscription | null> {
  if (!customer || !planCode || !reference) return null
  const res = await listSubscriptions({ customer, plan: planCode })
  if (!res.ok) return null
  // ponytail: the three newest; a customer with more live subscriptions on one plan is an alert already.
  for (const s of res.data.filter((x) => x.subscriptionCode).slice(0, 3)) {
    const full = await fetchSubscription(s.subscriptionCode!)
    if (full.ok && full.data.invoiceReferences.includes(reference)) return full.data
  }
  return null
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

  const sub = await findSubscription(tx.customerCode, tx.planCode, tx.reference)
  const periodEnd = periodEndFrom(sub?.nextPaymentDate ?? null, tx.paidAt)

  if (checkout.kind === "upgrade") return settleUpgrade(tx, checkout, sub, periodEnd, active?.plan_id ?? null)

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

/**
 * Starter → Pro (SPEC-paystack-plan-changes §2.2). The charge is verified and
 * validated by now; settle_upgrade does the rest in one transaction: Pro starts,
 * Starter ends and its disable is queued, and the unused Starter days are queued
 * as a refund, computed by the database from Paystack's paid_at. A second
 * delivery is 'duplicate' there and creates nothing. Nothing touched Starter
 * before this point.
 */
async function settleUpgrade(
  tx: PaystackTransaction,
  checkout: { reference: string; profile_id: string; replaces_subscription_id: string | null },
  sub: PaystackSubscription | null,
  periodEnd: string,
  fromPlan: string | null,
): Promise<SettleOutcome> {
  const admin = createAdminClient()
  const complete = () => admin.from("paystack_checkouts").update({ completed_at: new Date().toISOString() }).eq("reference", checkout.reference)
  const { data: starter, error: starterError } = checkout.replaces_subscription_id
    ? await admin.from("subscriptions").select("provider_subscription_id, provider_email_token").eq("id", checkout.replaces_subscription_id).maybeSingle()
    : { data: null, error: null }
  if (starterError) throw new Error(starterError.message)

  const { data, error } = await admin.rpc("settle_upgrade", {
    p_user_id: checkout.profile_id,
    p_pro_reference: checkout.reference,
    p_amount_ngn: tx.amountNgn,
    p_paid_at: tx.paidAt ?? new Date().toISOString(),
    p_period_end: periodEnd,
    p_starter_subscription_id: checkout.replaces_subscription_id,
    p_provider_customer_id: tx.customerCode,
    p_provider_subscription_id: sub?.subscriptionCode ?? tx.subscriptionCode,
    p_provider_email_token: sub?.emailToken ?? null,
    p_provider_plan_code: tx.planCode,
    p_provider_status: sub?.status ?? "active",
    p_card_last4: tx.card.last4,
    p_card_brand: tx.card.brand,
    p_actions: starter ? disableActionFor(starter) : [],
  })
  if (error) throw new Error(error.message)
  const { result, refund_ngn: refundNgn } = (data ?? {}) as { result?: string; refund_ngn?: number }
  if (result === "duplicate") {
    await complete()
    return "duplicate"
  }
  if (result !== "ok") return "unmatched"

  await complete()
  later(() => runBillingActions())
  if (refundNgn) later(() => runRefunds())
  await recordEvent({ name: "plan.changed", profileId: checkout.profile_id, accountType: "builder", props: { from: fromPlan ?? "starter", to: "pro", source: "paystack" } })
  emailBuilder(checkout.profile_id, "subscription-upgraded", billingNotice("upgraded", "pro", { periodEnd, cardLast4: tx.card.last4, refundNgn: refundNgn ?? 0, site: site() }))
  return "settled"
}

type PaystackRow = ActiveRow & { status: string; provider_plan_code: string | null }

const ROW_COLUMNS = `${ACTIVE_COLUMNS}, status, provider_plan_code`

/**
 * Which of our subscriptions made this charge, as Paystack has it now. A charge
 * names no subscription, so each of the customer's codes we hold is fetched and
 * its own invoices are read for the reference.
 */
async function chargingSubscription(reference: string, codes: string[]): Promise<PaystackSubscription | null> {
  for (const code of codes) {
    const res = await fetchSubscription(code)
    if (res.ok && res.data.invoiceReferences.includes(reference)) return res.data
  }
  return null
}

/**
 * A charge with no checkout: a renewal, a scheduled Starter's first charge
 * (§4), or a charge from a subscription that should be off (§7). Told apart by
 * the subscription that made it. When Paystack's invoices don't name it, only
 * the plain renewal of the one active plan is assumed, as before; nothing is
 * refunded or applied on a guess.
 */
async function settleRenewal(tx: PaystackTransaction, planId: "starter" | "pro"): Promise<SettleOutcome> {
  if (!tx.customerCode || !tx.reference) return "unmatched"
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .select(ROW_COLUMNS)
    .eq("source", "paystack")
    .eq("provider_customer_id", tx.customerCode)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as PaystackRow[]
  if (!rows.length) return "unmatched"

  const codes = [...new Set(rows.map((r) => r.provider_subscription_id).filter((c): c is string => !!c))]
  const charging = await chargingSubscription(tx.reference, codes)
  const code = charging?.subscriptionCode ?? null
  const owner = code ? (rows.find((r) => r.provider_subscription_id === code) ?? null) : null
  const active = rows.find((r) => r.status === "active") ?? null
  // Any change waiting on the plan, however it was scheduled.
  let scheduled = rows.find((r) => r.status === "scheduled") ?? null
  if (!scheduled && active) {
    const { data: waiting, error: waitingError } = await createAdminClient()
      .from("subscriptions")
      .select(ROW_COLUMNS)
      .eq("profile_id", active.profile_id)
      .eq("status", "scheduled")
      .maybeSingle()
    if (waitingError) throw new Error(waitingError.message)
    scheduled = waiting as PaystackRow | null
  }

  if (owner && owner === scheduled) return scheduled.plan_id === planId ? applyScheduled(tx, scheduled, charging!) : "unmatched"
  if (!active) return owner ? unwanted(tx, owner, charging) : "unmatched"
  if (owner && owner !== active) return unwanted(tx, owner, charging)
  // Charged after the builder cancelled, or after Pro was switched off for a
  // downgrade: the plan had stopped renewing.
  if (scheduled) return owner ? unwanted(tx, active, charging) : "unmatched"
  if (active.plan_id !== planId) return "unmatched"

  let fresh = charging
  if (!fresh && active.provider_subscription_id) {
    const res = await fetchSubscription(active.provider_subscription_id)
    fresh = res.ok ? res.data : null
  }
  const periodEnd = periodEndFrom(fresh?.nextPaymentDate ?? null, tx.paidAt)

  const result = await applySubscription({
    action: "extend",
    userId: active.profile_id,
    source: "paystack",
    periodEnd,
    amountNgn: tx.amountNgn,
    paymentReference: tx.reference,
    paymentKind: "renewal",
    providerCustomerId: tx.customerCode,
    providerSubscriptionId: active.provider_subscription_id ?? code,
    providerEmailToken: fresh?.emailToken ?? null,
    providerPlanCode: tx.planCode,
    // A payment that landed clears a failed one.
    providerStatus: fresh?.status ?? "active",
    cardLast4: tx.card.last4,
    cardBrand: tx.card.brand,
  })
  if (result === "duplicate") return "duplicate"
  if (result !== "ok") return "unmatched"

  emailBuilder(active.profile_id, "subscription-renewed", billingNotice("renewed", planId, { periodEnd, periodStart: active.period_end, cardLast4: tx.card.last4 ?? active.card_last4, site: site() }))
  return "settled"
}

/**
 * Pro → Starter on the billing date (§4): Starter's first charge applies the
 * scheduled row, and Pro ends in the same transaction. Its charge applies it,
 * never the clock. Not due yet throws, so Paystack redelivers.
 */
async function applyScheduled(tx: PaystackTransaction, scheduled: PaystackRow, sub: PaystackSubscription): Promise<SettleOutcome> {
  const planId = planIdFor(scheduled.plan_id)
  const periodEnd = periodEndFrom(sub.nextPaymentDate, tx.paidAt)
  const result = await applySubscription({
    action: "apply",
    userId: scheduled.profile_id,
    subscriptionId: scheduled.id,
    source: "paystack",
    periodEnd,
    amountNgn: tx.amountNgn,
    paymentReference: tx.reference,
    paymentKind: "first",
    providerCustomerId: tx.customerCode,
    providerSubscriptionId: sub.subscriptionCode,
    providerEmailToken: sub.emailToken,
    providerPlanCode: tx.planCode,
    providerStatus: sub.status ?? "active",
    cardLast4: tx.card.last4,
    cardBrand: tx.card.brand,
  })
  if (result === "duplicate") return "duplicate"
  if (result === "not_due") throw new Error(`scheduled ${scheduled.id} isn't due yet`)
  if (result !== "ok") return "unmatched"
  await recordEvent({ name: "plan.changed", profileId: scheduled.profile_id, accountType: "builder", props: { to: planId, source: "paystack", why: "scheduled" } })
  emailBuilder(scheduled.profile_id, "subscription-started", billingNotice("started", planId, { periodEnd, cardLast4: tx.card.last4, site: site() }))
  return "settled"
}

/** A charge nobody meant: a person looks at it until §7's automatic refund lands. */
async function unwanted(_tx: PaystackTransaction, _row: PaystackRow, _sub: PaystackSubscription | null): Promise<SettleOutcome> {
  return "unmatched"
}

/**
 * Charges Paystack made on these subscriptions that never reached us: a lost
 * webhook. Each successful one is verified and settled, exactly as if its
 * webhook had arrived. The cron asks before it ends a Paystack plan, so a
 * builder who paid is never lapsed for our missed event. Returns how many settled.
 */
export async function recoverLostCharges(codes: (string | null | undefined)[]): Promise<number> {
  let n = 0
  for (const code of new Set(codes.filter((c): c is string => !!c))) {
    const sub = await fetchSubscription(code)
    if (!sub.ok || !sub.data.invoiceReferences.length) continue
    const { data: known, error } = await createAdminClient().from("subscription_payments").select("reference").in("reference", sub.data.invoiceReferences)
    if (error) throw new Error(error.message)
    const seen = new Set((known ?? []).map((k) => k.reference))
    for (const reference of sub.data.invoiceReferences.filter((r) => !seen.has(r))) {
      const tx = await verifyTransaction(reference)
      if (tx.ok && tx.data.status === "success" && (await settleCharge(tx.data)) === "settled") n++
    }
  }
  return n
}
