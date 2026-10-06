"use client"

import { useActionState, useState } from "react"
import { Check, Star } from "lucide-react"
import { reviewSubmission, type ReviewState } from "@/actions/review"
import { STATUS_LABEL, type SubmissionStatus } from "@/lib/review"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Textarea"
import { REVIEW_NOTE_MAX } from "@/lib/validation/schemas"

const STATUS_STYLE: Record<SubmissionStatus, { color: string; dot: string }> = {
  pending: { color: "var(--color-accent-ink)", dot: "var(--color-accent-ink)" },
  approved: { color: "var(--color-success-ink)", dot: "var(--color-success-ink)" },
  changes_requested: { color: "var(--color-danger-ink)", dot: "var(--color-danger-ink)" },
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] px-2 h-6 font-mono text-[12px] font-medium uppercase tracking-[0.5px] border border-line"
      style={{ color: style.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: style.dot }} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Rate ${n} out of 5`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="p-1 cursor-pointer"
        >
          <Star
            className="w-5 h-5 transition-colors duration-150"
            style={{
              fill: n <= shown ? "var(--color-accent-ink)" : "transparent",
              color: n <= shown ? "var(--color-accent-ink)" : "var(--color-line)",
            }}
          />
        </button>
      ))}
      <input type="hidden" name="rating" value={value || ""} />
    </div>
  )
}

export default function SubmissionReview({
  resultId,
  status,
  rating,
  reviewNote,
}: {
  resultId: string
  status: SubmissionStatus
  rating: number | null
  reviewNote: string | null
}) {
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(reviewSubmission, null)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [stars, setStars] = useState(rating ?? 0)

  const errors = state && !state.success ? state.fieldErrors : undefined

  return (
    <div className="mt-6 pt-5 border-t border-line flex flex-col gap-4">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="font-mono text-[11px] text-accent-ink uppercase tracking-[0.8px]">Review</p>
          <StatusPill status={status} />
          {rating !== null && (
            <span className="font-mono text-[12px] text-ink-muted flex items-center gap-1">
              <Star className="w-3 h-3" style={{ fill: "var(--color-accent-ink)", color: "var(--color-accent-ink)" }} />
              {rating}/5 given
            </span>
          )}
        </div>

        {!ratingOpen && status !== "approved" && (
          <Button size="sm" onClick={() => setRatingOpen(true)} className="gap-1.5">
            <Check className="w-3.5 h-3.5" /> Approve
          </Button>
        )}
      </div>

      {/* Legacy: changes_requested can no longer be produced, but older rows
          carry it and their note. */}
      {reviewNote && status === "changes_requested" && (
        <p className="font-mono text-[13px] leading-5 text-ink-muted bg-ember/5 border-l-2 border-danger-ink rounded-r-[6px] px-3 py-2">
          {reviewNote}
        </p>
      )}

      {reviewNote && status === "approved" && (
        <p className="font-mono text-[13px] leading-5 text-ink-muted border-l-2 border-line pl-3 py-1 whitespace-pre-wrap">
          {reviewNote}
        </p>
      )}

      {/* Rating prompt — opens on Approve, because an approval without a
          rating leaves the tester's reputation unmoved. Closes once approved. */}
      {ratingOpen && status !== "approved" && (
        <form action={formAction} className="bg-surface-raised border border-line rounded-[12px] p-5 flex flex-col gap-4">
          <input type="hidden" name="resultId" value={resultId} />
          <input type="hidden" name="action" value="approve" />

          <div>
            <p className="font-mono text-[13px] text-ink mb-2">
              Approving this submission. How was the tester&apos;s work?
            </p>
            <RatingPicker value={stars} onChange={setStars} />
            {errors?.rating && (
              <p className="font-mono text-[12px] text-danger-ink mt-1">{errors.rating[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor={`reviewNote-${resultId}`} className="font-mono text-[13px] text-ink block mb-2">
              Note to the tester <span className="text-ink-muted">(optional)</span>
            </label>
            <Textarea
              id={`reviewNote-${resultId}`}
              name="reviewNote"
              maxLength={REVIEW_NOTE_MAX}
              placeholder="What was useful, what you'd want more of next time."
              className="border-ink-muted"
            />
            <p className="font-mono text-[12px] text-ink-muted mt-1">
              Sent to the tester with the approval email.
            </p>
            {errors?.reviewNote && (
              <p className="font-mono text-[12px] text-danger-ink mt-1">{errors.reviewNote[0]}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Approve + rate"}
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => setRatingOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {state && !state.success && (
        <p className="font-mono text-[12px] text-danger-ink">{state.error}</p>
      )}
    </div>
  )
}
