"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BuilderNote } from "@/components/tester/BuilderNote"
import { FileText, MessageSquareText, Star, X } from "lucide-react"
import { STATUS_LABEL, type SubmissionStatus } from "@/lib/review"

export type FeedSubmission = {
  id: string
  missionId: string
  missionTitle: string
  projectName: string
  status: SubmissionStatus
  createdAt: string
  screenshots: string[]
  reviewNote: string | null
  /** 1–5, set when the builder approves. */
  rating: number | null
  reviewedAt: string | null
}

const FILTERS: { label: string; status: SubmissionStatus | null }[] = [
  { label: "All", status: null },
  { label: "Pending", status: "pending" },
  { label: "Approved", status: "approved" },
]

const STATUS_STYLE: Record<SubmissionStatus, { color: string; bg: string; border: string }> = {
  pending: { color: "var(--color-accent-ink)", bg: "rgba(232,255,71,0.10)", border: "rgba(232,255,71,0.30)" },
  approved: { color: "var(--color-success-ink)", bg: "rgba(63,255,162,0.10)", border: "rgba(63,255,162,0.30)" },
  changes_requested: { color: "var(--color-danger-ink)", bg: "rgba(255,79,79,0.10)", border: "rgba(255,79,79,0.30)" },
}

const PREVIEW_LIMIT = 3
const PAGE_SIZE = 6

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <span
      className="font-mono text-[11px] font-medium uppercase tracking-[0.5px] px-2.5 py-1.5 rounded-[8px] border shrink-0"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Read-only stars. The number is always said in words too — never colour alone. */
function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          width={size}
          height={size}
          style={{
            fill: n <= rating ? "var(--color-accent-ink)" : "transparent",
            color: n <= rating ? "var(--color-accent-ink)" : "var(--color-ink-muted)",
          }}
        />
      ))}
    </span>
  )
}

/**
 * Everything about one report, in a native <dialog>: the browser gives focus
 * trapping, Esc to close and the top layer for free. The note can run to
 * REVIEW_NOTE_MAX characters, which is why it lives here and not on the card —
 * the body scrolls, the card never stretches.
 */
function SubmissionDialog({ submission, onClose }: { submission: FeedSubmission | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (submission && !dialog.open) dialog.showModal()
    if (!submission && dialog.open) dialog.close()
  }, [submission])

  const s = submission
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-labelledby="submission-dialog-title"
      // ponytail: the backdrop is a scrim — dark on both themes by design.
      className="w-[calc(100%-32px)] max-w-[560px] max-h-[85vh] p-0 m-auto rounded-[12px] border border-line bg-surface-raised text-ink backdrop:bg-black/60"
    >
      {s && (
        <div className="flex flex-col max-h-[85vh]">
          <div className="flex items-start justify-between gap-4 p-6 border-b border-line">
            <div className="min-w-0 flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[1px] text-ink-muted">{s.projectName}</span>
              <h2 id="submission-dialog-title" className="font-syne font-bold text-[20px] leading-7 text-ink break-words">
                {s.missionTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="w-8 h-8 shrink-0 rounded-[8px] flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-6 overflow-y-auto">
            <dl className="grid grid-cols-2 gap-4 font-mono text-[13px]">
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] uppercase tracking-[1px] text-ink-muted">Status</dt>
                <dd><StatusPill status={s.status} /></dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] uppercase tracking-[1px] text-ink-muted">Rating</dt>
                <dd className="flex items-center gap-2 text-ink">
                  {s.rating != null ? (
                    <>
                      <Stars rating={s.rating} />
                      <span>{s.rating} out of 5</span>
                    </>
                  ) : (
                    <span className="text-ink-muted">Not rated yet</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] uppercase tracking-[1px] text-ink-muted">Submitted</dt>
                <dd className="text-ink">{formatDate(s.createdAt)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[11px] uppercase tracking-[1px] text-ink-muted">Reviewed</dt>
                <dd className={s.reviewedAt ? "text-ink" : "text-ink-muted"}>
                  {s.reviewedAt ? formatDate(s.reviewedAt) : "Not yet"}
                </dd>
              </div>
            </dl>

            {s.reviewNote ? (
              <BuilderNote note={s.reviewNote} danger={s.status === "changes_requested"} />
            ) : s.status === "approved" ? (
              <p className="font-mono text-[13px] text-ink-muted">The builder didn&apos;t leave a note.</p>
            ) : null}

            {s.screenshots.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[1px] text-ink-muted">
                  Your screenshots · {s.screenshots.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {s.screenshots.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open screenshot ${i + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-16 h-16 rounded-[8px] object-cover border border-line hover:border-ink-muted transition-colors duration-150" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-line">
            <Link href={`/mission/${s.missionId}`} className="font-mono text-[13px] text-accent-ink hover:underline">
              Open the mission →
            </Link>
          </div>
        </div>
      )}
    </dialog>
  )
}

export function SubmissionsFeed({ submissions }: { submissions: FeedSubmission[] }) {
  const [active, setActive] = useState<SubmissionStatus | null>(null)
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<FeedSubmission | null>(null)

  const counts = submissions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  const filtered = active === null ? submissions : submissions.filter((s) => s.status === active)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Clamped, so a page past the end (after a filter change) shows the last one.
  const current = Math.min(page, pages - 1)
  const shown = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="font-mono text-[11px] font-medium text-ink-muted uppercase tracking-[1px]">
          My Submissions
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(({ label, status }) => {
            const on = active === status
            const count = status === null ? submissions.length : (counts[status] ?? 0)
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setActive(status)
                  setPage(0)
                }}
                aria-pressed={on}
                className={[
                  "font-mono text-[12px] font-medium px-3 h-8 rounded-[8px] border transition-colors duration-150 cursor-pointer",
                  on
                    ? "border-accent-ink/35 bg-voltage/10 text-accent-ink"
                    : "border-line bg-surface-raised text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                {label}
                <span className={on ? "text-accent-ink/70 ml-1.5" : "text-ink-muted/60 ml-1.5"}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border border-dashed border-line rounded-[12px] text-center px-6">
          <FileText className="w-10 h-10 text-ink-muted mb-3 opacity-40" />
          <p className="font-syne font-bold text-[18px] text-ink mb-1">
            {submissions.length === 0 ? "No submissions yet." : `Nothing ${active ? STATUS_LABEL[active].toLowerCase() : ""}.`}
          </p>
          <p className="font-mono text-[13px] text-ink-muted">
            {submissions.length === 0
              ? "Pick up a mission above and your work will show up here."
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {shown.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpen(s)}
              aria-haspopup="dialog"
              className="group block w-full text-left cursor-pointer rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
            >
              <div
                className="bg-surface-raised border border-line rounded-[12px] p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors duration-150 group-hover:border-accent-ink/30"
                style={{
                  boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                  ...(s.status === "changes_requested" ? { borderLeft: "3px solid var(--color-danger-ink)" } : null),
                }}
              >
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[1px] text-ink-muted truncate">
                    {s.projectName}
                  </span>
                  <span className="font-syne font-bold text-[16px] text-ink truncate group-hover:text-accent-ink transition-colors duration-150">
                    {s.missionTitle}
                  </span>
                  <div className="flex items-center gap-2.5 font-mono text-[12px] text-ink-muted flex-wrap">
                    <span>Submitted {formatDate(s.createdAt)}</span>
                    <span className="text-line">·</span>
                    <span>{s.screenshots.length} screenshot{s.screenshots.length !== 1 ? "s" : ""}</span>
                    {s.rating != null && (
                      <>
                        <span className="text-line">·</span>
                        <span className="inline-flex items-center gap-1 text-ink">
                          <Stars rating={s.rating} size={12} />
                          <span>{s.rating}/5</span>
                        </span>
                      </>
                    )}
                    {/* The note itself is in the dialog; the card only says one exists. */}
                    {s.reviewNote && (
                      <>
                        <span className="text-line">·</span>
                        <span className="inline-flex items-center gap-1 text-ink">
                          <MessageSquareText size={12} aria-hidden="true" />
                          Note from the builder
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {s.screenshots.length > 0 && (
                  <div className="flex gap-2 shrink-0">
                    {s.screenshots.slice(0, PREVIEW_LIMIT).map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="w-12 h-12 rounded-[8px] object-cover border border-line"
                      />
                    ))}
                  </div>
                )}

                <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2 sm:w-[132px]">
                  <StatusPill status={s.status} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="My submissions pages" className="flex items-center justify-between gap-4 mt-4">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="h-8 px-3 rounded-[8px] border border-ink-muted font-mono text-[13px] text-ink hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
          >
            ← Previous
          </button>
          <span className="font-mono text-[12px] text-ink-muted" aria-live="polite">
            Page {current + 1} of {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current === pages - 1}
            className="h-8 px-3 rounded-[8px] border border-ink-muted font-mono text-[13px] text-ink hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent"
          >
            Next →
          </button>
        </nav>
      )}

      <SubmissionDialog submission={open} onClose={() => setOpen(null)} />
    </section>
  )
}
