import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { REFUND_FINISHED, type PaymentLine, type RefundLine } from "@/lib/subscriptions"

// The reads behind MRR and refunds in flight. Admin console only; every caller
// has passed requireAdmin(). These throw: ₦0 on a failed read is a wrong number,
// where an error page is only a missing one.

/**
 * The payments covering `now`, on subscriptions still active, and what has been
 * refunded against them. An upgraded or ended plan's last payment still covers
 * today but isn't recurring any more, so it stops counting with its subscription.
 */
export async function currentPayments(now: Date): Promise<{
  payments: (PaymentLine & { subscription_id: string | null })[]
  refunds: RefundLine[]
}> {
  const admin = createAdminClient()
  const at = now.toISOString()
  const { data, error } = await admin
    .from("subscription_payments")
    .select("id, subscription_id, amount_ngn, period_start, period_end, subscriptions!inner(status)")
    .eq("subscriptions.status", "active")
    .lte("period_start", at)
    .gt("period_end", at)
  if (error) throw new Error(error.message)

  const payments = (data ?? []).map(({ id, subscription_id, amount_ngn, period_start, period_end }) => ({
    id,
    subscription_id,
    amount_ngn,
    period_start,
    period_end,
  })) as (PaymentLine & { subscription_id: string | null })[]
  if (payments.length === 0) return { payments, refunds: [] }

  const refunds = await admin
    .from("subscription_refunds")
    .select("payment_id, amount_ngn, status")
    .in("payment_id", payments.map((p) => p.id))
  if (refunds.error) throw new Error(refunds.error.message)
  return { payments, refunds: (refunds.data ?? []) as RefundLine[] }
}

/** Money promised back that hasn't gone: shown, never hidden. */
export async function refundsInFlight(): Promise<{ totalNgn: number; count: number }> {
  const { data, error } = await createAdminClient()
    .from("subscription_refunds")
    .select("amount_ngn")
    .not("status", "in", `(${REFUND_FINISHED.join(",")})`)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { amount_ngn: number }[]
  return { totalNgn: rows.reduce((sum, r) => sum + r.amount_ngn, 0), count: rows.length }
}
