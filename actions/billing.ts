"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { requireAccount } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { PLANS } from "@/lib/plans"
import { disableSubscription, fetchSubscription, initializeTransaction, isAlreadyOff, listSubscriptions } from "@/lib/paystack/client"
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
    .select("id, plan_id, source, period_end, provider_status, provider_customer_id, provider_plan_code, provider_subscription_id, provider_email_token")
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

export async function cancelSubscription(): Promise<BillingActionResult> {
  // ponytail: no rate limit. This is the off switch, and a closed limiter must
  // never refuse it; after one success it's "nothing to cancel" anyway.
  const { userId } = await requireAccount("builder")

  const admin = createAdminClient()
  const [{ data: active }, { data: scheduled }] = await Promise.all([
    activeRow(admin, userId),
    admin.from("subscriptions").select("id").eq("profile_id", userId).eq("status", "scheduled").eq("plan_id", "community").maybeSingle(),
  ])
  if (!active || active.source !== "paystack" || scheduled) return fail("There's nothing to cancel.")

  const NOT_NOW = "We couldn't cancel just now, so nothing has changed. Try again in a minute."
  let code = active.provider_subscription_id as string | null
  let token = active.provider_email_token as string | null
  // Subscribed moments ago, or subscription.create was missed: ask for the codes.
  if (!code && active.provider_customer_id && active.provider_plan_code) {
    const found = await listSubscriptions({ customer: active.provider_customer_id, plan: active.provider_plan_code })
    const sub = found.ok ? found.data.find((s) => s.status === "active" && s.subscriptionCode) : null
    code = sub?.subscriptionCode ?? null
    token = sub?.emailToken ?? null
  }
  if (!code) return fail(NOT_NOW)

  if (!token) {
    const sub = await fetchSubscription(code)
    if (!sub.ok || !sub.data.emailToken) return fail(NOT_NOW)
    token = sub.data.emailToken
  }

  // Paystack first. Never schedule the end while Paystack can still charge.
  // Already off (its hosted page got there first) is what we were asking for.
  const off = await disableSubscription({ code, token })
  if (!off.ok && !isAlreadyOff(off)) return fail(NOT_NOW)

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
