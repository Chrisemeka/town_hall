"use client"

import { useState } from "react"
import Link from "next/link"
import { FileText } from "lucide-react"
import { STATUS_LABEL, type SubmissionStatus } from "@/lib/review"
import { formatMoney } from "@/lib/tester"

export type FeedSubmission = {
  id: string
  missionId: string
  missionTitle: string
  projectName: string
  status: SubmissionStatus
  createdAt: string
  payoutCents: number
  screenshots: string[]
  reviewNote: string | null
}

const FILTERS: { label: string; status: SubmissionStatus | null }[] = [
  { label: "All", status: null },
  { label: "Pending", status: "pending" },
  { label: "Approved", status: "approved" },
  { label: "Paid", status: "paid" },
  { label: "Needs Changes", status: "changes_requested" },
]

const STATUS_STYLE: Record<SubmissionStatus, { color: string; bg: string; border: string }> = {
  pending: { color: "#E8FF47", bg: "rgba(232,255,71,0.10)", border: "rgba(232,255,71,0.30)" },
  approved: { color: "#3FFFA2", bg: "rgba(63,255,162,0.10)", border: "rgba(63,255,162,0.30)" },
  changes_requested: { color: "#FF4F4F", bg: "rgba(255,79,79,0.10)", border: "rgba(255,79,79,0.30)" },
  paid: { color: "#0E0E10", bg: "#3FFFA2", border: "#3FFFA2" },
}

const PREVIEW_LIMIT = 3

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export function SubmissionsFeed({ submissions }: { submissions: FeedSubmission[] }) {
  const [active, setActive] = useState<SubmissionStatus | null>(null)

  const counts = submissions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  const shown = active === null ? submissions : submissions.filter((s) => s.status === active)

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="font-mono text-[11px] font-medium text-ash uppercase tracking-[1px]">
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
                onClick={() => setActive(status)}
                aria-pressed={on}
                className={[
                  "font-mono text-[12px] font-medium px-3 h-8 rounded-[8px] border transition-colors duration-150 cursor-pointer",
                  on
                    ? "border-voltage/35 bg-voltage/10 text-voltage"
                    : "border-iron bg-graphite text-ash hover:text-chalk",
                ].join(" ")}
              >
                {label}
                <span className={on ? "text-voltage/70 ml-1.5" : "text-ash/60 ml-1.5"}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border border-dashed border-iron rounded-[12px] text-center px-6">
          <FileText className="w-10 h-10 text-ash mb-3 opacity-40" />
          <p className="font-syne font-bold text-[18px] text-chalk mb-1">
            {submissions.length === 0 ? "No submissions yet." : `Nothing ${active ? STATUS_LABEL[active].toLowerCase() : ""}.`}
          </p>
          <p className="font-mono text-[13px] text-ash">
            {submissions.length === 0
              ? "Pick up a mission above and your work will show up here."
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {shown.map((s) => {
            const style = STATUS_STYLE[s.status]
            const needsChanges = s.status === "changes_requested"

            return (
              <Link key={s.id} href={`/mission/${s.missionId}`} className="group block">
                <div
                  className="bg-graphite border border-iron rounded-[12px] p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors duration-150 group-hover:border-voltage/30"
                  style={{
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    ...(needsChanges ? { borderLeft: "3px solid #FF4F4F" } : null),
                  }}
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[1px] text-ash truncate">
                      {s.projectName}
                    </span>
                    <span className="font-syne font-bold text-[16px] text-chalk truncate group-hover:text-voltage transition-colors duration-150">
                      {s.missionTitle}
                    </span>
                    <div className="flex items-center gap-2.5 font-mono text-[12px] text-ash flex-wrap">
                      <span>Submitted {formatDate(s.createdAt)}</span>
                      <span className="text-iron">·</span>
                      <span>{s.screenshots.length} screenshot{s.screenshots.length !== 1 ? "s" : ""}</span>
                      {needsChanges && s.reviewNote && (
                        <>
                          <span className="text-iron">·</span>
                          <span className="text-ember truncate max-w-[280px]">{s.reviewNote}</span>
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
                          className="w-12 h-12 rounded-[8px] object-cover border border-iron"
                        />
                      ))}
                    </div>
                  )}

                  <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2 sm:w-[130px]">
                    <span
                      className="font-mono text-[11px] font-medium uppercase tracking-[0.5px] px-2.5 py-1.5 rounded-[8px] border"
                      style={{ color: style.color, background: style.bg, borderColor: style.border }}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                    {s.payoutCents > 0 && (
                      <span
                        className="font-mono font-bold text-[14px]"
                        style={{ color: s.status === "paid" ? "#3FFFA2" : "#8A8A99" }}
                      >
                        {formatMoney(s.payoutCents)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
