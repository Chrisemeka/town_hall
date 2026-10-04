// Submission review state machine (builder side).
//
// A submission arrives pending and the builder approves it with a rating. That
// is the whole cycle. There is no "send it back": a tester files one report per
// mission (submit_audit_log refuses a second), so a request for changes asked
// for something the tester had no way to deliver. `changes_requested` stays in
// the vocabulary only because rows written before that was removed still hold
// it; nothing produces it any more, and such a row can still be approved.
//
// Pure and import-free for the same reason lib/access.ts is: this is the rule
// the server action enforces, and it needs to be checkable by
// scripts/review.test.mts without a database or a Next.js runtime.

export type SubmissionStatus = "pending" | "approved" | "changes_requested"

export type ReviewAction = "approve"

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "pending",
  "approved",
  "changes_requested",
]

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "Pending Review",
  approved: "Approved",
  changes_requested: "Needs Changes",
}

/**
 * The status `action` moves a submission to, or null if the transition isn't
 * allowed from `current`.
 *
 * Approval is terminal: with no way to send a report back, an approved one has
 * nowhere to go, and approving it again would only rewrite its rating.
 */
export function nextStatus(current: SubmissionStatus, action: ReviewAction): SubmissionStatus | null {
  if (action === "approve" && current !== "approved") return "approved"
  return null
}

/**
 * A status column value narrowed to the vocabulary.
 *
 * `test_results.status` is text, and it holds one value the vocabulary no
 * longer has: `paid`, on rows written before payments were removed. The
 * migration collapses those to `approved`, and this maps them the same way so
 * the app is correct in the window between the deploy and the migration — and
 * stays correct if a row somehow arrives with a status nothing here knows.
 *
 * Without this the raw cast reaches a `Record<SubmissionStatus, ...>` lookup
 * that returns undefined, and the page throws rather than degrading.
 */
export function toStatus(value: string | null | undefined): SubmissionStatus {
  if (value === "paid") return "approved"
  return SUBMISSION_STATUSES.includes(value as SubmissionStatus)
    ? (value as SubmissionStatus)
    : "pending"
}

/** Statuses that count as work the tester finished. */
export function isComplete(status: SubmissionStatus): boolean {
  return status === "approved"
}
