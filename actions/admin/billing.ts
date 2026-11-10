"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { recordEventLater } from "@/lib/events"
import { runBillingActionsLater } from "@/lib/paystack/actions"
import { announceRefund, runRefundsLater } from "@/lib/paystack/refunds"
import { disableActionFor } from "@/lib/subscriptions"
import { paidOutsideSchema, refundPaymentSchema, retryRefundSchema, type PaidOutsideInput, type RefundPaymentInput } from "@/lib/validation/schemas"

// Admin refunds (SPEC-paystack-plan-changes §6). Every refund goes through
// queue_refund, which locks the payment and clamps to what's left; a Paystack
// one is then sent by runRefunds() and is "refunded" only when Paystack says
// processed. A manual payment's money goes back by bank transfer, outside the
// app, and is recorded here as settled_outside. The builder hears through the
// refund's own emails, never from here.

export type RefundActionResult = { ok: true } | { ok: false; error: string }

type Admin = Awaited<ReturnType<typeof requireAdmin>>["admin"]
type Queued = { result: string; id?: string; amount_ngn?: number }

const fail = (error: string): RefundActionResult => ({ ok: false, error })
const NOTHING = "Nothing is left to refund on that payment."

async function queue(admin: Admin, args: Record<string, unknown>): Promise<Queued> {
  const { data, error } = await admin.rpc("queue_refund", args)
  if (error) throw new Error(error.message)
  return (data ?? { result: "no_payment" }) as Queued
}

function done(profileId: string, adminUserId: string, amount: number | undefined): RefundActionResult {
  recordEventLater({ name: "billing.refunded", profileId, accountType: "builder", props: { by: adminUserId, amount_ngn: amount ?? null } })
  revalidatePath("/admin/accounts", "layout")
  revalidatePath("/admin/money")
  return { ok: true }
}

export async function refundPayment(input: RefundPaymentInput): Promise<RefundActionResult> {
  const { admin, adminUserId } = await requireAdmin()
  const parsed = refundPaymentSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the refund.")
  const p = parsed.data

  const { data: payment } = await admin.from("subscription_payments").select("id, profile_id, source").eq("id", p.paymentId).maybeSingle()
  if (!payment) return fail("That payment isn't recorded.")
  const outside = payment.source !== "paystack"
  if (outside && !p.transferReference) return fail("This was paid outside Paystack, so it goes back by bank transfer: give the transfer's reference.")

  const queued = await queue(admin, {
    p_payment_id: payment.id,
    p_amount_ngn: p.amountNgn,
    p_reason: "admin",
    p_key: `admin:${p.refundKey}`,
    p_note: outside ? `${p.reason} · transfer ${p.transferReference}` : p.reason,
    p_status: outside ? "settled_outside" : "queued",
  })
  if (queued.result === "nothing_refundable") return fail(NOTHING)
  if (queued.result !== "ok" || !queued.id) return fail("That refund couldn't be recorded. Look at the payment's refunds before trying again.")

  if (p.endPlan) {
    // P5: the plan ends now and nothing at Paystack can renew it.
    const { data: rows } = await admin
      .from("subscriptions")
      .select("provider_subscription_id, provider_email_token")
      .eq("profile_id", payment.profile_id)
      .in("status", ["active", "scheduled"])
    const actions = (rows ?? []).flatMap((r) => disableActionFor(r))
    await applySubscription({ action: "end", userId: payment.profile_id, endStatus: "cancelled", reason: "Refunded", changedBy: adminUserId, actions })
    if (actions.length) runBillingActionsLater()
  }

  if (outside) await announceRefund(queued.id)
  else runRefundsLater()
  return done(payment.profile_id, adminUserId, queued.amount_ngn)
}

type FailedRefund = { id: string; profile_id: string; payment_id: string; reason: string; idempotency_key: string; status: string }

async function failedRefund(admin: Admin, refundId: string): Promise<FailedRefund | null> {
  const { data } = await admin
    .from("subscription_refunds")
    .select("id, profile_id, payment_id, reason, idempotency_key, status")
    .eq("id", refundId)
    .maybeSingle()
  return data?.status === "failed" ? (data as FailedRefund) : null
}

/** "Try again": a new row through the clamp, never the failed one resent. An upgrade refund keeps its stored calculation. */
export async function retryRefund(input: { refundId: string }): Promise<RefundActionResult> {
  const { admin, adminUserId } = await requireAdmin()
  const parsed = retryRefundSchema.safeParse(input)
  if (!parsed.success) return fail("Choose a refund.")
  const failed = await failedRefund(admin, parsed.data.refundId)
  if (!failed) return fail("Only a failed refund can be tried again.")

  const { data: tries } = await admin.from("subscription_refunds").select("id").like("idempotency_key", `${failed.idempotency_key}:retry-%`)
  const queued = await queue(admin, {
    p_payment_id: failed.payment_id,
    p_amount_ngn: null,
    p_reason: failed.reason,
    p_key: `${failed.idempotency_key}:retry-${(tries?.length ?? 0) + 1}`,
    p_status: "queued",
    p_copy_from: failed.id,
  })
  if (queued.result === "nothing_refundable") return fail(NOTHING)
  if (queued.result !== "ok") return fail("That refund couldn't be queued again.")
  runRefundsLater()
  return done(failed.profile_id, adminUserId, queued.amount_ngn)
}

/** "Mark paid outside Paystack": the failed refund was paid back by bank transfer. */
export async function markPaidOutside(input: PaidOutsideInput): Promise<RefundActionResult> {
  const { admin, adminUserId } = await requireAdmin()
  const parsed = paidOutsideSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the transfer.")
  const failed = await failedRefund(admin, parsed.data.refundId)
  if (!failed) return fail("Only a failed refund can be marked paid outside Paystack.")

  const queued = await queue(admin, {
    p_payment_id: failed.payment_id,
    p_amount_ngn: null,
    p_reason: failed.reason,
    p_key: `${failed.idempotency_key}:outside`,
    p_note: `transfer ${parsed.data.transferReference}${parsed.data.note ? ` · ${parsed.data.note}` : ""}`,
    p_status: "settled_outside",
    p_copy_from: failed.id,
  })
  if (queued.result === "nothing_refundable") return fail(NOTHING)
  if (queued.result !== "ok" || !queued.id) return fail("That couldn't be recorded.")
  await announceRefund(queued.id)
  return done(failed.profile_id, adminUserId, queued.amount_ngn)
}
