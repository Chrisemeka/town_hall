// Plan changes, as arithmetic and copy. Pure and import-light, so it is tested
// directly. The writes are lib/billing.ts → apply_subscription
// (supabase/migrations/20261027_02_subscriptions.sql).
//
// The allowance itself is untouched: it reads accounts.plan_id at publish
// (lib/allowance.ts). This file only describes what a change does to it.

import { PLAN_IDS, type PlanId } from "@/lib/vocabulary"
import { planFor } from "@/lib/plans"

export const SUBSCRIPTION_STATUSES = ["scheduled", "active", "cancelled", "expired"] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export type Subscription = {
  id: string
  plan_id: string
  status: string
  source: string
  period_start: string
  period_end: string | null
  amount_ngn: number | null
  payment_reference: string | null
  reason: string
  created_by: string | null
  created_at: string
  ended_at: string | null
}

const rank = (id: PlanId) => PLAN_IDS.indexOf(id)

/**
 * What choosing `target` does for an account on `current`:
 * - extend: same paid plan, active subscription — a renewal.
 * - start: a move up, or recording a paid plan that has no subscription row.
 * - downgrade: a move down, now or at the end of the period.
 * - none: Community to Community.
 */
export function changeKind(current: PlanId, target: PlanId, hasActive: boolean): "extend" | "start" | "downgrade" | "none" {
  if (target === current) {
    if (current === "community") return "none"
    return hasActive ? "extend" : "start"
  }
  return rank(target) > rank(current) ? "start" : "downgrade"
}

/** "27 Nov 2026", Lagos. */
export function lagosDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  })
}

/** "2026-11-27": a month from `now` in Lagos, for the dialog's date input. */
export function defaultPeriodEnd(now: Date): string {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000)
  const next = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth() + 1, lagos.getUTCDate()))
  // 31 Jan + 1 month rolls into March in Date.UTC; clamp to the month's last day.
  if (next.getUTCDate() !== lagos.getUTCDate()) next.setUTCDate(0)
  return next.toISOString().slice(0, 10)
}

/** The last second of a Lagos day — a period that ends "on 27 Nov" includes 27 Nov. */
export function endOfLagosDay(date: string): string {
  return new Date(`${date}T23:59:59+01:00`).toISOString()
}

/**
 * The confirmation line in the plan dialog: what the change does to the
 * allowance, in the allowance's own terms (CLAUDE.md, "spent at publish").
 */
export function allowanceEffect(
  kind: "extend" | "start" | "downgrade",
  current: PlanId,
  target: PlanId,
  opts: { when?: "now" | "period_end"; periodEnd?: string | null } = {},
): string {
  const to = planFor(target)
  const reserved = "Slots already reserved on live test cases stay reserved."
  if (kind === "extend") {
    return `No change to the allowance: ${planFor(current).name} continues${opts.periodEnd ? ` to ${lagosDate(opts.periodEnd)}` : ""}.`
  }
  if (kind === "start") {
    return `${to.name} gives its full ${to.monthlyReports} reports for this month from today. ${reserved}`
  }
  if (opts.when === "period_end" && opts.periodEnd) {
    return `Nothing changes until ${lagosDate(opts.periodEnd)}; then the monthly allowance becomes ${to.monthlyReports} (${to.name}).`
  }
  return `This month's remaining allowance drops to ${to.name}'s ${to.monthlyReports}. ${reserved}`
}

/** "₦15,000". */
export function formatNgn(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** A failed renewal keeps the plan this many days before it lapses. */
export const GRACE_DAYS = 3

export const graceEnd = (periodEnd: string): string => new Date(Date.parse(periodEnd) + GRACE_DAYS * DAY_MS).toISOString()

/** A month on, clamped to the month's end. Only until Paystack's own next_payment_date is known. */
export function provisionalPeriodEnd(from: string): string {
  const d = new Date(from)
  const day = d.getUTCDate()
  d.setUTCMonth(d.getUTCMonth() + 1)
  if (d.getUTCDate() !== day) d.setUTCDate(0)
  return d.toISOString()
}

/** "4th": the day of the month a card subscribed on `now` is charged, Lagos time. Paystack bills the 29th–31st on the 28th. */
export function billingDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Africa/Lagos" }).format(now)
  const day = Math.min(Number(parts), 28)
  const tens = day % 100
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][day % 10] ?? "th")
  return `${day}${suffix}`
}

/**
 * What must be switched off at Paystack when this row stops. Queued through
 * apply_subscription's p_actions, so it happens with the change or not at all.
 */
export function disableActionFor(row: { provider_subscription_id?: string | null; provider_email_token?: string | null }) {
  const code = row.provider_subscription_id
  return code
    ? [{ kind: "disable_subscription" as const, subscription_code: code, email_token: row.provider_email_token ?? null, idempotency_key: `disable:${code}` }]
    : []
}

/** Which of Settings → Plan's states an account is in (SPEC-paystack-subscriptions §12). */
export type PlanBilling = {
  kind: "none" | "manual" | "renewing" | "cancelled" | "attention"
  periodEnd: string | null
  amountNgn: number | null
  cardLast4: string | null
  /** Subscribing is switched on: the key and both plan codes are set. */
  configured: boolean
  testMode: boolean
}

export function planBillingFor(
  planId: PlanId,
  active: { source: string; period_end: string | null; amount_ngn: number | null; provider_status: string | null; card_last4: string | null } | null,
  scheduledPlanId: string | null,
  env: { configured: boolean; testMode: boolean },
): PlanBilling {
  const base = { periodEnd: active?.period_end ?? null, amountNgn: active?.amount_ngn ?? null, cardLast4: active?.card_last4 ?? null, ...env }
  // A plan set before subscriptions existed has no row, and is arranged directly too.
  if (!active) return { ...base, kind: planId === "community" ? "none" : "manual" }
  if (active.source !== "paystack") return { ...base, kind: "manual" }
  if (scheduledPlanId === "community") return { ...base, kind: "cancelled" }
  return { ...base, kind: active.provider_status === "attention" ? "attention" : "renewing" }
}

/** One row of subscription_payments, as MRR reads it. */
export type PaymentLine = { id: string; amount_ngn: number; period_start: string; period_end: string | null }
/** One row of subscription_refunds, as MRR reads it. */
export type RefundLine = { payment_id: string; amount_ngn: number; status: string }

/** The only statuses where the money has actually gone back. Everything else is a promise. */
export const REFUND_RETURNED: readonly string[] = ["processed", "settled_outside"]
/** Finished one way or the other; anything else is promised back and hasn't gone. */
export const REFUND_FINISHED: readonly string[] = [...REFUND_RETURNED, "failed"]

/**
 * What one payment brings in a month: its own amount, less what has really
 * been returned, over its own period. A refund still in flight hasn't left the
 * account, so it doesn't reduce this. An open-ended period is 0. MRR is money,
 * not list price.
 */
export function monthlyAmount(payment: PaymentLine, refunds: readonly RefundLine[]): number {
  if (!payment.period_end) return 0
  const returned = refunds
    .filter((r) => r.payment_id === payment.id && REFUND_RETURNED.includes(r.status))
    .reduce((sum, r) => sum + r.amount_ngn, 0)
  const months = Math.max(1, Math.round((Date.parse(payment.period_end) - Date.parse(payment.period_start)) / (30.44 * DAY_MS)))
  return Math.max(0, payment.amount_ngn - returned) / months
}

/** The payments whose period covers `now`. A comped period has no payment and adds nothing. */
export function mrr(payments: readonly PaymentLine[], refunds: readonly RefundLine[], now: Date): number {
  const at = now.getTime()
  return payments
    .filter((p) => Date.parse(p.period_start) <= at && p.period_end !== null && at < Date.parse(p.period_end))
    .reduce((sum, p) => sum + monthlyAmount(p, refunds), 0)
}

type BillingNoticeKind =
  | "started"
  | "renewed"
  | "renews_soon"
  | "cancelled_ending"
  | "manual_ending"
  | "cancelled"
  | "payment_failed"
  | "lapsed"

/** Every email about a Paystack subscription: it names the amount and says where to stop it. Never the admin or a reason. */
export function billingNotice(
  kind: BillingNoticeKind,
  planId: PlanId,
  opts: { periodEnd?: string | null; periodStart?: string | null; cardLast4?: string | null; site: string },
): { subject: string; body: string } {
  const plan = planFor(planId)
  const name = plan.name
  const amount = formatNgn(plan.amountNgn ?? 0)
  const on = opts.periodEnd ? lagosDate(opts.periodEnd) : "the end of your billing period"
  const card = opts.cardLast4 ? `the card ending ${opts.cardLast4}` : "your card"
  const manage = `\n\nManage your plan: ${opts.site}/settings?tab=plan\nBilling, cancelling and refunds: ${opts.site}/refunds`

  const copy: Record<BillingNoticeKind, [string, string]> = {
    started: [
      `You're on ${name}`,
      `Your ${name} plan has started: ${plan.monthlyReports} reports a month and ${plan.activeMissions} active test cases at once. We charged ${amount} to ${card}. Your next charge is ${amount} on ${on}, and it renews every month until you cancel. Cancel any time in Settings → Plan.`,
    ],
    renewed: [
      `Payment received for ${name}`,
      `We charged ${amount} to ${card} for ${name}${opts.periodStart ? `, for ${lagosDate(opts.periodStart)} to ${on}` : ""}. Your next charge is ${amount} on ${on}.`,
    ],
    renews_soon: [
      `Your ${name} plan renews on ${on}`,
      `We'll charge ${amount} to ${card} on ${on}. To stop it, cancel in Settings → Plan before then.`,
    ],
    cancelled_ending: [`Your ${name} plan ends on ${on}`, `Your ${name} plan (${amount} a month) ends on ${on}. You won't be charged again.`],
    manual_ending: [
      `Your ${name} plan ends on ${on}`,
      `Your ${name} plan ends on ${on}. To keep it, subscribe in Settings → Plan for ${amount} a month. It renews monthly until you cancel.`,
    ],
    cancelled: [`${name} cancelled`, `You keep ${name} until ${on}, then your account moves to Community. You won't be charged the ${amount} again.`],
    payment_failed: [
      `Your ${name} payment didn't go through`,
      `We couldn't charge ${amount} for ${name}. Pay by ${opts.periodEnd ? lagosDate(graceEnd(opts.periodEnd)) : on} or the plan ends. Use Pay now in Settings → Plan.`,
    ],
    lapsed: [`Your ${name} plan has ended`, `Your ${name} plan (${amount} a month) has ended because the payment didn't go through. There will be no further charges. Your account is on Community, and you can subscribe again from Settings → Plan.`],
  }
  const [subject, body] = copy[kind]
  return { subject, body: body + manage }
}

/** The email a builder gets when `notify` is on. Never mentions the admin or the reason. */
export function planNotice(
  kind: "extend" | "start" | "downgrade",
  target: PlanId,
  opts: { when?: "now" | "period_end"; periodEnd?: string | null; effectiveOn?: string | null; site: string },
): { subject: string; body: string } {
  const to = planFor(target)
  const until = opts.periodEnd ? ` It runs until ${lagosDate(opts.periodEnd)}.` : ""
  // A confirmation for each paid period is the record a dispute is answered
  // with, so it points at the policy that period was bought under.
  const policy = `\n\nBilling, cancelling and refunds: ${opts.site}/refunds`
  if (kind === "extend") {
    return { subject: `Your ${to.name} plan is renewed`, body: `Your ${to.name} plan has been renewed.${until}${policy}` }
  }
  if (kind === "downgrade" && opts.when === "period_end" && opts.effectiveOn) {
    return {
      subject: `Your plan changes to ${to.name} on ${lagosDate(opts.effectiveOn)}`,
      body: `Your plan will change to ${to.name} on ${lagosDate(opts.effectiveOn)}. Until then nothing changes.\n\nFrom then, ${to.monthlyReports} reports arrive each month. Test cases already live keep the testers they have.`,
    }
  }
  return {
    subject: `You're now on ${to.name}`,
    body: `Your account is now on ${to.name}: ${to.monthlyReports} reports a month and ${to.activeMissions} active test cases at once.${until}\n\nTest cases already live keep the testers they have.${kind === "start" ? policy : ""}`,
  }
}
