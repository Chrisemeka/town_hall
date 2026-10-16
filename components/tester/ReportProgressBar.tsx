"use client"

import { ChevronRight } from "lucide-react"

/** What the bar says, by the form's state. Pure, so its three states are tested. */
export function progressLabel(answered: number, total: number, shots: number): string {
  if (answered < total) return `${answered} of ${total} steps answered`
  if (shots === 0) return "All steps answered · add a screenshot"
  return "Ready to submit"
}

/**
 * The audit log's M3 bottom app bar, below 1024px: progress and Submit in
 * reach while the tester scrolls through several screens of steps.
 *
 * AuditLogForm renders it only while the form's own Submit is off screen, so
 * one Submit is ever visible. While it is in the DOM it carries
 * data-report-bar, and the bottom nav steps aside (BottomNav) — two stacked
 * 64px bars would take a fifth of a phone. It hides, like the nav, while a
 * text field has focus. Its Submit is the form's handleSubmit: validation, the
 * error banner and focus-first-missing behave exactly as the in-form button.
 *
 * The count is not a live region: announcing each answer's effect would be
 * noise, and the in-form Submit and its hint say the same thing.
 */
export function ReportProgressBar({
  answered,
  total,
  shots,
  submitting,
  onJump,
  onSubmit,
}: {
  answered: number
  total: number
  shots: number
  submitting: boolean
  /** To the first unanswered step, the drop zone, or the in-form Submit. */
  onJump: () => void
  onSubmit: () => void
}) {
  const ready = answered === total && shots > 0
  return (
    <div
      data-report-bar
      role="region"
      aria-label="Report progress"
      className="lg:hidden group-has-[:is(input:not([type=checkbox]):not([type=radio]),textarea):focus]/shell:hidden fixed bottom-0 inset-x-0 expanded:left-[240px] z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <div
        role="progressbar"
        aria-label="Steps answered"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        className="h-1 bg-line"
      >
        <div
          className="h-full bg-accent-ink transition-[width] duration-300 ease-standard motion-reduce:transition-none"
          style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
        />
      </div>
      <div className="h-[60px] px-4 medium:px-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onJump}
          className={`min-h-12 min-w-0 inline-flex items-center gap-1 font-mono text-[14px] text-left ${ready ? "text-success-ink" : "text-ink"}`}
        >
          <span className="truncate">{progressLabel(answered, total, shots)}</span>
          <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="h-12 px-5 shrink-0 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  )
}
