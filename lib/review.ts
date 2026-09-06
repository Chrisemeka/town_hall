// Submission review state machine (builder side).
//
// A submission arrives pending. The builder either approves it or sends it back
// with a note, and that is the whole cycle — there is no terminal state and
// nothing downstream of approval, because testing here is reciprocal and unpaid.
//
// Pure and import-free for the same reason lib/access.ts is: this is the rule
// the server action enforces, and it needs to be checkable by
// scripts/review.test.mts without a database or a Next.js runtime.

export type SubmissionStatus = "pending" | "approved" | "changes_requested"

export type ReviewAction = "approve" | "request_changes"

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
 * Nothing is currently disallowed. `paid` was the one terminal state, and with
 * it gone every transition is legal from every status — a builder who approves
 * too fast can reopen, and back again. Whether approval should now be terminal
 * in its place is an open question, deliberately not answered here: the
 * behaviour is exactly what it was before payments were removed. The null
 * return stays because that is the shape the caller guards against, and because
 * answering the question later should not mean changing this signature.
 */
export function nextStatus(current: SubmissionStatus, action: ReviewAction): SubmissionStatus | null {
  switch (action) {
    case "approve":
      return "approved"
    case "request_changes":
      return "changes_requested"
  }
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
