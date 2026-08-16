// Tester reputation and earnings — all derived, no tables.
//
// Rank, progress, and balances are pure functions of the submission rows the
// tester already has. A ledger table buys nothing until withdrawals actually
// move money; at that point `available` becomes (approved − withdrawn) and this
// is where that subtraction goes.
//
// ponytail: derived balances, add a payouts ledger when withdrawals are real.

// Relative + extensioned so scripts/review.test.mts can load this under plain
// node type-stripping, which doesn't honour the tsconfig `@/*` path alias.
import { isComplete, isWithdrawable, type SubmissionStatus } from "./review.ts"

export type Rank = { name: string; at: number }

/** Ascending by threshold. The mockup's example — 12 completed, "3 more to
 *  Trusted Tester", 12/15 — falls out of these tiers. */
export const RANKS: Rank[] = [
  { name: "New Tester", at: 0 },
  { name: "Rising Tester", at: 5 },
  { name: "Trusted Tester", at: 15 },
  { name: "Veteran Tester", at: 40 },
]

export function rankFor(completed: number): {
  current: Rank
  next: Rank | null
  toNext: number
  progress: number
} {
  const reached = RANKS.filter((r) => completed >= r.at)
  const current = reached[reached.length - 1] ?? RANKS[0]
  const next = RANKS[reached.length] ?? null

  return {
    current,
    next,
    toNext: next ? Math.max(0, next.at - completed) : 0,
    // Fraction of the way to the next tier's threshold. Top rank sits at 1.
    progress: next ? Math.min(1, completed / next.at) : 1,
  }
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export type EarningsInput = { status: SubmissionStatus; payout_cents: number }

export type Earnings = {
  available: number
  pendingApproval: number
  lifetimePaid: number
  completed: number
}

export function earningsFrom(submissions: EarningsInput[]): Earnings {
  return submissions.reduce<Earnings>(
    (acc, s) => {
      const cents = s.payout_cents ?? 0
      if (isWithdrawable(s.status)) acc.available += cents
      if (s.status === "pending") acc.pendingApproval += cents
      if (s.status === "paid") acc.lifetimePaid += cents
      if (isComplete(s.status)) acc.completed += 1
      return acc
    },
    { available: 0, pendingApproval: 0, lifetimePaid: 0, completed: 0 },
  )
}

/** Average of the ratings that exist. Null when nothing has been rated yet —
 *  which must render as "—", never as 0.0, or an unrated tester looks terrible. */
export function averageRating(ratings: (number | null)[]): number | null {
  const rated = ratings.filter((r): r is number => typeof r === "number")
  if (rated.length === 0) return null
  return rated.reduce((a, b) => a + b, 0) / rated.length
}

/** A mission posted inside the last 24h gets the "new" flag on Tester Home. */
export function isNewMission(createdAt: string, now: number = Date.now()): boolean {
  return now - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000
}
