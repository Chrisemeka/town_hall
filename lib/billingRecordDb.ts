import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { BillingInput } from "@/lib/billingRecord"

// The reads behind a builder's billing record, for ONE profile, through
// service role. The record leaves Twnhall (Paystack, the card issuer), so:
// - test_results never selects tester_id — the same rule as loadFeedback();
// - a payment reads its subscription's plan_id and nothing else from it, and
//   the plan-change log never selects changed_by: who changed a plan, and why,
//   is internal;
// - a refund never selects note or last_error, for the same reason.

type PaymentRow = Omit<BillingInput["payments"][number], "plan_id"> & { subscriptions: { plan_id: string } | null }

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return (r.data ?? []) as T
}

export async function loadBillingInput(profileId: string): Promise<BillingInput & { firstName: string }> {
  const admin = createAdminClient()
  const [profile, payments, refunds, planChanges, ledger, missions] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", profileId).maybeSingle(),
    admin
      .from("subscription_payments")
      .select("kind, source, period_start, period_end, amount_ngn, reference, created_at, subscriptions(plan_id)")
      .eq("profile_id", profileId),
    admin
      .from("subscription_refunds")
      .select(
        "reason, status, amount_ngn, original_payment_reference, causing_payment_reference, upgrade_on, period_start_on, period_end_on, days_in_period, refundable_days, base_ngn, created_at",
      )
      .eq("profile_id", profileId),
    admin
      .from("admin_account_changes")
      .select("from_value, to_value, created_at")
      .eq("profile_id", profileId)
      .eq("field", "plan_id"),
    admin.from("report_ledger").select("kind, bucket, slots, mission_id, created_at").eq("profile_id", profileId),
    admin.from("missions").select("id, title, projects!inner(owner_id)").eq("projects.owner_id", profileId),
  ])

  const ownMissions = must(missions as { data: { id: string; title: string }[] | null; error: { message: string } | null })
  const ids = ownMissions.map((m) => m.id)
  const reports = ids.length
    ? must(
        await admin.from("test_results").select("id, mission_id, created_at, status").in("mission_id", ids),
      )
    : []

  if (profile.error) throw new Error(profile.error.message)
  return {
    firstName: (profile.data?.full_name ?? "").trim().split(/\s+/)[0] || "builder",
    payments: must(payments as unknown as { data: PaymentRow[] | null; error: { message: string } | null }).map(({ subscriptions, ...p }) => ({
      ...p,
      plan_id: subscriptions?.plan_id ?? null,
    })),
    refunds: must(refunds),
    planChanges: must(planChanges),
    ledger: must(ledger),
    missions: ownMissions.map(({ id, title }) => ({ id, title })),
    reports: reports as BillingInput["reports"],
  }
}
