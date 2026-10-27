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

/**
 * What one active subscription brings in a month: what was actually paid,
 * spread over the months it covers. A comped (unpaid) or open-ended one is 0 —
 * MRR is money, not list price.
 */
export function monthlyAmount(sub: Pick<Subscription, "amount_ngn" | "period_start" | "period_end">): number {
  if (!sub.amount_ngn || !sub.period_end) return 0
  const months = Math.max(1, Math.round((Date.parse(sub.period_end) - Date.parse(sub.period_start)) / (30.44 * DAY_MS)))
  return sub.amount_ngn / months
}

export function mrr(active: readonly Pick<Subscription, "amount_ngn" | "period_start" | "period_end">[]): number {
  return active.reduce((sum, s) => sum + monthlyAmount(s), 0)
}

/** The email a builder gets when `notify` is on. Never mentions the admin or the reason. */
export function planNotice(
  kind: "extend" | "start" | "downgrade",
  target: PlanId,
  opts: { when?: "now" | "period_end"; periodEnd?: string | null; effectiveOn?: string | null },
): { subject: string; body: string } {
  const to = planFor(target)
  const until = opts.periodEnd ? ` It runs until ${lagosDate(opts.periodEnd)}.` : ""
  if (kind === "extend") {
    return { subject: `Your ${to.name} plan is renewed`, body: `Your ${to.name} plan has been renewed.${until}` }
  }
  if (kind === "downgrade" && opts.when === "period_end" && opts.effectiveOn) {
    return {
      subject: `Your plan changes to ${to.name} on ${lagosDate(opts.effectiveOn)}`,
      body: `Your plan will change to ${to.name} on ${lagosDate(opts.effectiveOn)}. Until then nothing changes.\n\nFrom then, ${to.monthlyReports} reports arrive each month. Test cases already live keep the testers they have.`,
    }
  }
  return {
    subject: `You're now on ${to.name}`,
    body: `Your account is now on ${to.name}: ${to.monthlyReports} reports a month and ${to.activeMissions} active test cases at once.${until}\n\nTest cases already live keep the testers they have.`,
  }
}
