import { createAdminClient } from "@/lib/supabase/admin"
import { adminRecipients } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { recordEvent } from "@/lib/events"
import { sendNotice } from "@/lib/mail"
import { planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"
import { lagosDate } from "@/lib/subscriptions"

// The daily job (vercel.json, 06:00 UTC — 07:00 Lagos). app/api has no
// middleware, so the bearer check below is the only gate: Vercel Cron sends
// `Authorization: Bearer $CRON_SECRET`, and without the variable set nothing
// runs at all.
//
// In order, each step on its own so one failure never stops the rest:
// 1. scheduled changes that are due become real (apply_subscription 'apply');
// 2. active subscriptions past period_end lapse to Community ('end', expired);
// 3. builders and admins hear 3 days before a period ends, once a period;
// 4. retention: page_views rolled up after 90 days, app_events kept 13
//    months, rate_limits a day.

const DAY_MS = 24 * 60 * 60 * 1000
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
      .select("profile_id, plan_id")
      .eq("status", "active")
      .lt("period_end", now.toISOString())
    if (error) throw new Error(error.message)
    let n = 0
    for (const s of data ?? []) {
      const result = await applySubscription({ action: "end", userId: s.profile_id, endStatus: "expired", reason: "Period ended" })
      if (result !== "ok") continue
      n++
      await recordEvent({ name: "plan.changed", profileId: s.profile_id, accountType: "builder", props: { from: s.plan_id, to: "community", source: "system", why: "lapsed" } })
    }
    return n
  })

  await step("reminded", async () => {
    const { data, error } = await admin
      .from("subscriptions")
      .select("id, profile_id, plan_id, period_end")
      .eq("status", "active")
      .is("reminder_sent_at", null)
      .gte("period_end", now.toISOString())
      .lte("period_end", new Date(now.getTime() + 3 * DAY_MS).toISOString())
    if (error) throw new Error(error.message)
    if (!data?.length) return 0
    const admins = await adminRecipients()
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
      if (who?.email) {
        await sendNotice({
          to: who.email,
          template: "plan-ending",
          recipientName: (who.full_name ?? "").split(/\s+/)[0] ?? "",
          subject: `Your ${plan} plan ends on ${on}`,
          messageBody: `Your ${plan} plan ends on ${on}. After that your account moves to Community, and test cases already live keep the testers they have.\n\nTo keep ${plan}, get in touch and we'll renew it.`,
          ctaLabel: "Get in touch",
          ctaUrl: `${site()}/contact`,
        })
      }
      for (const a of admins) {
        await sendNotice({
          to: a.email,
          template: "plan-ending-admin",
          recipientName: a.name.split(/\s+/)[0] ?? "",
          subject: `${who?.full_name || who?.email || "A builder"}'s ${plan} plan ends on ${on}`,
          messageBody: `${who?.full_name || "—"} (${who?.email ?? "no email"}) is on ${plan} until ${on}. Renew it from their account page, or let it lapse to Community.`,
          ctaLabel: "Open the account",
          ctaUrl: `${site()}/admin/accounts/${s.profile_id}`,
        })
      }
      n++
    }
    return n
  })

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

  await step("rate_limits_deleted", async () => {
    const { count, error } = await admin
      .from("rate_limits")
      .delete({ count: "exact" })
      .lt("window_start", new Date(now.getTime() - DAY_MS).toISOString())
    if (error) throw new Error(error.message)
    return count ?? 0
  })

  return Response.json(report)
}
