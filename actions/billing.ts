"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { requireAccount } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { PLANS } from "@/lib/plans"
import { createSubscriptionFrom, disableSubscription, fetchSubscription, initializeTransaction, isAlreadyOff } from "@/lib/paystack/client"
import { findSubscription } from "@/lib/paystack/charges"
import { runBillingActionsLater } from "@/lib/paystack/actions"
import { paystackConfigured, planCodeFor } from "@/lib/paystack/config"
import { emailBuilder, site } from "@/lib/paystack/notify"
import { tooManyMessage } from "@/lib/rateLimit"
import { checkRateLimit } from "@/lib/rateLimitDb"
import { billingNotice, lagosDate } from "@/lib/subscriptions"
import { createAdminClient } from "@/lib/supabase/admin"
import { planIdFor } from "@/lib/vocabulary"

// A builder's own way on and off a Paystack subscription. Nothing is granted
// here: the redirect to Paystack proves only that they reached it, and
// settleCharge() (lib/paystack/charges.ts) is the one place a charge becomes a plan.

export type BillingActionResult = { ok: true } | { ok: false; error: string }

const OPEN_MINUTES = 30

const startSchema = z.object({ planId: z.enum(["starter", "pro"]), kind: z.enum(["new", "resubscribe", "upgrade"]) })

type Admin = ReturnType<typeof createAdminClient>

const fail = (error: string): BillingActionResult => ({ ok: false, error })

function activeRow(admin: Admin, userId: string) {
  return admin
    .from("subscriptions")
    .select("id, plan_id, source, period_end, payment_reference, card_last4, provider_status, provider_customer_id, provider_plan_code, provider_subscription_id, provider_email_token")
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle()
}

async function openCheckout(admin: Admin, userId: string, planId: string, kind: string) {
  const { data, error } = await admin
    .from("paystack_checkouts")
    .select("reference, authorization_url")
    .eq("profile_id", userId)
    .eq("plan_id", planId)
    .eq("kind", kind)
    .is("completed_at", null)
    .is("superseded_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { reference: string; authorization_url: string | null } | null
}

const STILL_STARTING = "Your checkout is still starting. Try again in a moment."

export async function startSubscription(planId: "starter" | "pro", kind: "new" | "resubscribe" | "upgrade" = "new"): Promise<BillingActionResult> {
  const { userId } = await requireAccount("builder")
  const parsed = startSchema.safeParse({ planId, kind })
  if (!parsed.success) return fail("Choose a plan.")
  const plan = PLANS[parsed.data.planId]
  if (!paystackConfigured()) return fail("Subscribing isn't available right now.")

  const rate = await checkRateLimit(["checkout:account", userId])
  if (!rate.ok) return fail(tooManyMessage(rate.retryAfter))

  const admin = createAdminClient()
  const [{ data: active }, { data: account }] = await Promise.all([
    activeRow(admin, userId),
    admin.from("accounts").select("plan_id").eq("user_id", userId).eq("type", "builder").maybeSingle(),
  ])

  let effectiveKind = parsed.data.kind
  let replaces: string | null = null
  if (active) {
    if (active.source !== "paystack") {
      return fail(
        active.period_end
          ? `Your plan was arranged directly and ends on ${lagosDate(active.period_end)}. You can subscribe here from then.`
          : "Your plan was arranged directly. Get in touch to change it.",
      )
    }
    // Pay now on a failed renewal, or Starter → Pro. Nothing about the current
    // row changes here: an abandoned checkout leaves it exactly as it was.
    const payingNow = effectiveKind === "resubscribe" && active.provider_status === "attention" && active.plan_id === plan.id
    const upgrading = effectiveKind === "upgrade" && active.plan_id === "starter" && plan.id === "pro"
    if (!payingNow && !upgrading) {
      return fail(`You're already subscribed. Your ${PLANS[planIdFor(active.plan_id)].name} plan is in Settings → Plan.`)
    }
    replaces = active.id
  } else {
    // The plan lapsed between the banner and the click: this is a fresh start.
    effectiveKind = "new"
    // A plan set before subscriptions existed has no row.
    if (account?.plan_id) return fail("Your plan was arranged directly. Get in touch to change it.")
  }

  // Past 30 minutes a page is left behind, and a new one may be made.
  const cutoff = new Date(Date.now() - OPEN_MINUTES * 60 * 1000).toISOString()
  const superseded = await admin
    .from("paystack_checkouts")
    .update({ superseded_at: new Date().toISOString() })
    .eq("profile_id", userId)
    .is("completed_at", null)
    .is("superseded_at", null)
    .lt("created_at", cutoff)
  if (superseded.error) throw new Error(superseded.error.message)

  // A double-click, a refresh, a second tab: the same page, the same reference.
  const open = await openCheckout(admin, userId, plan.id, effectiveKind)
  if (open) return open.authorization_url ? redirect(open.authorization_url) : fail(STILL_STARTING)

  const reference = `twnhall-sub-${randomUUID().replace(/-/g, "")}`
  const inserted = await admin
    .from("paystack_checkouts")
    .insert({ reference, profile_id: userId, plan_id: plan.id, kind: effectiveKind, replaces_subscription_id: replaces })
  if (inserted.error) {
    // Two concurrent starts: this one lost the index, so read the winner's row.
    if (inserted.error.code !== "23505") throw new Error(inserted.error.message)
    const winner = await openCheckout(admin, userId, plan.id, effectiveKind)
    return winner?.authorization_url ? redirect(winner.authorization_url) : fail(STILL_STARTING)
  }

  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const init = authUser?.user?.email
    ? await initializeTransaction({
        email: authUser.user.email,
        amountNgn: plan.amountNgn!,
        planCode: planCodeFor(plan.id as "starter" | "pro"),
        reference,
        callbackUrl: `${site()}/settings/billing/return`,
        metadata: { profile_id: userId, plan_id: plan.id, kind: effectiveKind, reference },
      })
    : null

  if (!init?.ok || !init.data.authorizationUrl) {
    // Nobody was given a page for this reference, so it can't be paid; leave
    // the index free for the next try.
    await admin.from("paystack_checkouts").delete().eq("reference", reference)
    redirect("/settings?tab=plan&billing=failed")
  }

  const { error } = await admin
    .from("paystack_checkouts")
    .update({ authorization_url: init.data.authorizationUrl, access_code: init.data.accessCode })
    .eq("reference", reference)
  if (error) console.error("[billing] checkout url not stored:", error.message)
  redirect(init.data.authorizationUrl)
}

const NOT_NOW = "We couldn't change your plan just now, so nothing has changed. Try again in a minute."


type Scheduled = { id: string; plan_id: string; provider_subscription_id: string | null; provider_email_token: string | null }

function scheduledRow(admin: Admin, userId: string) {
  return admin
    .from("subscriptions")
    .select("id, plan_id, provider_subscription_id, provider_email_token")
    .eq("profile_id", userId)
    .eq("status", "scheduled")
    .maybeSingle()
}

/** Switches a Paystack subscription off, fetching its email token if we don't hold one. Already off is off. */
async function switchOff(code: string, token: string | null): Promise<boolean> {
  if (!token) {
    const sub = await fetchSubscription(code)
    if (!sub.ok) return false
    token = sub.data.emailToken
    if (!token) return false
  }
  const off = await disableSubscription({ code, token })
  return off.ok || isAlreadyOff(off)
}

export async function cancelSubscription(): Promise<BillingActionResult> {
  // ponytail: no rate limit. This is the off switch, and a closed limiter must
  // never refuse it; after one success it's "nothing to cancel" anyway.
  const { userId } = await requireAccount("builder")

  const admin = createAdminClient()
  const [{ data: active }, { data: scheduledData }] = await Promise.all([activeRow(admin, userId), scheduledRow(admin, userId)])
  const scheduled = scheduledData as Scheduled | null
  if (!active || active.source !== "paystack" || scheduled?.plan_id === "community") return fail("There's nothing to cancel.")
  const NOT_NOW = "We couldn't cancel just now, so nothing has changed. Try again in a minute."

  // A downgrade waiting: its Starter subscription goes first, so neither can
  // charge. If it can't be switched off, nothing changes. One not created yet
  // is stopped from being created.
  if (scheduled?.provider_subscription_id) {
    if (!(await switchOff(scheduled.provider_subscription_id, scheduled.provider_email_token))) return fail(NOT_NOW)
  } else if (scheduled) {
    await admin
      .from("billing_actions")
      .update({ done_at: new Date().toISOString(), last_error: "Cancelled before it was created" })
      .eq("profile_id", userId)
      .eq("kind", "create_subscription")
      .is("done_at", null)
  }

  let code = active.provider_subscription_id as string | null
  let token = active.provider_email_token as string | null
  // Subscribed moments ago, or subscription.create was missed: ask Paystack for
  // the subscription whose own invoices name this plan's payment.
  if (!code && active.provider_customer_id && active.provider_plan_code) {
    const sub = await findSubscription(active.provider_customer_id, active.provider_plan_code, active.payment_reference)
    code = sub?.subscriptionCode ?? null
    token = sub?.emailToken ?? null
  }
  if (!code) return fail(NOT_NOW)

  // Paystack first. Never schedule the end while Paystack can still charge.
  // Already off (its hosted page, or a downgrade, got there first) is what we were asking for.
  if (!(await switchOff(code, token))) return fail(NOT_NOW)

  // "Cancelled" is this scheduled community row, not provider_status. If this
  // write fails, Paystack has already stopped and its webhook schedules it.
  try {
    await applySubscription({ action: "schedule", userId, planId: "community", source: "paystack", reason: "Cancelled by the builder" })
  } catch (err) {
    console.error("[billing] CANCELLED AT PAYSTACK BUT NOT RECORDED, the webhook should schedule it:", userId, err)
  }

  emailBuilder(userId, "subscription-cancelled", billingNotice("cancelled", planIdFor(active.plan_id), { periodEnd: active.period_end, site: site() }))
  revalidatePath("/settings")
  return { ok: true }
}

/**
 * Pro → Starter from the next billing date (SPEC-paystack-plan-changes §4).
 * Off before on: Pro is switched off first, so a failure after that leaves a
 * plan that ends, never two that charge. Starter is created on the same card,
 * starting on Pro's next billing date; if Paystack refuses now, the creation is
 * queued and retried, and the downgrade still shows as scheduled.
 */
export async function scheduleDowngrade(): Promise<BillingActionResult> {
  const { userId } = await requireAccount("builder")
  const rate = await checkRateLimit(["checkout:account", userId])
  if (!rate.ok) return fail(tooManyMessage(rate.retryAfter))

  const admin = createAdminClient()
  const [{ data: active }, { data: scheduled }] = await Promise.all([activeRow(admin, userId), scheduledRow(admin, userId)])
  const code = active?.provider_subscription_id as string | null | undefined
  if (!active || active.source !== "paystack" || active.plan_id !== "pro" || active.provider_status === "attention" || scheduled || !code) {
    return fail("Switching to Starter isn't available for this plan.")
  }
  if (!paystackConfigured()) return fail(NOT_NOW)

  const pro = await fetchSubscription(code)
  if (!pro.ok) return fail(NOT_NOW)
  if (!pro.data.card.reusable) return fail("Your card can't be charged automatically. Cancel Pro, then subscribe to Starter when it ends.")
  const startDate = pro.data.nextPaymentDate ?? active.period_end
  if (!startDate) return fail(NOT_NOW)

  // Pro's own not_renew webhook can land before Starter is scheduled. This marks
  // the stop as ours, so subscriptionStopped() doesn't read it as a cancel and
  // schedule Community over the downgrade.
  // ponytail: if the restore below fails, a later stop on Paystack's own page is
  // ignored too; Pro still lapses at period end, it just isn't emailed.
  await applySubscription({ action: "attach", userId, source: "paystack", providerStatus: "switching" })
  if (!(await switchOff(code, active.provider_email_token ?? pro.data.emailToken))) {
    await applySubscription({ action: "attach", userId, source: "paystack", providerStatus: active.provider_status ?? "active" })
    return fail(NOT_NOW)
  }

  const starterCode = planCodeFor("starter")
  const created = await createSubscriptionFrom({ fromCode: code, planCode: starterCode, startDate })
  const result = await applySubscription({
    action: "schedule",
    userId,
    planId: "starter",
    source: "paystack",
    reason: "Switched to Starter",
    providerCustomerId: active.provider_customer_id,
    providerPlanCode: starterCode,
    ...(created.ok
      ? { providerSubscriptionId: created.data.subscriptionCode, providerEmailToken: created.data.emailToken }
      : {
          // The authorization isn't kept: the retry fetches it from Pro again.
          actions: [
            {
              kind: "create_subscription" as const,
              subscription_code: code,
              payload: { plan: "starter", start_date: startDate, customer: active.provider_customer_id },
              idempotency_key: `create:${code}`,
            },
          ],
        }),
  })
  if (result !== "ok") {
    console.error("[billing] Pro is off but Starter wasn't scheduled:", userId, result)
    return fail(`Pro won't renew, but we couldn't set up Starter. Your plan ends on ${lagosDate(startDate)}; you can subscribe to Starter then.`)
  }
  if (!created.ok) runBillingActionsLater()

  emailBuilder(userId, "subscription-downgrade", billingNotice("downgrade_scheduled", "pro", { periodEnd: startDate, cardLast4: active.card_last4, site: site() }))
  revalidatePath("/settings")
  return { ok: true }
}
