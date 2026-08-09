// Approval-to-payout status flow, plus the tester aggregates that read off it.
// The rule under test: nothing reaches `paid` without passing through
// `approved` first. Run with: npm test

import assert from "node:assert/strict"
import {
  SUBMISSION_STATUSES,
  isComplete,
  isWithdrawable,
  nextStatus,
  type ReviewAction,
  type SubmissionStatus,
} from "../lib/review.ts"
import {
  averageRating,
  earningsFrom,
  formatMoney,
  isNewMission,
  rankFor,
} from "../lib/tester.ts"

const ACTIONS: ReviewAction[] = ["approve", "request_changes", "mark_paid"]

/* ── approval gates payout ───────────────────────────────────────────── */

// The whole point of Task 3: a builder approving is the prerequisite for money
// moving. Every non-approved status must refuse mark_paid.
for (const status of SUBMISSION_STATUSES) {
  const result = nextStatus(status, "mark_paid")
  if (status === "approved") {
    assert.equal(result, "paid", "approved is the one status that can be paid")
  } else {
    assert.equal(result, null, `${status} must not be payable without approval`)
  }
}

/* ── the happy path ──────────────────────────────────────────────────── */

const approved = nextStatus("pending", "approve")
assert.equal(approved, "approved")
assert.equal(nextStatus(approved!, "mark_paid"), "paid")

/* ── request changes, then approve ───────────────────────────────────── */

const needsChanges = nextStatus("pending", "request_changes")
assert.equal(needsChanges, "changes_requested")
assert.equal(nextStatus(needsChanges!, "mark_paid"), null, "changes_requested is not payable")
assert.equal(nextStatus(needsChanges!, "approve"), "approved", "a fixed submission can still be approved")

/* ── approved is reversible until it is paid ─────────────────────────── */

assert.equal(nextStatus("approved", "request_changes"), "changes_requested")

/* ── paid is terminal ────────────────────────────────────────────────── */

// Once money has moved the builder cannot reopen or reject the work it bought.
for (const action of ACTIONS) {
  assert.equal(nextStatus("paid", action), null, `paid must reject ${action}`)
}

/* ── completion + withdrawability ────────────────────────────────────── */

assert.deepEqual(SUBMISSION_STATUSES.filter(isComplete), ["approved", "paid"])
assert.deepEqual(SUBMISSION_STATUSES.filter(isWithdrawable), ["approved"])

/* ── earnings ────────────────────────────────────────────────────────── */

const feed: { status: SubmissionStatus; payout_cents: number }[] = [
  { status: "pending", payout_cents: 500 },
  { status: "pending", payout_cents: 900 },
  { status: "approved", payout_cents: 4700 },
  { status: "changes_requested", payout_cents: 800 },
  { status: "paid", payout_cents: 1400 },
]

const earnings = earningsFrom(feed)
assert.equal(earnings.available, 4700, "only approved money is withdrawable")
assert.equal(earnings.pendingApproval, 1400)
assert.equal(earnings.lifetimePaid, 1400)
assert.equal(earnings.completed, 2, "approved + paid count as completed")

// A submission that was sent back earns nothing and counts for nothing.
assert.equal(earningsFrom([{ status: "changes_requested", payout_cents: 9999 }]).available, 0)
assert.equal(earningsFrom([{ status: "changes_requested", payout_cents: 9999 }]).completed, 0)

// Unpaid missions (payout_cents defaults to 0) still count toward reputation.
assert.equal(earningsFrom([{ status: "approved", payout_cents: 0 }]).completed, 1)

assert.equal(earningsFrom([]).available, 0)
assert.equal(formatMoney(4700), "$47.00")
assert.equal(formatMoney(0), "$0.00")
assert.equal(formatMoney(5), "$0.05")

/* ── rank ────────────────────────────────────────────────────────────── */

assert.equal(rankFor(0).current.name, "New Tester")
assert.equal(rankFor(4).current.name, "New Tester")
assert.equal(rankFor(5).current.name, "Rising Tester", "thresholds are inclusive")
assert.equal(rankFor(15).current.name, "Trusted Tester")

// The mockup's example: 12 completed, 3 more to Trusted Tester, 12/15.
const at12 = rankFor(12)
assert.equal(at12.current.name, "Rising Tester")
assert.equal(at12.next!.name, "Trusted Tester")
assert.equal(at12.toNext, 3)
assert.equal(at12.progress, 12 / 15)

// Top of the ladder has nowhere left to go and must not render a broken bar.
const top = rankFor(999)
assert.equal(top.current.name, "Veteran Tester")
assert.equal(top.next, null)
assert.equal(top.toNext, 0)
assert.equal(top.progress, 1)

/* ── average rating ──────────────────────────────────────────────────── */

// Null, not 0 — an unrated tester must not render as 0.0 stars.
assert.equal(averageRating([]), null)
assert.equal(averageRating([null, null]), null)
assert.equal(averageRating([5, 4, 5]), 14 / 3)
assert.equal(averageRating([5, null, 4]), 4.5, "unrated submissions are excluded, not counted as zero")

/* ── new-mission window ──────────────────────────────────────────────── */

const now = Date.parse("2026-08-04T12:00:00Z")
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString()

assert.equal(isNewMission(hoursAgo(3), now), true)
assert.equal(isNewMission(hoursAgo(23.9), now), true)
assert.equal(isNewMission(hoursAgo(24.1), now), false)
assert.equal(isNewMission(hoursAgo(48), now), false)

console.log("review flow + tester aggregates: all assertions passed")
