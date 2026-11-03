import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { BillingInput } from "@/lib/billingRecord"

// The reads behind a builder's billing record, for ONE profile, through
// service role. The record leaves Twnhall (Paystack, the card issuer), so:
// - test_results never selects tester_id — the same rule as loadFeedback();
// - subscriptions never selects reason or created_by, and the plan-change log
//   never selects changed_by: who changed a plan, and why, is internal.

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return (r.data ?? []) as T
}

export async function loadBillingInput(profileId: string): Promise<BillingInput & { firstName: string }> {
  const admin = createAdminClient()
  const [profile, subscriptions, planChanges, ledger, missions] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", profileId).maybeSingle(),
    admin
      .from("subscriptions")
      .select("plan_id, status, source, period_start, period_end, amount_ngn, payment_reference, created_at")
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
    subscriptions: must(subscriptions),
    planChanges: must(planChanges),
    ledger: must(ledger),
    missions: ownMissions.map(({ id, title }) => ({ id, title })),
    reports: reports as BillingInput["reports"],
  }
}
