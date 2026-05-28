"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"

type Mission = {
  id: string
  title: string
  task_description: string
  created_at: string
  is_active: boolean
  test_results: [{ count: number }] | []
}

type TestResult = {
  id: string
  tester_comment: string
  screenshot_url: string
  created_at: string
  missions: { id: string; title: string } | null
}

interface Props {
  projectId: string
  missions: Mission[]
  results: TestResult[]
}

function getMissionStatus(isActive: boolean, feedbackCount: number) {
  if (!isActive) return "draft" as const
  if (feedbackCount === 0) return "needs-testers" as const
  return "active" as const
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ProjectDetailTabs({ projectId, missions, results }: Props) {
  const [tab, setTab] = useState<"missions" | "feedback">("missions")

  const feedbackCount = results.length

  /* Group results by mission for the feedback tab */
  const byMission = missions
    .map((m) => ({
      mission: m,
      items: results.filter((r) => r.missions?.id === m.id),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div>
      {/* Tab bar + action button */}
      <div className="border-b border-iron mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-0">
          <div className="flex items-end gap-4 sm:gap-6">
            {[
              { key: "missions",  label: `Missions`,          count: missions.length },
              { key: "feedback",  label: `Feedback Received`, count: feedbackCount  },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key as typeof tab)}
                className={[
                  "pb-3 font-mono text-[14px] font-medium transition-colors duration-150 relative",
                  tab === key ? "text-chalk" : "text-ash hover:text-chalk",
                ].join(" ")}
              >
                {label}
                {" "}
                <span className={`font-mono text-[12px] ${tab === key ? "text-voltage" : "text-ash/60"}`}>
                  ({count})
                </span>
                {tab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-voltage rounded-full" />
                )}
              </button>
            ))}
          </div>

          {tab === "missions" && (
            <Link
              href={`/dashboard/${projectId}/mission/new`}
              className="self-end sm:self-auto h-9 px-4 border border-iron text-chalk rounded-[8px] font-mono text-[14px] hover:border-ash transition-colors duration-150 flex items-center gap-1.5 mb-3 w-fit"
            >
              + Add Mission
            </Link>
          )}
        </div>
      </div>

      {/* ── MISSIONS TAB ─────────────────────────────────────────────── */}
      {tab === "missions" && (
        <div className="flex flex-col gap-4">
          {missions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-iron rounded-[12px]">
              <p className="font-syne font-bold text-[24px] text-chalk mb-2">No missions added.</p>
              <p className="font-mono text-[14px] text-ash mb-6 text-center">
                Add a mission to activate your project and start receiving tester feedback.
              </p>
              <Button variant="secondary" asChild>
                <Link href={`/dashboard/${projectId}/mission/new`}>Add Mission</Link>
              </Button>
            </div>
          ) : (
            missions.map((mission, i) => {
              const fbCount = mission.test_results?.[0]?.count ?? 0
              const missionNum = String(i + 1).padStart(2, "0")
              const status = getMissionStatus(mission.is_active, fbCount)

              return (
                <div
                  key={mission.id}
                  className="relative bg-graphite border border-iron rounded-[12px] p-6 overflow-hidden transition-colors duration-150 hover:border-voltage/30"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
                >
                  {/* Card content */}
                  <div className="relative z-10 flex flex-col gap-3">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="font-mono text-[12px] font-medium text-voltage shrink-0">
                          {missionNum}
                        </span>
                        <h5 className="font-syne font-bold text-[20px] leading-7 text-chalk truncate">
                          {mission.title}
                        </h5>
                      </div>
                      <Badge variant={status} />
                    </div>

                    {/* Description */}
                    <p className="font-mono text-[14px] leading-5 text-ash line-clamp-3">
                      {mission.task_description}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-iron mt-1">
                      <span className="font-mono text-[12px] text-ash">
                        {fbCount} Feedback{fbCount !== 1 ? "s" : ""}
                      </span>
                      <Link
                        href={`/dashboard/${projectId}/mission/${mission.id}`}
                        className="font-mono text-[13px] font-medium text-ash hover:text-chalk transition-colors duration-150 flex items-center gap-1"
                      >
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── FEEDBACK RECEIVED TAB ─────────────────────────────────────── */}
      {tab === "feedback" && (
        <div className="flex flex-col gap-10">
          {feedbackCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-iron rounded-[12px]">
              <p className="font-syne font-bold text-[24px] text-chalk mb-2">No feedback yet.</p>
              <p className="font-mono text-[14px] text-ash">
                Share your project in the community to start receiving feedback.
              </p>
            </div>
          ) : (
            byMission.map(({ mission, items }) => (
              <div key={mission.id}>
                {/* Mission heading */}
                <h5 className="font-syne font-bold text-[20px] text-chalk mb-4">
                  {mission.title}
                </h5>

                <div className="flex flex-col gap-4">
                  {items.map((result, idx) => (
                    <Link
                      key={result.id}
                      href={`/dashboard/${projectId}/mission/${mission.id}`}
                      className="group block border-l-[3px] border-iron pl-4 hover:border-voltage transition-colors duration-150"
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-[12px] text-ash">
                          Developer #{String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-iron" />
                        <span className="font-mono text-[12px] text-ash">
                          {relativeTime(result.created_at)}
                        </span>
                      </div>

                      {/* Feedback body (truncated — full breakdown on mission page) */}
                      <p className="font-mono text-[16px] leading-6 text-chalk line-clamp-3">
                        {result.tester_comment}
                      </p>

                      <span className="mt-3 inline-flex items-center gap-1 font-mono text-[12px] text-ash group-hover:text-voltage transition-colors duration-150">
                        Read full feedback
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
