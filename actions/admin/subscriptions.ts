"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { applySubscription, type ApplyResult } from "@/lib/billing"
import { recordEventLater } from "@/lib/events"
import { sendNotice } from "@/lib/mail"
import { planIdFor, type PlanId } from "@/lib/vocabulary"
import { changeKind, endOfLagosDay, planNotice } from "@/lib/subscriptions"
import {
  changePlanSchema,
  downgradeSchema,
  extendSchema,
  type ChangePlanInput,
  type DowngradeInput,
  type ExtendInput,
} from "@/lib/validation/schemas"

// The manual half of builder billing: an admin records a sale, a renewal or
// a downgrade. Every write goes through apply_subscription (lib/billing.ts),
// the same function a payment provider will call — so accounts.plan_id has
// one writer path, and every change has its subscription row and log line.
//
// Returns a result rather than throwing: the plan dialog shows it.

export type PlanActionResult = { ok: true } | { ok: false; error: string }

type Admin = Awaited<ReturnType<typeof requireAdmin>>["admin"]

async function current(admin: Admin, userId: string) {
  const [{ data: account }, { data: profile }] = await Promise.all([
    admin.from("accounts").select("id, plan_id").eq("user_id", userId).eq("type", "builder").maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
  ])
  if (!account) return null
  const { data: active } = await admin
    .from("subscriptions")
    .select("id, period_end")
    .eq("account_id", account.id)
    .eq("status", "active")
    .maybeSingle()
  return {
    plan: planIdFor(account.plan_id),
    active: active as { id: string; period_end: string | null } | null,
    email: (profile?.email as string | null) ?? null,
    name: (profile?.full_name as string | null) ?? "",
  }
}

const FAILED: Record<Exclude<ApplyResult, "ok" | "unchanged">, string> = {
  no_account: "That user has no builder account.",
  no_active: "There is no active subscription to change.",
  not_due: "That change is not due yet.",
}

function done(
  userId: string,
  result: ApplyResult,
  change?: { from: PlanId; to: PlanId },
): PlanActionResult {
  if (result !== "ok" && result !== "unchanged") return { ok: false, error: FAILED[result] }
  if (change && change.from !== change.to) {
    recordEventLater({
      name: "plan.changed",
      profileId: userId,
      accountType: "builder",
      props: { from: change.from, to: change.to, source: "manual" },
    })
  }
  revalidatePath("/admin/accounts", "layout")
  revalidatePath("/settings")
  return { ok: true }
}

function notify(to: string | null, name: string, notice: { subject: string; body: string }) {
  if (!to) return
  const site = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  after(() =>
    sendNotice({
      to,
      template: "plan-changed",
      recipientName: name.split(/\s+/)[0] ?? "",
      subject: notice.subject,
      messageBody: notice.body,
      ctaLabel: "See your plan",
      ctaUrl: `${site}/settings`,
    }),
  )
}

const invalid = (issues: { message: string }[]): PlanActionResult => ({
  ok: false,
  error: issues[0]?.message ?? "Check the form.",
})

/** Upgrade, or a lateral move, effective now. */
export async function changePlan(input: ChangePlanInput): Promise<PlanActionResult> {
  const { admin, adminUserId } = await requireAdmin()
  const parsed = changePlanSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const p = parsed.data

  const now = await current(admin, p.userId)
  if (!now) return { ok: false, error: FAILED.no_account }
  if (changeKind(now.plan, p.planId, !!now.active) === "downgrade") {
    return { ok: false, error: "That is a downgrade — choose when it takes effect." }
  }

  const periodEnd = endOfLagosDay(p.periodEnd)
  if (Date.parse(periodEnd) <= Date.now()) return { ok: false, error: "The period has to end after today." }

  const result = await applySubscription({
    action: "start",
    userId: p.userId,
    planId: p.planId,
    periodEnd,
    amountNgn: p.amountNgn ?? null,
    paymentReference: p.paymentReference,
    reason: p.reason,
    changedBy: adminUserId,
  })
  if (p.notify && result === "ok") notify(now.email, now.name, planNotice("start", p.planId, { periodEnd }))
  return done(p.userId, result, { from: now.plan, to: p.planId })
}

/** Down a tier, now or when the active period ends. */
export async function downgrade(input: DowngradeInput): Promise<PlanActionResult> {
  const { admin, adminUserId } = await requireAdmin()
  const parsed = downgradeSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const p = parsed.data

  const now = await current(admin, p.userId)
  if (!now) return { ok: false, error: FAILED.no_account }
  if (changeKind(now.plan, p.planId, !!now.active) !== "downgrade") {
    return { ok: false, error: "That is not a downgrade from the current plan." }
  }

  if (p.when === "period_end") {
    if (!now.active?.period_end) return { ok: false, error: "No period end to wait for — downgrade now instead." }
    const result = await applySubscription({
      action: "schedule",
      userId: p.userId,
      planId: p.planId,
      reason: p.reason,
      changedBy: adminUserId,
    })
    if (p.notify && result === "ok") {
      notify(now.email, now.name, planNotice("downgrade", p.planId, { when: "period_end", effectiveOn: now.active.period_end }))
    }
    // The plan itself changes when the cron applies the scheduled row.
    return done(p.userId, result)
  }

  // Down to a paid tier now is a new subscription on that tier; down to
  // Community now ends the active one.
  const result =
    p.planId === "community"
      ? await applySubscription({ action: "end", userId: p.userId, reason: p.reason, changedBy: adminUserId })
      : await applySubscription({
          action: "start",
          userId: p.userId,
          planId: p.planId,
          periodEnd: now.active?.period_end ?? null,
          reason: p.reason,
          changedBy: adminUserId,
        })
  if (p.notify && result === "ok") notify(now.email, now.name, planNotice("downgrade", p.planId, { when: "now" }))
  return done(p.userId, result, { from: now.plan, to: p.planId })
}

/** A renewal: the same plan, a later period end. */
export async function extend(input: ExtendInput): Promise<PlanActionResult> {
  const { admin } = await requireAdmin()
  const parsed = extendSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const p = parsed.data

  const now = await current(admin, p.userId)
  if (!now) return { ok: false, error: FAILED.no_account }
  const periodEnd = endOfLagosDay(p.periodEnd)
  if (now.active?.period_end && Date.parse(periodEnd) <= Date.parse(now.active.period_end)) {
    return { ok: false, error: "A renewal has to end later than the current period." }
  }

  const result = await applySubscription({
    action: "extend",
    userId: p.userId,
    periodEnd,
    amountNgn: p.amountNgn ?? null,
    paymentReference: p.paymentReference,
  })
  if (p.notify && result === "ok") notify(now.email, now.name, planNotice("extend", now.plan, { periodEnd }))
  return done(p.userId, result)
}
