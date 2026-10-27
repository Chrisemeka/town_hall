// What makes each alert rule fire, and what happens to its alert. Pure and
// import-free, so every rule is tested with plain numbers. The numbers come
// from lib/alerts/run.ts; the thresholds from alert_rules, editable on
// /admin/alerts.

export const ALERT_RULE_KEYS = [
  "uncredited_reports",
  "server_errors",
  "rate_limit_degraded",
  "mission_closed_unfilled",
  "reports_pending_review",
  "unfilled_slots_ageing",
  "ai_failure_rate",
  "email_failures",
  "rate_limit_spike",
  "signups_stalled",
  "cohort_over_budget",
  "ai_over_budget",
  "subscription_lapsing",
  "flagged_projects",
] as const
export type AlertRuleKey = (typeof ALERT_RULE_KEYS)[number]

export const SEVERITIES = ["critical", "warning", "info"] as const
export type Severity = (typeof SEVERITIES)[number]

/**
 * One rule's measurement. `value` is what the alert shows; `base` is the
 * denominator or companion number a rule needs (analyses for a failure rate,
 * page views for stalled signups).
 */
export type Measure = { value: number; base?: number; detail?: Record<string, unknown> }

/** A failure rate over fewer analyses than this is noise, not a signal. */
export const AI_MIN_ANALYSES = 5

const over = (m: Measure, t: number) => m.value > t
const atLeast = (m: Measure, t: number) => m.value >= t
/** The threshold was already applied in the measurement (an age in days); any match fires. */
const any = (m: Measure) => m.value > 0

const FIRES: Record<AlertRuleKey, (m: Measure, threshold: number) => boolean> = {
  uncredited_reports: over,
  server_errors: atLeast,
  rate_limit_degraded: atLeast,
  mission_closed_unfilled: over,
  reports_pending_review: any,
  unfilled_slots_ageing: any,
  ai_failure_rate: (m, t) => (m.base ?? 0) >= AI_MIN_ANALYSES && m.value > t,
  email_failures: atLeast,
  rate_limit_spike: atLeast,
  signups_stalled: (m) => m.value === 0 && (m.base ?? 0) > 0,
  cohort_over_budget: over,
  ai_over_budget: over,
  subscription_lapsing: any,
  flagged_projects: over,
}

export function fires(key: AlertRuleKey, m: Measure, threshold: number): boolean {
  return FIRES[key](m, threshold)
}

export type LiveAlert = { status: string; notified_at: string | null }

/**
 * What to do with a rule's alert given whether it fires now:
 * open one, bump the live one, resolve it, or nothing. An email goes out when
 * an alert opens, and again only once its cooldown has passed while it is
 * still open — never while acknowledged, never on a resolve.
 */
export function decide(
  firing: boolean,
  live: LiveAlert | null,
  rule: { email: boolean; cooldown_minutes: number },
  now: Date,
): { op: "open" | "bump" | "resolve" | "none"; email: boolean } {
  if (firing && !live) return { op: "open", email: rule.email }
  if (firing && live) {
    const quiet =
      !live.notified_at || now.getTime() - Date.parse(live.notified_at) >= rule.cooldown_minutes * 60_000
    return { op: "bump", email: rule.email && live.status === "open" && quiet }
  }
  if (!firing && live) return { op: "resolve", email: false }
  return { op: "none", email: false }
}

/** Where an alert about this rule should send you. */
export const RULE_LINKS: Record<AlertRuleKey, string> = {
  uncredited_reports: "/admin/submissions",
  server_errors: "/admin/activity?event=error.server",
  rate_limit_degraded: "/admin/activity?event=rate_limit.store_degraded",
  mission_closed_unfilled: "/admin/missions",
  reports_pending_review: "/admin/submissions",
  unfilled_slots_ageing: "/admin/missions",
  ai_failure_rate: "/admin/ai-reports",
  email_failures: "/admin/activity?event=email.failed",
  rate_limit_spike: "/admin/activity?event=rate_limit.hit",
  signups_stalled: "/admin/traffic",
  cohort_over_budget: "/admin/payouts",
  ai_over_budget: "/admin/ai-reports",
  subscription_lapsing: "/admin/accounts",
  flagged_projects: "/admin/projects",
}

export function isRuleKey(key: string): key is AlertRuleKey {
  return (ALERT_RULE_KEYS as readonly string[]).includes(key)
}
