import "server-only"

// The one way a plan changes. Every caller — the admin dialog today, a
// payment provider's webhook later — goes through apply_subscription, which
// writes the subscription row, accounts.plan_id and the admin_account_changes
// line in one transaction. Do not write accounts.plan_id anywhere else.

import { createAdminClient } from "@/lib/supabase/admin"

export type ApplyArgs = {
  action: "start" | "schedule" | "end" | "extend" | "apply"
  userId: string
  planId?: string | null
  periodEnd?: string | null
  amountNgn?: number | null
  paymentReference?: string | null
  reason?: string | null
  /** The admin's profile id; null for the system or a provider. */
  changedBy?: string | null
  source?: "manual" | "paystack" | "flutterwave"
  providerCustomerId?: string | null
  providerSubscriptionId?: string | null
  endStatus?: "cancelled" | "expired"
  subscriptionId?: string | null
}

export type ApplyResult = "ok" | "unchanged" | "no_account" | "no_active" | "not_due"

export async function applySubscription(a: ApplyArgs): Promise<ApplyResult> {
  const { data, error } = await createAdminClient().rpc("apply_subscription", {
    p_action: a.action,
    p_user_id: a.userId,
    p_plan_id: a.planId ?? null,
    p_period_end: a.periodEnd ?? null,
    p_amount_ngn: a.amountNgn ?? null,
    p_payment_reference: a.paymentReference ?? null,
    p_reason: a.reason ?? null,
    p_changed_by: a.changedBy ?? null,
    p_source: a.source ?? "manual",
    p_provider_customer_id: a.providerCustomerId ?? null,
    p_provider_subscription_id: a.providerSubscriptionId ?? null,
    p_end_status: a.endStatus ?? "cancelled",
    p_subscription_id: a.subscriptionId ?? null,
  })
  if (error) throw new Error(error.message)
  if (data === "bad_action" || typeof data !== "string") throw new Error("Could not apply that plan change.")
  return data as ApplyResult
}

/**
 * The provider entry point. NOT WIRED: no checkout exists, and until one does
 * no card or bank details are collected anywhere (CLAUDE.md, Payments). The
 * webhook route that will call this is a thin signature verifier around it;
 * mapping a provider's payload to this shape is that route's job.
 */
export type ProviderEvent =
  | {
      type: "paid"
      source: "paystack" | "flutterwave"
      userId: string
      planId: "starter" | "pro"
      periodEnd: string
      amountNgn: number
      reference: string
      customerId?: string
      subscriptionId?: string
    }
  | { type: "renewed"; source: "paystack" | "flutterwave"; userId: string; periodEnd: string; amountNgn: number; reference: string }
  | { type: "cancelled"; source: "paystack" | "flutterwave"; userId: string }

export function applyProviderEvent(e: ProviderEvent): Promise<ApplyResult> {
  if (e.type === "paid") {
    return applySubscription({
      action: "start",
      source: e.source,
      userId: e.userId,
      planId: e.planId,
      periodEnd: e.periodEnd,
      amountNgn: e.amountNgn,
      paymentReference: e.reference,
      providerCustomerId: e.customerId,
      providerSubscriptionId: e.subscriptionId,
      reason: `${e.source} payment`,
    })
  }
  if (e.type === "renewed") {
    return applySubscription({
      action: "extend",
      source: e.source,
      userId: e.userId,
      periodEnd: e.periodEnd,
      amountNgn: e.amountNgn,
      paymentReference: e.reference,
    })
  }
  // A provider cancellation ends at the period's close, never mid-period.
  return applySubscription({ action: "schedule", source: e.source, userId: e.userId, planId: "community", reason: `${e.source} cancellation` })
}
