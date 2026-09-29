// What the tester cohort is owed, per calendar month. Pure — the database
// reads live in lib/cohortDb.ts. Nothing here pays anyone: it produces the
// sheet an admin pays from by bank transfer (compensation doc §1).
//
// Paid on SUBMISSION, never on approval or rating (compensation doc §6).
// Withholding retroactively destroys trust faster than any rate dispute, so a
// rating only ever raises a flag here.

import { cohortEligible, held, monthOf, type Bucket, type LedgerRow } from "@/lib/allowance"
import { averageRating } from "@/lib/reciprocity"

/**
 * Compensation doc §1. A business decision that will change — change it here,
 * once, and every total follows. Naira, whole units.
 */
export const PAYOUT_RATES = {
  perReportNgn: 1_000,
  bonusNgn: 3_000,
  /** The activity bonus is paid at this many payable reports in a month, or more. */
  bonusAtReports: 10,
} as const

/**
 * Compensation doc §6/§10: the real threshold is undecided. This flags a row
 * on the payout sheet and does nothing else — wiring it to anything automatic
 * with a guessed number would cut someone's income by accident.
 */
export const RATING_FLAG_BELOW = 3.5

export type FiledReport = {
  id: string
  testerId: string
  missionId: string
  createdAt: string
  rating: number | null
}

/** A cohort membership: joined, and left (null while still a member). */
export type Period = { from: string; to: string | null }

/** One membership change, as logged in admin_account_changes. */
export type CohortEvent = { to: string | null; at: string }

/** Membership periods from the change log, oldest first. A re-join is a new period. */
export function periodsFrom(events: readonly CohortEvent[]): Period[] {
  const periods: Period[] = []
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const open = periods.at(-1)
    if (e.to === "member" && (!open || open.to !== null)) periods.push({ from: e.at, to: null })
    if (e.to === "not_member" && open && open.to === null) open.to = e.at
  }
  return periods
}

export function memberAt(periods: readonly Period[], at: string): boolean {
  const t = Date.parse(at)
  return periods.some((p) => t >= Date.parse(p.from) && (p.to === null || t < Date.parse(p.to)))
}

/**
 * How many reports the cohort may be paid for on one mission: its held slots
 * from pools the cohort may serve — Pro's monthly allowance and the signup
 * grant, never earned credit (compensation doc §8: this does not bend).
 */
export function cohortSlots(missionRows: readonly LedgerRow[]): number {
  return held(missionRows)
    .filter((s) => cohortEligible(s.bucket as Bucket))
    .reduce((n, s) => n + s.slots, 0)
}

/**
 * The reports the cohort is paid for: filed by a tester while a member, within
 * the mission's cohort slots, first come first paid. Anything else is an
 * ordinary unpaid reciprocity report.
 */
export function payableReports(
  reports: readonly FiledReport[],
  slotsByMission: ReadonlyMap<string, number>,
  periodsByTester: ReadonlyMap<string, readonly Period[]>,
): Set<string> {
  const used = new Map<string, number>()
  const payable = new Set<string>()
  for (const r of [...reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!memberAt(periodsByTester.get(r.testerId) ?? [], r.createdAt)) continue
    const n = used.get(r.missionId) ?? 0
    if (n >= (slotsByMission.get(r.missionId) ?? 0)) continue
    used.set(r.missionId, n + 1)
    payable.add(r.id)
  }
  return payable
}

/** Missions still open to the cohort: cohort slots left after the payable reports already filed. */
export function openToCohort(
  missionIds: readonly string[],
  slotsByMission: ReadonlyMap<string, number>,
  reports: readonly FiledReport[],
  payable: ReadonlySet<string>,
): Set<string> {
  const filed = new Map<string, number>()
  for (const r of reports) if (payable.has(r.id)) filed.set(r.missionId, (filed.get(r.missionId) ?? 0) + 1)
  return new Set(missionIds.filter((id) => (slotsByMission.get(id) ?? 0) > (filed.get(id) ?? 0)))
}

export function payoutFor(payableThisMonth: number) {
  const base = payableThisMonth * PAYOUT_RATES.perReportNgn
  const bonus = payableThisMonth >= PAYOUT_RATES.bonusAtReports ? PAYOUT_RATES.bonusNgn : 0
  return { base, bonus, total: base + bonus }
}

export type TesterPayout = {
  testerId: string
  payable: number
  /** Cohort reports this month that were not payable — shown so a gap is visible. */
  unpaid: number
  bonus: boolean
  total: number
  /** Every rated report the tester has filed, to date. */
  rating: number | null
  flagged: boolean
}

/**
 * The sheet for one month ("2026-10-01", from monthOf — Africa/Lagos, so a
 * report and the slot it filled can never fall in different months). One row
 * per tester who was a member at any point in the month, even with nothing
 * filed — an active member earning nothing is worth seeing.
 */
export function payoutMonth(
  month: string,
  reports: readonly FiledReport[],
  payable: ReadonlySet<string>,
  periodsByTester: ReadonlyMap<string, readonly Period[]>,
): { rows: TesterPayout[]; totalNgn: number } {
  const rows: TesterPayout[] = []
  // Lagos is UTC+1 with no DST — the same fixed shift monthOf() makes.
  const start = Date.parse(`${month.slice(0, 7)}-01T00:00:00+01:00`)
  const end = Date.parse(`${shiftMonth(month, 1).slice(0, 7)}-01T00:00:00+01:00`)
  for (const [testerId, periods] of periodsByTester) {
    const overlaps = periods.some((p) => Date.parse(p.from) < end && (p.to === null || Date.parse(p.to) > start))
    if (!overlaps) continue
    const theirs = reports.filter((r) => r.testerId === testerId)
    const thisMonth = theirs.filter((r) => monthOf(new Date(r.createdAt)) === month)
    const inCohort = thisMonth.filter((r) => memberAt(periods, r.createdAt))
    const paid = inCohort.filter((r) => payable.has(r.id)).length
    const { bonus, total } = payoutFor(paid)
    const rating = averageRating(theirs.map((r) => r.rating))
    rows.push({
      testerId,
      payable: paid,
      unpaid: inCohort.length - paid,
      bonus: bonus > 0,
      total,
      rating,
      flagged: rating !== null && rating < RATING_FLAG_BELOW,
    })
  }
  rows.sort((a, b) => b.total - a.total || a.testerId.localeCompare(b.testerId))
  return { rows, totalNgn: rows.reduce((n, r) => n + r.total, 0) }
}

/** "2026-10-01" → the next and previous month, for the page's links. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
}
