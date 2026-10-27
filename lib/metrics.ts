// The Overview's arithmetic. Pure and import-light — the reads are in the
// page. Source for every constant: docs/Twnhall_Admin_Metrics.md §3 and the
// compensation doc it cites. Change a number here, once.

import { monthOf } from "@/lib/allowance"

/** 20 testers × 10 reports a month (compensation doc §5). */
export const REPORT_CAPACITY_MONTHLY = 200

/**
 * Paid reports a month at which the business breaks even: $76 fixed ÷ $1.26
 * contribution per report (compensation doc §7.2). Drawn in reports, not
 * customers, because Starter and Pro earn the same per report.
 */
export const BREAK_EVEN_REPORTS = 60

export type Range = { key: string; label: string; from: Date; to: Date; days: number }

const DAY = 24 * 60 * 60 * 1000

/** The Lagos month containing `at`, as its first instant. */
export function monthStart(at: Date): Date {
  return new Date(`${monthOf(at)}T00:00:00+01:00`)
}

/** 7 / 30 / 90 days back from now, or the Lagos month to date. Anything else is 30. */
export function rangeFor(key: string | undefined, now: Date): Range {
  if (key === "month") {
    const from = monthStart(now)
    return { key, label: "This month", from, to: now, days: Math.max(1, (now.getTime() - from.getTime()) / DAY) }
  }
  const days = key === "7" ? 7 : key === "90" ? 90 : 30
  return { key: String(days), label: `Last ${days} days`, from: new Date(now.getTime() - days * DAY), to: now, days }
}

/** The same length, immediately before. */
export function previous(r: Range): { from: Date; to: Date } {
  const span = r.to.getTime() - r.from.getTime()
  return { from: new Date(r.from.getTime() - span), to: r.from }
}

/** The last `n` Lagos months, oldest first, as "2026-10-01". */
export function monthsBack(now: Date, n: number): string[] {
  const out: string[] = []
  const [y, m] = monthOf(now).split("-").map(Number)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`)
  }
  return out
}

/** Nearest-rank percentile of unsorted numbers; null when empty. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]
}

export const median = (values: readonly number[]) => percentile(values, 0.5)

export type FillMission = { id: string; createdAt: string; testersNeeded: number | null }

/**
 * Mission published → its last slot filled, for every mission that has
 * filled: the time and when it filled. A mission is filled by its Nth report,
 * N = testers_needed. ponytail: created_at stands in for "published", as in
 * the unfilled-slots alert.
 */
export function fills(missions: readonly FillMission[], reportTimes: ReadonlyMap<string, string[]>): { ms: number; at: string }[] {
  const out: { ms: number; at: string }[] = []
  for (const m of missions) {
    if (!m.testersNeeded) continue
    const times = [...(reportTimes.get(m.id) ?? [])].sort()
    const last = times[m.testersNeeded - 1]
    if (last) out.push({ ms: Date.parse(last) - Date.parse(m.createdAt), at: last })
  }
  return out
}

/** "3.2 days" / "14 h" — a duration someone reads at a glance. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—"
  const hours = ms / (60 * 60 * 1000)
  return hours < 48 ? `${Math.round(hours)} h` : `${(hours / 24).toFixed(1)} days`
}

/** Delivered against capacity for a range: the monthly capacity, pro rata. */
export function capacityFor(days: number): number {
  return Math.round((REPORT_CAPACITY_MONTHLY * days) / 30)
}

/** Paid monthly reports sold, from plan counts and each plan's allowance. */
export function paidReportsSold(counts: Readonly<Record<string, number>>, monthlyReports: (plan: string) => number): number {
  return Object.entries(counts).reduce((n, [plan, count]) => n + count * monthlyReports(plan), 0)
}

/** "+12%" / "−5%" / "new" / "—" against the previous period. */
export function change(now: number, before: number): string {
  if (before === 0) return now === 0 ? "—" : "new"
  const pct = Math.round(((now - before) / before) * 100)
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}%`
}

export function ratio(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—"
}
