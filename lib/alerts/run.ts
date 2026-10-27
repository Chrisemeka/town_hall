import "server-only"

// Evaluates alert rules: measures each one, then opens, bumps or resolves its
// alert and emails every admin when lib/alerts/rules.ts decide() says so.
// Called by the cron (all rules) and, for the critical rules that must not
// wait for it, straight after the event (runAlertsLater).
//
// Never throws. A broken measurement skips that rule and logs; it never stops
// the others, and never reaches a request that triggered it.

import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { adminRecipients } from "@/lib/auth"
import { sendNotice } from "@/lib/mail"
import { monthOf } from "@/lib/allowance"
import { payoutSheet } from "@/lib/cohortDb"
import { decide, fires, isRuleKey, type AlertRuleKey, type Measure } from "@/lib/alerts/rules"

type Admin = ReturnType<typeof createAdminClient>
type Rule = {
  key: string
  name: string
  description: string
  severity: string
  threshold: number | null
  window_minutes: number | null
  cooldown_minutes: number
  email: boolean
  enabled: boolean
}

const MIN = 60_000
const DAY = 24 * 60 * MIN
const since = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString()

async function countEvents(admin: Admin, name: string, from: string): Promise<number> {
  const { count, error } = await admin.from("app_events").select("id", { count: "exact", head: true }).eq("name", name).gte("occurred_at", from)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** One measurement per rule. `t` is the rule's threshold, `w` its window in ms. */
const MEASURES: Record<AlertRuleKey, (admin: Admin, now: Date, t: number, w: number) => Promise<Measure>> = {
  async uncredited_reports(admin) {
    const { data, error } = await admin.rpc("reports_without_credit")
    if (error) throw new Error(error.message)
    return { value: Number(data ?? 0) }
  },
  server_errors: async (admin, now, _t, w) => ({ value: await countEvents(admin, "error.server", since(now, w)) }),
  rate_limit_degraded: async (admin, now, _t, w) => ({ value: await countEvents(admin, "rate_limit.store_degraded", since(now, w)) }),
  email_failures: async (admin, now, _t, w) => ({ value: await countEvents(admin, "email.failed", since(now, w)) }),
  rate_limit_spike: async (admin, now, _t, w) => ({ value: await countEvents(admin, "rate_limit.hit", since(now, w)) }),

  // A close writes 'released' rows for the slots that went unused — that row
  // IS "closed with fewer reports than it reserved".
  async mission_closed_unfilled(admin, now, _t, w) {
    const { data, error } = await admin.from("report_ledger").select("mission_id").eq("kind", "released").gte("created_at", since(now, w))
    if (error) throw new Error(error.message)
    const ids = [...new Set((data ?? []).map((r) => r.mission_id).filter(Boolean))]
    return { value: ids.length, detail: { mission_ids: ids.slice(0, 20) } }
  },

  async reports_pending_review(admin, now, t) {
    const { data, count, error } = await admin
      .from("test_results")
      .select("id, created_at", { count: "exact" })
      .eq("status", "pending")
      .lt("created_at", since(now, t * DAY))
      .order("created_at", { ascending: true })
      .limit(20)
    if (error) throw new Error(error.message)
    return { value: count ?? 0, detail: { oldest: data?.[0]?.created_at ?? null, report_ids: (data ?? []).map((r) => r.id) } }
  },

  // ponytail: created_at stands in for "published"; a draft left for weeks
  // and then published reads older than it is. Use the first reserved ledger
  // row if that ever matters.
  async unfilled_slots_ageing(admin, now, t) {
    const { data, error } = await admin
      .from("missions")
      .select("id, testers_needed, created_at, test_results(count)")
      .or("is_active.is.null,is_active.eq.true")
      .not("testers_needed", "is", null)
      .lt("created_at", since(now, t * DAY))
    if (error) throw new Error(error.message)
    const waiting = (data ?? []).filter((m) => {
      const received = (m.test_results as unknown as { count: number }[] | null)?.[0]?.count ?? 0
      return received < (m.testers_needed ?? 0)
    })
    return { value: waiting.length, detail: { mission_ids: waiting.slice(0, 20).map((m) => m.id) } }
  },

  async ai_failure_rate(admin, now, _t, w) {
    const { data, error } = await admin.from("ai_usage_events").select("status").gte("created_at", since(now, w))
    if (error) throw new Error(error.message)
    const total = data?.length ?? 0
    const failed = (data ?? []).filter((r) => r.status === "failed").length
    return { value: total ? Math.round((failed / total) * 100) : 0, base: total, detail: { failed, total } }
  },

  async signups_stalled(admin, now, _t, w) {
    const days = Math.max(1, Math.round(w / DAY))
    const [signups, views] = await Promise.all([
      admin.rpc("admin_account_list", { p_signed_up_days: days, p_limit: 1, p_offset: 0 }),
      admin.from("page_views").select("id", { count: "exact", head: true }).gte("occurred_at", since(now, w)),
    ])
    if (signups.error) throw new Error(signups.error.message)
    if (views.error) throw new Error(views.error.message)
    const total = Number((signups.data as { total: number }[] | null)?.[0]?.total ?? 0)
    return { value: total, base: views.count ?? 0 }
  },

  async cohort_over_budget(_admin, now) {
    return { value: (await payoutSheet(monthOf(now))).totalNgn }
  },

  async ai_over_budget(admin, now) {
    // The Lagos month's first instant: midnight Lagos is 23:00 UTC the day before.
    const start = new Date(Date.parse(`${monthOf(now)}T00:00:00+01:00`)).toISOString()
    const { data, error } = await admin.from("ai_usage_events").select("estimated_cost_usd").gte("created_at", start)
    if (error) throw new Error(error.message)
    const usd = (data ?? []).reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0)
    return { value: Math.round(usd * 100) / 100 }
  },

  async subscription_lapsing(admin, now, t) {
    const { data, error } = await admin
      .from("subscriptions")
      .select("profile_id")
      .eq("status", "active")
      .gte("period_end", now.toISOString())
      .lte("period_end", new Date(now.getTime() + t * DAY).toISOString())
    if (error) throw new Error(error.message)
    return { value: data?.length ?? 0, detail: { profile_ids: (data ?? []).map((s) => s.profile_id) } }
  },

  async flagged_projects(admin) {
    const { data, count, error } = await admin.from("projects").select("id", { count: "exact" }).not("flagged_at", "is", null).limit(20)
    if (error) throw new Error(error.message)
    return { value: count ?? 0, detail: { project_ids: (data ?? []).map((p) => p.id) } }
  },
}

const site = () => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"

async function emailAdmins(rule: Rule, value: number) {
  const admins = await adminRecipients()
  await Promise.all(
    admins.map((a) =>
      sendNotice({
        to: a.email,
        template: "admin-alert",
        recipientName: a.name.split(/\s+/)[0] ?? "",
        subject: `[${rule.severity}] ${rule.name}: ${value}`,
        messageBody: `${rule.name} is at ${value}.\n\n${rule.description}`,
        ctaLabel: "Open alerts",
        ctaUrl: `${site()}/admin/alerts`,
      }),
    ),
  )
}

async function evaluateRule(admin: Admin, rule: Rule, now: Date): Promise<void> {
  if (!isRuleKey(rule.key)) return
  const threshold = Number(rule.threshold ?? 0)
  const m = await MEASURES[rule.key](admin, now, threshold, (rule.window_minutes ?? 60) * MIN)
  const firing = fires(rule.key, m, threshold)

  const { data: live } = await admin
    .from("alerts")
    .select("id, status, notified_at")
    .eq("rule_key", rule.key)
    .neq("status", "resolved")
    .maybeSingle()

  const { op, email } = decide(firing, live, rule, now)
  const stamp = now.toISOString()
  const detail = { ...(m.detail ?? {}), ...(m.base !== undefined ? { base: m.base } : {}) }

  if (op === "open") {
    const { error } = await admin.from("alerts").insert({
      rule_key: rule.key,
      value: m.value,
      detail,
      first_seen_at: stamp,
      last_seen_at: stamp,
      notified_at: email ? stamp : null,
    })
    // 23505: a concurrent run opened it first. Theirs stands, and so does their email.
    if (error) {
      if (error.code !== "23505") throw new Error(error.message)
      return
    }
  } else if (op === "bump" && live) {
    await admin
      .from("alerts")
      .update({ value: m.value, detail, last_seen_at: stamp, ...(email ? { notified_at: stamp } : {}) })
      .eq("id", live.id)
  } else if (op === "resolve" && live) {
    await admin.from("alerts").update({ status: "resolved", resolved_at: stamp, value: m.value }).eq("id", live.id)
  }
  if (email) await emailAdmins(rule, m.value)
}

/** Evaluate every enabled rule, or just `keys`. Returns how many were evaluated. */
export async function runAlerts(keys?: AlertRuleKey[]): Promise<number> {
  try {
    const admin = createAdminClient()
    let query = admin.from("alert_rules").select("*").eq("enabled", true)
    if (keys?.length) query = query.in("key", keys)
    const { data: rules, error } = await query
    if (error) throw new Error(error.message)
    const now = new Date()
    let n = 0
    for (const rule of (rules ?? []) as Rule[]) {
      try {
        await evaluateRule(admin, rule, now)
        n++
      } catch (err) {
        console.error(`[alerts] ${rule.key} failed:`, err)
      }
    }
    return n
  } catch (err) {
    console.error("[alerts] run failed:", err)
    return 0
  }
}

/** runAlerts after the response; the same fallback as recordEventLater. */
export function runAlertsLater(keys: AlertRuleKey[]): void {
  try {
    after(() => runAlerts(keys).then(() => undefined))
  } catch {
    void runAlerts(keys)
  }
}
