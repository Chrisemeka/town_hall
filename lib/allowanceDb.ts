import "server-only"

// The report ledger's reads and writes. Every number comes from
// lib/allowance.ts; this file fetches the rows it needs and hands the result to
// an RPC that refuses it if the rows changed in between (compare and append —
// see supabase/migrations/20260930_01_report_ledger.sql). On "stale" it
// re-reads and tries again, which is how two publishes in the same second end
// up with one of them seeing the balance the other left.

import { createAdminClient } from "@/lib/supabase/admin"
import { SIGNUP_GRANT, planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"
import { balance, held, release, reserve, type Balance, type LedgerRow, type Slots } from "@/lib/allowance"

type Admin = ReturnType<typeof createAdminClient>
type Row = LedgerRow & { mission_id: string | null }

const ATTEMPTS = 3

/** The tag to search logs for. A missed credit is a user who was cheated. */
const ALERT = "[allowance] missed credit"

async function builderAccount(admin: Admin, profileId: string) {
  const { data } = await admin
    .from("accounts")
    .select("id, plan_id")
    .eq("user_id", profileId)
    .eq("type", "builder")
    .maybeSingle()
  return data as { id: string; plan_id: string | null } | null
}

async function ledgerRows(admin: Admin, profileId: string): Promise<Row[]> {
  const { data, error } = await admin
    .from("report_ledger")
    .select("kind, bucket, period, slots, mission_id")
    .eq("profile_id", profileId)
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

/** Reserved rows are stored negative; released rows positive. */
const asRows = (slots: Slots[], sign: 1 | -1) =>
  slots.map((s) => ({ bucket: s.bucket, period: s.period, slots: sign * s.slots }))

export type AllowanceView = Balance & {
  testersPerMission: number
  activeMissions: number
  activeLimit: number
}

/** What the builder can spend now, against which plan — for the forms and the mission page. */
export async function reportBalance(profileId: string): Promise<AllowanceView> {
  const admin = createAdminClient()
  const [account, rows, active] = await Promise.all([
    builderAccount(admin, profileId),
    ledgerRows(admin, profileId),
    // Null is_active counts as live, the same as publish_mission's count.
    admin
      .from("missions")
      .select("id, projects!inner(owner_id)", { count: "exact", head: true })
      .eq("projects.owner_id", profileId)
      .or("is_active.is.null,is_active.eq.true"),
  ])
  const plan = planFor(planIdFor(account?.plan_id))
  return {
    ...balance(plan.monthlyReports, rows, new Date()),
    testersPerMission: plan.testersPerMission,
    activeMissions: active.count ?? 0,
    activeLimit: plan.activeMissions,
  }
}

export type PublishOutcome =
  | { status: "published"; slots: number; requested: number }
  | { status: "empty" }
  | { status: "active_limit"; limit: number }
  | { status: "already" }

/**
 * Puts a mission live, reserving up to the plan's testers-per-mission from the
 * balance. Capped at a partial balance; refused only at zero or at the
 * active-mission limit. The mission stays a draft when refused.
 */
export async function publishMission(missionId: string, profileId: string): Promise<PublishOutcome> {
  const admin = createAdminClient()
  const account = await builderAccount(admin, profileId)
  const plan = planFor(planIdFor(account?.plan_id))

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const now = new Date()
    const rows = await ledgerRows(admin, profileId)
    const slots = reserve(balance(plan.monthlyReports, rows, now), plan.testersPerMission, now)
    const granted = slots.reduce((n, s) => n + s.slots, 0)
    if (granted === 0) return { status: "empty" }

    const { data, error } = await admin.rpc("publish_mission", {
      p_mission_id: missionId,
      p_profile_id: profileId,
      p_account_id: account?.id ?? null,
      p_seen_rows: rows.length,
      p_testers: granted,
      p_active_limit: plan.activeMissions,
      p_rows: asRows(slots, -1),
    })
    if (error) throw new Error(error.message)
    if (data === "ok") return { status: "published", slots: granted, requested: plan.testersPerMission }
    if (data === "already") return { status: "already" }
    if (data === "active_limit") return { status: "active_limit", limit: plan.activeMissions }
    if (data === "not_found") throw new Error("Not authorized")
    // "stale": someone else wrote to this ledger since we read it. Read again.
  }
  throw new Error("Could not publish right now. Please try again.")
}

/**
 * Takes a mission down and returns its unused slots. Idempotent: a second
 * close computes nothing to return. A mission published before the ledger
 * existed holds nothing and returns nothing.
 */
export async function closeMission(missionId: string, profileId: string): Promise<void> {
  const admin = createAdminClient()
  const account = await builderAccount(admin, profileId)

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rows = await ledgerRows(admin, profileId)
    const { count, error: countError } = await admin
      .from("test_results")
      .select("id", { count: "exact", head: true })
      .eq("mission_id", missionId)
    if (countError) throw new Error(countError.message)
    const received = count ?? 0

    const back = release(held(rows.filter((r) => r.mission_id === missionId)), received)

    const { data, error } = await admin.rpc("close_mission", {
      p_mission_id: missionId,
      p_profile_id: profileId,
      p_account_id: account?.id ?? null,
      p_seen_rows: rows.length,
      p_seen_received: received,
      p_rows: asRows(back, 1),
    })
    if (error) throw new Error(error.message)
    if (data === "ok") return
    if (data === "not_found") throw new Error("Not authorized")
  }
  throw new Error("Could not close this mission right now. Please try again.")
}

/**
 * The one-time signup grant. Once per profile — the unique index refuses a
 * second, which is the expected path for anyone creating their second account.
 * Never throws: an account must not fail to exist over this.
 */
export async function grantSignup(profileId: string, accountId: string | null): Promise<void> {
  try {
    const { error } = await createAdminClient().from("report_ledger").insert({
      profile_id: profileId,
      account_id: accountId,
      kind: "grant",
      bucket: "grant",
      slots: SIGNUP_GRANT,
    })
    // 23505: already granted. The ordinary case, not a failure.
    if (error && error.code !== "23505") console.error(ALERT, "grant", profileId, error.message)
  } catch (err) {
    console.error(ALERT, "grant", profileId, err)
  }
}

/**
 * After a submission has committed: the tester's credit, and the mission
 * closing itself if it now has every report it reserved. Never throws — the
 * submission already exists and must not be reported as failed. A missed
 * credit shows on /admin as "Reports without a credit".
 */
export async function reportLanded(resultId: string): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc("report_landed", { p_result_id: resultId })
    if (error) console.error(ALERT, "report", resultId, error.message)
  } catch (err) {
    console.error(ALERT, "report", resultId, err)
  }
}

/** Reports with no earned credit. Zero is healthy. Null when it can't be read. */
export async function reportsWithoutCredit(): Promise<number | null> {
  const { data, error } = await createAdminClient().rpc("reports_without_credit")
  return error ? null : (data as number)
}
