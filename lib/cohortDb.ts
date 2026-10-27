import "server-only"

// Reads for the tester cohort: who is in it, which missions it may be paid
// for, and the monthly payout sheet. Every number comes from lib/payouts.ts
// and lib/allowance.ts; this file only fetches. Service role throughout —
// report_ledger and admin_account_changes have no read policies.

import { createAdminClient } from "@/lib/supabase/admin"
import { monthOf, type LedgerRow } from "@/lib/allowance"
import {
  cohortSlots,
  openToCohort,
  payableReports,
  payoutMonth,
  periodsFrom,
  type CohortEvent,
  type FiledReport,
  type Period,
  type TesterPayout,
} from "@/lib/payouts"

type Admin = ReturnType<typeof createAdminClient>

/** Is this person's tester account in the cohort right now? */
export async function isCohortTester(userId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("accounts")
    .select("cohort_member_at, cohort_left_at")
    .eq("user_id", userId)
    .eq("type", "tester")
    .maybeSingle()
  return !!data?.cohort_member_at && !data.cohort_left_at
}

/** Membership periods for everyone who has ever been in the cohort, from the change log. */
async function cohortPeriods(admin: Admin): Promise<Map<string, Period[]>> {
  const { data, error } = await admin
    .from("admin_account_changes")
    .select("profile_id, to_value, created_at")
    .eq("field", "cohort")
  if (error) throw new Error(error.message)
  const events = new Map<string, CohortEvent[]>()
  for (const row of data ?? []) {
    const list = events.get(row.profile_id) ?? []
    list.push({ to: row.to_value, at: row.created_at })
    events.set(row.profile_id, list)
  }
  return new Map([...events].map(([id, e]) => [id, periodsFrom(e)]))
}

async function slotsFor(admin: Admin, missionIds: string[]): Promise<Map<string, number>> {
  const slots = new Map<string, number>()
  if (missionIds.length === 0) return slots
  const { data, error } = await admin
    .from("report_ledger")
    .select("mission_id, kind, bucket, period, slots")
    .in("mission_id", missionIds)
    .in("kind", ["reserved", "released"])
  if (error) throw new Error(error.message)
  const byMission = new Map<string, LedgerRow[]>()
  for (const row of data ?? []) {
    const list = byMission.get(row.mission_id) ?? []
    list.push(row)
    byMission.set(row.mission_id, list)
  }
  for (const [id, rows] of byMission) slots.set(id, cohortSlots(rows))
  return slots
}

const toReport = (r: {
  id: string
  tester_id: string
  mission_id: string
  created_at: string
  rating: number | null
}): FiledReport => ({
  id: r.id,
  testerId: r.tester_id,
  missionId: r.mission_id,
  createdAt: r.created_at,
  rating: r.rating,
})

/**
 * The missions a cohort tester's feed may show: those with cohort slots left.
 * For anyone else, every mission passed in. Not a security boundary — missions
 * are publicly readable — but it keeps unpaid work out of a paid tester's way.
 * The boundary is payableReports(), which the payout sheet uses.
 */
export async function missionsForTester(userId: string | null | undefined, missionIds: string[]): Promise<Set<string>> {
  if (!userId || missionIds.length === 0 || !(await isCohortTester(userId))) return new Set(missionIds)
  const admin = createAdminClient()
  const [periods, slots, reportsRes] = await Promise.all([
    cohortPeriods(admin),
    slotsFor(admin, missionIds),
    admin
      .from("test_results")
      .select("id, tester_id, mission_id, created_at, rating")
      .in("mission_id", missionIds),
  ])
  const reports = (reportsRes.data ?? []).map(toReport)
  return openToCohort(missionIds, slots, reports, payableReports(reports, slots, periods))
}

export type PayoutRow = TesterPayout & { name: string; email: string }

/**
 * Every report any cohort member has ever filed, and which of them are
 * payable. All of them, not one month's: earlier months' reports used up
 * slots on the same missions, so they decide what is payable now.
 */
async function cohortReports(admin: Admin) {
  const periods = await cohortPeriods(admin)
  const testerIds = [...periods.keys()]
  if (testerIds.length === 0) return { periods, reports: [] as FiledReport[], payable: new Set<string>() }
  const reportsRes = await admin
    .from("test_results")
    .select("id, tester_id, mission_id, created_at, rating")
    .in("tester_id", testerIds)
  if (reportsRes.error) throw new Error(reportsRes.error.message)
  const reports = (reportsRes.data ?? []).filter((r) => r.mission_id).map(toReport)
  const slots = await slotsFor(admin, [...new Set(reports.map((r) => r.missionId))])
  return { periods, reports, payable: payableReports(reports, slots, periods) }
}

/** The payout sheet for a Lagos month ("2026-10-01"). */
export async function payoutSheet(month: string): Promise<{ rows: PayoutRow[]; totalNgn: number }> {
  const admin = createAdminClient()
  const { periods, reports, payable } = await cohortReports(admin)
  if (periods.size === 0) return { rows: [], totalNgn: 0 }
  const { data: people } = await admin.from("profiles").select("id, full_name, email").in("id", [...periods.keys()])

  const sheet = payoutMonth(month, reports, payable, periods)
  const who = new Map((people ?? []).map((p) => [p.id, p]))
  return {
    totalNgn: sheet.totalNgn,
    rows: sheet.rows.map((r) => ({
      ...r,
      name: who.get(r.testerId)?.full_name ?? "",
      email: who.get(r.testerId)?.email ?? "",
    })),
  }
}

/** This month's payable reports and the missions they were on — for cost per builder. */
export async function payableIn(month: string): Promise<{ id: string; missionId: string }[]> {
  const { reports, payable } = await cohortReports(createAdminClient())
  return reports
    .filter((r) => payable.has(r.id) && monthOf(new Date(r.createdAt)) === month)
    .map((r) => ({ id: r.id, missionId: r.missionId }))
}

/** The latest plan and cohort changes, newest first — /admin/accounts shows them. */
export async function recentAccountChanges(limit = 20) {
  const { data } = await createAdminClient()
    .from("admin_account_changes")
    .select("id, profile_id, field, from_value, to_value, changed_by, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as {
    id: string
    profile_id: string
    field: string
    from_value: string | null
    to_value: string | null
    changed_by: string
    created_at: string
  }[]
}
