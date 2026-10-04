// The submission review flow: pending -> approved, and nothing after that.
// changes_requested survives only on legacy rows; nothing produces it. Payments were removed, and these assertions are what stop
// `paid` or `mark_paid` coming back in by accident — the type union alone only
// catches it where a literal is written down. Run with: npm test

import assert from "node:assert/strict"
import {
  SUBMISSION_STATUSES,
  isComplete,
  nextStatus,
  toStatus,
  STATUS_LABEL,
  type ReviewAction,
} from "../lib/review.ts"
import { reviewSchema } from "../lib/validation/schemas.ts"
import { isNewMission } from "../lib/utils/mission.ts"

const ACTIONS: ReviewAction[] = ["approve"]

/* ── the vocabulary ──────────────────────────────────────────────────── */

assert.deepEqual(SUBMISSION_STATUSES, ["pending", "approved", "changes_requested"])
assert.deepEqual(Object.keys(STATUS_LABEL).sort(), [...SUBMISSION_STATUSES].sort())

/* ── nothing reaches a paid state, from anywhere ─────────────────────── */

// RM-01. The whole cross-product, not a sampled path: this is the assertion
// that fails if someone reintroduces a payment transition later.
for (const status of SUBMISSION_STATUSES) {
  for (const action of ACTIONS) {
    const result = nextStatus(status, action)
    assert.notEqual(result, "paid", `${status} + ${action} must never reach paid`)
    assert.ok(
      result === null || SUBMISSION_STATUSES.includes(result),
      `${status} + ${action} produced ${result}, which is not a status`,
    )
  }
}

/* ── the happy path ──────────────────────────────────────────────────── */

const approved = nextStatus("pending", "approve")
assert.equal(approved, "approved")

/* ── a legacy changes_requested row can still be approved ────────────── */

assert.equal(nextStatus("changes_requested", "approve"), "approved")

/* ── approval is terminal ───────────────────────────────────────────── */

// With no way to send a report back (one report per tester per mission),
// an approved report has nowhere to go.
assert.equal(nextStatus("approved", "approve"), null)

/* ── completion ──────────────────────────────────────────────────────── */

assert.deepEqual(SUBMISSION_STATUSES.filter(isComplete), ["approved"])

/* ── the retired `paid` value off the database column ────────────────── */

// The column is text and still holds `paid` on rows written before payments
// were removed. It maps to `approved` — the same collapse the migration makes —
// so the app is right in the window between deploy and migration, rather than
// looking up a Record key that isn't there and throwing.
assert.equal(toStatus("paid"), "approved")
assert.equal(toStatus("pending"), "pending")
assert.equal(toStatus("approved"), "approved")
assert.equal(toStatus("changes_requested"), "changes_requested")
assert.equal(toStatus(null), "pending")
assert.equal(toStatus(undefined), "pending")
assert.equal(toStatus("something nobody wrote"), "pending")

for (const status of SUBMISSION_STATUSES) {
  assert.ok(STATUS_LABEL[toStatus(status)], "every narrowed status has a label")
}

/* ── mark_paid is rejected at the boundary ───────────────────────────── */

// RM-02. The union stops it compiling; this proves a hand-rolled POST carrying
// action=mark_paid is a field error rather than an unhandled action.
const RESULT_ID = "44444444-4444-4444-8444-444444444444"

const stale = reviewSchema.safeParse({ resultId: RESULT_ID, action: "mark_paid", rating: 5 })
assert.equal(stale.success, false, "mark_paid must not parse")
assert.ok(
  stale.error!.issues.some((i) => i.path[0] === "action"),
  "the rejection has to land on the action field, not somewhere else",
)

assert.equal(
  reviewSchema.safeParse({ resultId: RESULT_ID, action: "approve", rating: 5 }).success,
  true,
)

// Approval carries a rating.
assert.equal(reviewSchema.safeParse({ resultId: RESULT_ID, action: "approve" }).success, false)

// request_changes is gone: a tester files one report per mission, so there is
// nothing for them to change it into.
const sendBack = reviewSchema.safeParse({ resultId: RESULT_ID, action: "request_changes", rating: 3, note: "x" })
assert.equal(sendBack.success, false, "request_changes must not parse")

/* ── new-mission window ──────────────────────────────────────────────── */

const now = Date.parse("2026-08-04T12:00:00Z")
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString()

assert.equal(isNewMission(hoursAgo(3), now), true)
assert.equal(isNewMission(hoursAgo(23.9), now), true)
assert.equal(isNewMission(hoursAgo(24.1), now), false)
assert.equal(isNewMission(hoursAgo(48), now), false)

console.log("review flow: all assertions passed")
