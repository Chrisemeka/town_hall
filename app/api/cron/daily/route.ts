import { createAdminClient } from "@/lib/supabase/admin"
import { adminRecipients } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { recordEvent } from "@/lib/events"
import { sendNotice } from "@/lib/mail"
import { planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"
import { billingNotice, disableActionFor, graceEnd, lagosDate } from "@/lib/subscriptions"
import { runBillingActions } from "@/lib/paystack/actions"
import { runRefunds } from "@/lib/paystack/refunds"
import { listSubscriptions } from "@/lib/paystack/client"
import { paystackConfigured } from "@/lib/paystack/config"
import { runAlerts } from "@/lib/alerts/run"
import { runTesterDigest } from "@/lib/digest"

// The daily job (vercel.json, 06:00 UTC — 07:00 Lagos). app/api has no
// middleware, so the bearer check below is the only gate: Vercel Cron sends
// `Authorization: Bearer $CRON_SECRET`, and without the variable set nothing
// runs at all.
//
// In order, each step on its own so one failure never stops the rest:
// 1. scheduled changes that are due become real (apply_subscription 'apply');
// 2. active subscriptions past period_end lapse to Community ('end', expired):
//    manual on the day, Paystack after GRACE_DAYS and switched off there;
// 3. builders and admins hear 3 days before a period ends, once a period;
//    then Paystack rows missing their codes are reconciled, and work owed to
//    Paystack is swept;
// 4. testers get the day's new test cases, once per window (lib/digest.ts);
// 5. retention: page_views rolled up after 90 days, app_events and paystack_events kept 13
//    months, rate_limits a day;
// 6. every alert rule, for deployments where /api/cron/alerts is not
//    scheduled more often.

// The digest is the long step: about five round trips per tester, one tester
// at a time (~250 ms each), plus one Resend call per 50. 16 verified testers
// today is ~4 s; 60 s leaves room for ~200 beside the other steps. The
// ceiling and the way past it are noted in lib/digest.ts.
export const maxDuration = 60

const DAY_MS = 24 * 60 * 60 * 1000
// ponytail: the existing NEXT_PUBLIC_APP_URL pattern; the digest's links come
// from here too. Move to siteLink() once fix/email-link-origin merges.
const site = () => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const report: Record<string, number | string> = {}
  const step = async (name: string, fn: () => Promise<number>) => {
    try {
      report[name] = await fn()
    } catch (err) {
      console.error(`[cron/daily] ${name} failed:`, err)
      report[name] = "failed"
    }
  }

  await step("applied", async () => {
    const { data, error } = await admin
      .from("subscriptions")
      .select("id, profile_id, plan_id")
      .eq("status", "scheduled")
      .lte("period_start", now.toISOString())
    if (error) throw new Error(error.message)
    let n = 0
    for (const s of data ?? []) {
      if ((await applySubscription({ action: "apply", userId: s.profile_id, subscriptionId: s.id })) !== "ok") continue
      n++
      await recordEvent({ name: "plan.changed", profileId: s.profile_id, accountType: "builder", props: { to: s.plan_id, source: "system", why: "scheduled" } })
    }
    return n
  })

  await step("expired", async () => {
    const { data, error } = await admin
      .from("subscriptions")
      .select("profile_id, plan_id, source, period_end, provider_subscription_id, provider_email_token")
      .eq("status", "active")
      .lt("period_end", now.toISOString())
    if (error) throw new Error(error.message)
    let n = 0
    for (const s of data ?? []) {
      const paystack = s.source === "paystack"
      // A renewal charged today can land after this runs, and a failed one gets
      // its grace. A renewal moves period_end, so this row just stops matching.
      if (paystack && Date.parse(graceEnd(s.period_end)) > now.getTime()) continue
      // Paystack would charge a failed subscription again next month: a charge
      // after the plan ended is exactly the dispute the MSA warns about.
      const result = await applySubscription({
        action: "end",
        userId: s.profile_id,
        endStatus: "expired",
        reason: paystack ? "Payment failed" : "Period ended",
        actions: paystack ? disableActionFor(s) : [],
      })
      if (result !== "ok") continue
      n++
      if (paystack) {
        const { data: who } = await admin.from("profiles").select("full_name, email").eq("id", s.profile_id).maybeSingle()
        if (who?.email) {
          const notice = billingNotice("lapsed", planIdFor(s.plan_id), { site: site() })
          await sendNotice({
            to: who.email,
            template: "subscription-lapsed",
            recipientName: (who.full_name ?? "").split(/\s+/)[0] ?? "",
            subject: notice.subject,
            messageBody: notice.body,
            ctaLabel: "See your plan",
            ctaUrl: `${site()}/settings?tab=plan`,
          })
        }
      }
      await recordEvent({ name: "plan.changed", profileId: s.profile_id, accountType: "builder", props: { from: s.plan_id, to: "community", source: "system", why: "lapsed" } })
    }
    return n
  })

  await step("reminded", async () => {
    const { data, error } = await admin
      .from("subscriptions")
      .select("id, profile_id, plan_id, period_end, source, card_last4")
      .eq("status", "active")
      .is("reminder_sent_at", null)
      .gte("period_end", now.toISOString())
      .lte("period_end", new Date(now.getTime() + 3 * DAY_MS).toISOString())
    if (error) throw new Error(error.message)
    if (!data?.length) return 0
    const admins = await adminRecipients()
    const { data: cancelling, error: cancellingError } = await admin
      .from("subscriptions")
      .select("profile_id")
      .eq("status", "scheduled")
      .eq("plan_id", "community")
      .in("profile_id", data.map((s) => s.profile_id))
    if (cancellingError) throw new Error(cancellingError.message)
    const cancelled = new Set((cancelling ?? []).map((c) => c.profile_id))
    let n = 0
    for (const s of data) {
      // Marked first: a failed send is not retried tomorrow into a second copy.
      const { data: marked } = await admin
        .from("subscriptions")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", s.id)
        .is("reminder_sent_at", null)
        .select("id")
      if (!marked?.length) continue
      const { data: who } = await admin.from("profiles").select("full_name, email").eq("id", s.profile_id).maybeSingle()
      const plan = planFor(planIdFor(s.plan_id)).name
      const on = lagosDate(s.period_end)
      const paystack = s.source === "paystack"
      const reminder = paystack ? (cancelled.has(s.profile_id) ? "cancelled_ending" : "renews_soon") : "manual_ending"
      if (who?.email) {
        // Until Paystack is switched on here, a manual plan still renews by asking.
        const notice =
          reminder !== "manual_ending" || paystackConfigured()
            ? billingNotice(reminder, planIdFor(s.plan_id), { periodEnd: s.period_end, cardLast4: s.card_last4, site: site() })
            : {
                subject: `Your ${plan} plan ends on ${on}`,
                body: `Your ${plan} plan ends on ${on}. After that your account moves to Community, and test cases already live keep the testers they have.\n\nTo keep ${plan}, get in touch and we'll renew it.`,
              }
        await sendNotice({
          to: who.email,
          template: reminder === "renews_soon" ? "plan-renewing" : "plan-ending",
          recipientName: (who.full_name ?? "").split(/\s+/)[0] ?? "",
          subject: notice.subject,
          messageBody: notice.body,
          ctaLabel: "See your plan",
          ctaUrl: `${site()}/settings?tab=plan`,
        })
      }
      const adminLine = {
        renews_soon: `renews by card on ${on}`,
        cancelled_ending: `was cancelled and ends on ${on}`,
        manual_ending: `was arranged directly and ends on ${on}`,
      }[reminder]
      for (const a of admins) {
        await sendNotice({
          to: a.email,
          template: "plan-ending-admin",
          recipientName: a.name.split(/\s+/)[0] ?? "",
          subject: `${who?.full_name || who?.email || "A builder"}'s ${plan} plan ${adminLine}`,
          messageBody: `${who?.full_name || "—"} (${who?.email ?? "no email"}) is on ${plan}, which ${adminLine}.${reminder === "manual_ending" ? " Renew it from their account page, or let it lapse to Community." : " Nothing to do."}`,
          ctaLabel: "Open the account",
          ctaUrl: `${site()}/admin/accounts/${s.profile_id}`,
        })
      }
      n++
    }
    return n
  })

  // Fills in what a charge couldn't know because Paystack hadn't made the
  // subscription yet and its subscription.create was missed.
  await step("reconciled", async () => {
    const { data, error } = await admin
      .from("subscriptions")
      .select("profile_id, provider_customer_id, provider_plan_code")
      .eq("status", "active")
      .eq("source", "paystack")
      .or("provider_subscription_id.is.null,provider_email_token.is.null")
      .limit(50)
    if (error) throw new Error(error.message)
    let n = 0
    for (const s of data ?? []) {
      if (!s.provider_customer_id || !s.provider_plan_code) continue
      const found = await listSubscriptions({ customer: s.provider_customer_id, plan: s.provider_plan_code })
      const sub = found.ok ? found.data.find((x) => x.status === "active" && x.subscriptionCode) : null
      if (!sub) continue
      const result = await applySubscription({
        action: "attach",
        userId: s.profile_id,
        source: "paystack",
        periodEnd: sub.nextPaymentDate,
        providerSubscriptionId: sub.subscriptionCode,
        providerEmailToken: sub.emailToken,
        providerStatus: sub.status,
      })
      if (result === "ok") n++
    }
    return n
  })

  await step("billing_actions", () => runBillingActions())

  // Unknown refunds looked up, queued ones sent, and accepted ones no webhook
  // has moved for a day asked about.
  await step("refunds", () => runRefunds({ stale: true }))

  await step("tester_digest", () => runTesterDigest(now, site()))

  await step("page_views_rolled", async () => {
    const { data, error } = await admin.rpc("roll_up_page_views", { p_keep_days: 90 })
    if (error) throw new Error(error.message)
    return Number(data ?? 0)
  })

  await step("events_deleted", async () => {
    const cutoff = new Date(now)
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 13)
    const { count, error } = await admin.from("app_events").delete({ count: "exact" }).lt("occurred_at", cutoff.toISOString())
    if (error) throw new Error(error.message)
    return count ?? 0
  })

  await step("paystack_events_deleted", async () => {
    const cutoff = new Date(now)
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 13)
    const { count, error } = await admin.from("paystack_events").delete({ count: "exact" }).lt("received_at", cutoff.toISOString())
    if (error) throw new Error(error.message)
    return count ?? 0
  })

  await step("rate_limits_deleted", async () => {
    const { count, error } = await admin
      .from("rate_limits")
      .delete({ count: "exact" })
      .lt("window_start", new Date(now.getTime() - DAY_MS).toISOString())
    if (error) throw new Error(error.message)
    return count ?? 0
  })

  await step("alerts_evaluated", () => runAlerts())

  return Response.json(report)
}
