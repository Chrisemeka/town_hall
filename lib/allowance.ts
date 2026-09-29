// The report allowance: what a builder can spend, and how a mission spends it.
//
// Pure and import-free, in the shape of lib/reciprocity.ts and lib/access.ts.
// The database (supabase/migrations/20260930_01_report_ledger.sql) only stores
// rows and refuses a computation made against rows that have since changed;
// every number is decided here, once. lib/allowanceDb.ts is the glue.
//
// The allowance is spent when a mission is PUBLISHED, never when a report
// arrives — a submission is one-shot, nothing represents a report in progress,
// and refusing one would destroy work the tester has already done.

/** Spend order. A Pro builder must never spend earned credit while this month's sits unused. */
export const BUCKETS = ["monthly", "grant", "earned"] as const
export type Bucket = (typeof BUCKETS)[number]

export const LEDGER_KINDS = ["grant", "earned", "reserved", "released"] as const
export type LedgerKind = (typeof LEDGER_KINDS)[number]

/**
 * The month boundary for the monthly pool, and for PR 3's payout month — one
 * definition, so a report and the slot it filled cannot land in different months.
 */
export const ALLOWANCE_TIMEZONE = "Africa/Lagos"

/** As stored. `slots` is negative on a reserved row. */
export type LedgerRow = {
  kind: string
  bucket: string
  period: string | null
  slots: number
}

export type Balance = { monthly: number; grant: number; earned: number; total: number }

/** A positive number of slots, from one pool (and, for monthly, one month). */
export type Slots = { bucket: Bucket; period: string | null; slots: number }

/**
 * "2026-10-01" for any instant in October, Lagos time.
 *
 * ponytail: Lagos is UTC+1 with no DST, so this is a fixed shift. If the
 * timezone ever changes to one with DST, this needs Intl.DateTimeFormat.
 */
export function monthOf(at: Date): string {
  const lagos = new Date(at.getTime() + 60 * 60 * 1000)
  const mm = String(lagos.getUTCMonth() + 1).padStart(2, "0")
  return `${lagos.getUTCFullYear()}-${mm}-01`
}

/**
 * What the profile can spend now. The monthly pool is derived from the plan,
 * never stored: nothing is written when a month turns.
 */
export function balance(monthlyReports: number, rows: readonly LedgerRow[], now: Date): Balance {
  const month = monthOf(now)
  let monthlyNet = 0
  let grant = 0
  let earned = 0
  for (const r of rows) {
    if (r.bucket === "monthly") {
      if (r.period === month) monthlyNet += r.slots
    } else if (r.bucket === "grant") grant += r.slots
    else if (r.bucket === "earned") earned += r.slots
  }
  // Clamped: a mid-month downgrade drops the entitlement to 0 while this
  // month's reservations still stand, and that is zero left, not a debt.
  const monthly = Math.max(0, monthlyReports + monthlyNet)
  grant = Math.max(0, grant)
  earned = Math.max(0, earned)
  return { monthly, grant, earned, total: monthly + grant + earned }
}

/**
 * Takes up to `requested` slots in spend order. Capped, never refused: the
 * caller gets fewer slots rather than an error, and an empty list only at zero.
 * One entry per pool touched, so a reservation spanning two pools records both.
 */
export function reserve(b: Balance, requested: number, now: Date): Slots[] {
  const out: Slots[] = []
  let left = Math.max(0, requested)
  for (const bucket of BUCKETS) {
    const take = Math.min(left, b[bucket])
    if (take > 0) out.push({ bucket, period: bucket === "monthly" ? monthOf(now) : null, slots: take })
    left -= take
  }
  return out
}

/** Slots a mission still holds, from its reserved and released rows. */
export function held(rows: readonly LedgerRow[]): Slots[] {
  const byKey = new Map<string, Slots>()
  for (const r of rows) {
    if (r.kind !== "reserved" && r.kind !== "released") continue
    const bucket = r.bucket as Bucket
    const period = bucket === "monthly" ? r.period : null
    const key = `${bucket}|${period ?? ""}`
    const s = byKey.get(key) ?? { bucket, period, slots: 0 }
    s.slots -= r.slots // reserved is negative, so this adds; released subtracts
    byKey.set(key, s)
  }
  return [...byKey.values()].filter((s) => s.slots > 0)
}

/**
 * What comes back when a mission closes, having received `received` reports
 * over its whole life. Cumulative, so reopen-and-close cycles need no special
 * case, and running it over its own output returns nothing — which is what
 * makes a double close release once.
 *
 * Reverse spend order: the reports that arrived are taken to have used the
 * monthly pool, so what comes back is the credit that does not expire. Newest
 * month first among monthly slots. A monthly release carries its own month,
 * and if that month has ended the slots expire with it.
 */
export function release(holding: readonly Slots[], received: number): Slots[] {
  const total = holding.reduce((n, s) => n + s.slots, 0)
  let unused = Math.max(0, total - Math.max(0, received))
  const rank = (s: Slots) => (s.bucket === "earned" ? 0 : s.bucket === "grant" ? 1 : 2)
  const ordered = [...holding].sort(
    (a, b) => rank(a) - rank(b) || (b.period ?? "").localeCompare(a.period ?? ""),
  )
  const out: Slots[] = []
  for (const s of ordered) {
    const give = Math.min(unused, s.slots)
    if (give > 0) out.push({ ...s, slots: give })
    unused -= give
  }
  return out
}

/**
 * Whether a paid cohort tester may serve slots from this pool. The cohort is
 * paid ₦1,000 a report: that is spent where a builder pays (monthly) or as
 * deliberate acquisition (grant), never on reciprocity (earned), which the
 * builder already supplied. Compensation doc §8: this does not bend.
 */
export function cohortEligible(bucket: Bucket): boolean {
  return bucket === "monthly" || bucket === "grant"
}
