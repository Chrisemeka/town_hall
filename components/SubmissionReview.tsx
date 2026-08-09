"use client"

import { useActionState, useState } from "react"
import { Check, RotateCcw, Star, Banknote } from "lucide-react"
import { reviewSubmission, type ReviewState } from "@/actions/review"
import { STATUS_LABEL, type ReviewAction, type SubmissionStatus } from "@/lib/review"
import { Button } from "@/components/ui/Button"

const STATUS_STYLE: Record<SubmissionStatus, { color: string; dot: string }> = {
  pending: { color: "#E8FF47", dot: "#E8FF47" },
  approved: { color: "#3FFFA2", dot: "#3FFFA2" },
  changes_requested: { color: "#FF4F4F", dot: "#FF4F4F" },
  paid: { color: "#3FFFA2", dot: "#3FFFA2" },
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] px-2 h-6 font-mono text-[12px] font-medium uppercase tracking-[0.5px] border border-iron"
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
              fill: n <= shown ? "#E8FF47" : "transparent",
              color: n <= shown ? "#E8FF47" : "#2C2C35",
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
  const [draft, setDraft] = useState<ReviewAction | null>(null)
  const [stars, setStars] = useState(rating ?? 0)

  const errors = state && !state.success ? state.fieldErrors : undefined
  const isPaid = status === "paid"

  return (
    <div className="mt-6 pt-5 border-t border-iron flex flex-col gap-4">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="font-mono text-[11px] text-voltage uppercase tracking-[0.8px]">Review</p>
          <StatusPill status={status} />
          {rating !== null && (
            <span className="font-mono text-[12px] text-ash flex items-center gap-1">
              <Star className="w-3 h-3" style={{ fill: "#E8FF47", color: "#E8FF47" }} />
              {rating}/5 given
            </span>
          )}
        </div>

        {!isPaid && !draft && (
          <div className="flex items-center gap-2">
            {status !== "approved" && (
              <Button size="sm" onClick={() => setDraft("approve")} className="gap-1.5">
                <Check className="w-3.5 h-3.5" /> Approve
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDraft("request_changes")}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Request Changes
            </Button>
            {status === "approved" && (
              <form action={formAction}>
                <input type="hidden" name="resultId" value={resultId} />
                <input type="hidden" name="action" value="mark_paid" />
                <Button size="sm" type="submit" disabled={pending} className="gap-1.5">
                  <Banknote className="w-3.5 h-3.5" /> Mark as Paid
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {reviewNote && status === "changes_requested" && (
        <p className="font-mono text-[13px] leading-5 text-ash bg-ember/5 border-l-2 border-ember rounded-r-[6px] px-3 py-2">
          {reviewNote}
        </p>
      )}

      {/* Rating prompt — opens after the builder picks a decision, because a
          decision without a rating leaves the tester's reputation unmoved. */}
      {draft && (
        <form action={formAction} className="bg-graphite border border-iron rounded-[12px] p-5 flex flex-col gap-4">
          <input type="hidden" name="resultId" value={resultId} />
          <input type="hidden" name="action" value={draft} />

          <div>
            <p className="font-mono text-[13px] text-chalk mb-2">
              {draft === "approve" ? "Approving this submission." : "Sending this back for changes."}
              {" "}How was the tester&apos;s work?
            </p>
            <RatingPicker value={stars} onChange={setStars} />
            {errors?.rating && (
              <p className="font-mono text-[12px] text-ember mt-1">{errors.rating[0]}</p>
            )}
          </div>

          {draft === "request_changes" && (
            <div>
              <label htmlFor={`note-${resultId}`} className="font-mono text-[12px] text-ash block mb-1.5">
                What needs changing?
              </label>
              <textarea
                id={`note-${resultId}`}
                name="note"
                rows={3}
                defaultValue={reviewNote ?? ""}
                placeholder="e.g. The repro steps aren't clear — which screen were you on?"
                className="w-full bg-obsidian border border-iron rounded-[8px] px-3 py-2 font-mono text-[13px] text-chalk placeholder:text-ash/60 focus:outline-none focus:border-voltage transition-colors duration-150"
              />
              {errors?.note && (
                <p className="font-mono text-[12px] text-ember mt-1">{errors.note[0]}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              {pending ? "Saving…" : draft === "approve" ? "Approve + rate" : "Request changes"}
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {state && !state.success && (
        <p className="font-mono text-[12px] text-ember">{state.error}</p>
      )}
    </div>
  )
}
