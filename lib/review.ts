// Submission review state machine (builder side).
//
// Pure and import-free for the same reason lib/access.ts is: this is the rule
// that stops money moving before a human approved the work, and it needs to be
// checkable by scripts/review.test.mts as well as by the server action.

export type SubmissionStatus = "pending" | "approved" | "changes_requested" | "paid"

export type ReviewAction = "approve" | "request_changes" | "mark_paid"

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "pending",
  "approved",
  "changes_requested",
  "paid",
]

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "Pending Review",
  approved: "Approved",
  changes_requested: "Needs Changes",
  paid: "Paid",
}

/**
 * The status `action` moves a submission to, or null if the transition isn't
 * allowed from `current`.
 *
 * The load-bearing rules:
 *   - `mark_paid` is reachable ONLY from `approved`. Approval is the gate on
 *     payout; nothing pays out straight from pending or changes_requested.
 *   - `paid` is terminal. Once money has moved, a builder can't retroactively
 *     reopen or reject the work it paid for.
 */
export function nextStatus(current: SubmissionStatus, action: ReviewAction): SubmissionStatus | null {
  if (current === "paid") return null

  switch (action) {
    case "approve":
      return "approved"
    case "request_changes":
      return "changes_requested"
    case "mark_paid":
      return current === "approved" ? "paid" : null
  }
}

/** Statuses that count as work the tester finished, for rank and totals. */
export function isComplete(status: SubmissionStatus): boolean {
  return status === "approved" || status === "paid"
}

/** Whether a payout for this submission is money the tester can draw on. */
export function isWithdrawable(status: SubmissionStatus): boolean {
  return status === "approved"
}
