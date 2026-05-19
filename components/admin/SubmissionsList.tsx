import Link from "next/link"
import { Smile, Meh, Frown, ExternalLink } from "lucide-react"
import { SubmissionRowActions } from "./SubmissionRowActions"

export type Sentiment = "POSITIVE" | "NEUTRAL" | "FRUSTRATED" | "UNKNOWN"

export type SubmissionRow = {
  id: string
  createdAt: string
  testerComment: string
  aiSummary: string | null
  aiSentiment: Sentiment
  screenshotUrl: string | null
  mission: { id: string; title: string } | null
  project: { id: string; name: string } | null
  tester: { fullName: string; email: string; avatarUrl: string | null }
}

export function normalizeSentiment(s: string | null): Sentiment {
  if (!s) return "UNKNOWN"
  const u = s.toUpperCase()
  if (u === "POSITIVE" || u === "NEUTRAL" || u === "FRUSTRATED") return u
  return "UNKNOWN"
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function initials(name: string, email: string) {
  const source = name || email
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("")
}

function sentimentStyle(s: Sentiment) {
  switch (s) {
    case "POSITIVE":   return { bg: "rgba(122,225,138,0.10)", color: "#7AE18A", border: "1px solid rgba(122,225,138,0.4)", Icon: Smile }
    case "NEUTRAL":    return { bg: "rgba(124,124,138,0.10)", color: "#A1A1AA", border: "1px solid rgba(124,124,138,0.4)", Icon: Meh }
    case "FRUSTRATED": return { bg: "rgba(255,79,79,0.10)",   color: "#FF4F4F", border: "1px solid rgba(255,79,79,0.4)",  Icon: Frown }
    case "UNKNOWN":    return { bg: "rgba(124,124,138,0.10)", color: "#7C7C8A", border: "1px solid rgba(124,124,138,0.4)", Icon: Meh }
  }
}

export function SubmissionsList({
  submissions,
  showContext = true,
  emptyMessage = "No submissions yet.",
}: {
  submissions: SubmissionRow[]
  showContext?: boolean
  emptyMessage?: string
}) {
  if (submissions.length === 0) {
    return (
      <div className="px-5 py-16 text-center font-mono text-[13px] text-ash">
        {emptyMessage}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-iron/60">
      {submissions.map((s) => {
        const sentiment = sentimentStyle(s.aiSentiment)
        const SentimentIcon = sentiment.Icon
        return (
          <li key={s.id} className="p-5 hover:bg-obsidian/20 transition-colors duration-150">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-obsidian border border-iron flex items-center justify-center overflow-hidden shrink-0">
                {s.tester.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.tester.avatarUrl} alt={s.tester.fullName || s.tester.email} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-mono text-[12px] text-ash">{initials(s.tester.fullName, s.tester.email)}</span>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                {/* Header line */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1 justify-between">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span className="font-mono text-[13px] text-chalk truncate">
                      {s.tester.fullName || s.tester.email || "Unknown tester"}
                    </span>
                    <span className="font-mono text-[12px] text-ash">·</span>
                    <span className="font-mono text-[12px] text-ash whitespace-nowrap">
                      {formatDateTime(s.createdAt)}
                    </span>
                  </div>
                  <SubmissionRowActions submissionId={s.id} />
                </div>

                {/* Context (project › mission) + sentiment */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 font-mono text-[12px] text-ash">
                  {showContext && (
                    <>
                      {s.project ? (
                        <span className="text-chalk truncate max-w-[200px]">{s.project.name}</span>
                      ) : (
                        <span className="text-ember">project missing</span>
                      )}
                      <span>›</span>
                      {s.mission ? (
                        <Link
                          href={`/admin/missions/${s.mission.id}`}
                          className="text-ash hover:text-voltage transition-colors duration-150 truncate max-w-[260px]"
                        >
                          {s.mission.title}
                        </Link>
                      ) : (
                        <span className="text-ember">mission missing</span>
                      )}
                    </>
                  )}
                  <span
                    className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.5px] rounded px-2 py-0.5"
                    style={{ background: sentiment.bg, color: sentiment.color, border: sentiment.border }}
                  >
                    <SentimentIcon className="w-3 h-3" />
                    {s.aiSentiment.toLowerCase()}
                  </span>
                </div>

                {/* Tester comment */}
                {s.testerComment && (
                  <p className="font-mono text-[14px] text-chalk leading-5 whitespace-pre-wrap mb-3">
                    {s.testerComment}
                  </p>
                )}

                {/* AI summary */}
                {s.aiSummary && (
                  <div
                    className="rounded-[8px] p-3 mb-3"
                    style={{ background: "rgba(232,255,71,0.04)", border: "1px solid rgba(232,255,71,0.15)" }}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[1px] text-voltage mb-1">AI Summary</p>
                    <p className="font-mono text-[13px] text-ash leading-5">{s.aiSummary}</p>
                  </div>
                )}

                {/* Screenshot */}
                {s.screenshotUrl && (
                  <Link
                    href={s.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-2 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.screenshotUrl}
                      alt="Tester screenshot"
                      className="w-32 h-20 object-cover rounded-[6px] border border-iron group-hover:border-voltage/40 transition-colors duration-150"
                    />
                    <span className="font-mono text-[12px] text-ash group-hover:text-voltage transition-colors duration-150 inline-flex items-center gap-1 mt-1">
                      View full <ExternalLink className="w-3 h-3" />
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
