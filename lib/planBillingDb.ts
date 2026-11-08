import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { upgradeRefund } from "@/lib/proration"
import { refundLine } from "@/lib/subscriptions"

// Settings → Plan's two reads beyond the subscription row: the upgrade sheet's
// estimate, and the builder's refunds. The caller is the builder themselves
// (the page has passed requireAccount); every read is scoped to their profile.

const SHOW_DONE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * About what an upgrade today would refund: the Starter payment covering today,
 * less what's already been refunded on it, by proration-v1. An estimate; the
 * database computes the real figure from the moment Paystack takes Pro.
 */
export async function upgradeEstimate(profileId: string, subscriptionId: string, now: Date): Promise<{ refundNgn: number; days: number }> {
  const admin = createAdminClient()
  const { data: pay } = await admin
    .from("subscription_payments")
    .select("id, amount_ngn, period_start, period_end")
    .eq("profile_id", profileId)
    .eq("subscription_id", subscriptionId)
    .not("period_end", "is", null)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!pay?.period_end) return { refundNgn: 0, days: 0 }
  const { data: refunds } = await admin.from("subscription_refunds").select("amount_ngn").eq("payment_id", pay.id).neq("status", "failed")
  const base = pay.amount_ngn - (refunds ?? []).reduce((n, r) => n + r.amount_ngn, 0)
  const r = upgradeRefund({ periodStart: pay.period_start, periodEnd: pay.period_end, upgradeAt: now, baseNgn: base })
  return { refundNgn: r.amountNgn, days: r.refundableDays }
}

/** A line per refund that isn't finished, or finished in the last 30 days (spec §3.5). */
export async function refundLines(profileId: string, now: Date): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("subscription_refunds")
    .select("amount_ngn, status, reason, created_at, finished_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(10)
  return (data ?? [])
    .filter((r) => !r.finished_at || now.getTime() - Date.parse(r.finished_at) < SHOW_DONE_MS)
    .map(refundLine)
}
