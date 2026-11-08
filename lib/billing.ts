import "server-only"

// The one way a plan changes. Every caller — the admin dialog, and settleCharge()
// for a Paystack charge — goes through apply_subscription, which
// writes the subscription row, accounts.plan_id and the admin_account_changes
// line in one transaction. Do not write accounts.plan_id anywhere else.

import { createAdminClient } from "@/lib/supabase/admin"

export type ApplyArgs = {
  action: "start" | "schedule" | "end" | "extend" | "apply" | "attach"
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
  /** first | renewal | upgrade | resubscribe | manual. Null means manual. */
  paymentKind?: string | null
  providerEmailToken?: string | null
  providerPlanCode?: string | null
  providerStatus?: string | null
  cardLast4?: string | null
  cardBrand?: string | null
  /** Queued in the same transaction as the payment, and only when the result is "ok". */
  actions?: BillingAction[]
}

/** Work owed to Paystack. The payload never holds an authorization code. */
export type BillingAction = {
  kind: "disable_subscription" | "create_subscription"
  subscription_code?: string | null
  email_token?: string | null
  payload?: Record<string, unknown>
  idempotency_key: string
}

export type ApplyResult = "ok" | "duplicate" | "unchanged" | "no_account" | "no_active" | "not_due"

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
    p_payment_kind: a.paymentKind ?? null,
    p_provider_email_token: a.providerEmailToken ?? null,
    p_provider_plan_code: a.providerPlanCode ?? null,
    p_provider_status: a.providerStatus ?? null,
    p_card_last4: a.cardLast4 ?? null,
    p_card_brand: a.cardBrand ?? null,
    p_actions: a.actions ?? [],
  })
  if (error) throw new Error(error.message)
  if (data === "bad_action" || typeof data !== "string") throw new Error("Could not apply that plan change.")
  return data as ApplyResult
}
