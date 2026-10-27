"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { MissionChips } from "@/components/missions/TestCaseView"
import { Button } from "@/components/ui/Button"
import { ScreenshotStrip } from "@/components/ScreenshotStrip"
import { screenshotList } from "@/lib/utils/screenshots"
import { PassRate, type SubmissionEntry } from "@/components/submissions/SubmissionBody"
import { testerLabel } from "@/lib/testerNumbers"
import { nextTabIndex } from "@/lib/settingsTabs"

type Mission = {
  id: string
  title: string
  task_description: string
  created_at: string
  is_active: boolean | null
  category: string | null
  device_target: string | null
  // Nullable and unbounded: the reader already does `?.[0]?.count ?? 0`, so the
  // tuple was a tighter claim than PostgREST makes.
  test_results: { count: number }[] | null
}

type TestResult = {
  id: string
  // Optional since the audit log — a submission may carry entries instead.
  tester_comment: string | null
  screenshot_url: string | null
  screenshot_urls: string[] | null
  created_at: string
  missions: { id: string; title: string } | null
  /** Per mission, from lib/testerNumbers — the same number the mission page and CSV show. */
  testerNumber: number | undefined
  entries: SubmissionEntry[] | null
}

interface Props {
  projectId: string
  missions: Mission[]
  results: TestResult[]
}

// `!== false` rather than a truthiness test: is_active is nullable, and every
// other surface in the app reads a null as still active.
function getMissionStatus(isActive: boolean | null, feedbackCount: number) {
  if (isActive === false) return "draft" as const
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

const TABS = ["missions", "feedback"] as const
type Tab = (typeof TABS)[number]

export function ProjectDetailTabs({ projectId, missions, results }: Props) {
  const [tab, setTab] = useState<Tab>("missions")
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // WAI-ARIA tabs with automatic activation: an arrow selects as well as
  // moves. Two tabs and no URL history, so nothing argues for the manual
  // activation Settings needs.
  function onKeyDown(e: React.KeyboardEvent) {
    const from = TABS.indexOf(tab)
    const to = nextTabIndex(from, e.key, TABS.length)
    if (to === from) return
    e.preventDefault()
    setTab(TABS[to])
    buttons.current[to]?.focus()
  }

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
      <div className="border-b border-line mb-8">
        <div className="flex items-end justify-between">
          <div role="tablist" aria-label="Project sections" onKeyDown={onKeyDown} className="flex flex-1 medium:flex-none items-end medium:gap-6">
            {[
              { key: "missions" as const, label: <>Test Cases</>, count: missions.length },
              // "Feedback Received (3)" cannot share 328px with "Missions (4)"
              // as fixed tabs. The word is hidden visually below 600px only;
              // the accessible name is the same at every width.
              { key: "feedback" as const, label: <>Test Reports<span className="hidden medium:inline"> Received</span></>, count: feedbackCount },
            ].map(({ key, label, count }, i) => (
              <button
                key={key}
                ref={(el) => {
                  buttons.current[i] = el
                }}
                id={`project-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`project-panel-${key}`}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                className={[
                  // Compact: M3 fixed tabs, two equal halves of the row. From
                  // 600px content-width; from lg today's desktop geometry.
                  "flex-1 medium:flex-none h-12 lg:h-auto lg:pb-3 inline-flex lg:block items-center justify-center font-mono text-[14px] font-medium transition-colors duration-150 relative",
                  tab === key ? "text-ink" : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                {/* One inline run: as flex items the label and count would
                    lose the spaces between them. */}
                <span>
                  {label}
                  {" "}
                  <span className={`font-mono text-[12px] ${tab === key ? "text-accent-ink" : "text-ink-muted"}`}>
                    ({count})
                  </span>
                </span>
                {/* accent-ink, not Voltage: Voltage is a fill, and as a 2px line on
                    the light ground it is 1.02:1. On dark they are the same. */}
                {tab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-ink rounded-full" />
                )}
              </button>
            ))}
          </div>

          {tab === "missions" && (
            <Link
              href={`/dashboard/${projectId}/mission/new`}
              // From 600px, in the tab row. Below it the Missions panel carries
              // its own full-width copy; only one is ever displayed.
              className="hidden medium:flex h-12 lg:h-9 px-4 border border-ink-muted text-ink rounded-[8px] font-mono text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 items-center gap-1.5 mb-3 w-fit"
            >
              + Add Test Case
            </Link>
          )}
        </div>
      </div>

      {/* ── MISSIONS TAB ─────────────────────────────────────────────── */}
      {tab === "missions" && (
        <div
          id="project-panel-missions"
          role="tabpanel"
          aria-labelledby="project-tab-missions"
          tabIndex={0}
          className="flex flex-col gap-3 medium:gap-4 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
        >
          {/* The empty state carries its own Add Mission, so this one waits
              for the list. */}
          {missions.length > 0 && (
            <Button variant="secondary" asChild className="medium:hidden w-full">
              <Link href={`/dashboard/${projectId}/mission/new`}>+ Add Test Case</Link>
            </Button>
          )}
          {missions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 medium:py-16 border border-dashed border-line rounded-[12px]">
              <p className="font-syne font-bold text-[24px] text-ink mb-2">No test cases added.</p>
              <p className="font-mono text-[14px] text-ink-muted mb-6 text-center">
                Add a test case to activate your project and start receiving test reports.
              </p>
              <Button variant="secondary" asChild>
                <Link href={`/dashboard/${projectId}/mission/new`}>Add Test Case</Link>
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
                  className="group relative bg-surface-raised border border-line rounded-[12px] p-4 medium:p-6 overflow-hidden transition-colors duration-150 hover:border-accent-ink/30 active:border-accent-ink has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent-ink shadow-card"
                >
                  {/* Card content */}
                  <div className="relative z-10 flex flex-col gap-3">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="font-mono text-[12px] font-medium text-accent-ink shrink-0">
                          {missionNum}
                        </span>
                        {/* The title is the card's link: its ::after stretches
                            over the whole card, padding included. */}
                        <h2 className="font-syne font-bold text-[20px] leading-7 text-ink max-medium:line-clamp-2 medium:truncate">
                          <Link
                            href={`/dashboard/${projectId}/mission/${mission.id}`}
                            className="after:absolute after:-inset-4 medium:after:-inset-6 focus-visible:outline-none"
                          >
                            {mission.title}
                          </Link>
                        </h2>
                      </div>
                      <Badge variant={status} />
                    </div>

                    <MissionChips
                      category={mission.category}
                      deviceTarget={mission.device_target}
                    />

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-line mt-1">
                      <span className="font-mono text-[12px] text-ink-muted">
                        {fbCount} Test Reports{fbCount !== 1 ? "s" : ""}
                      </span>
                      {/* Decorative: the title is the link. */}
                      <span
                        aria-hidden="true"
                        className="font-mono text-[13px] font-medium text-ink-muted group-hover:text-ink transition-colors duration-150 flex items-center gap-1"
                      >
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </span>
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
        <div
          id="project-panel-feedback"
          role="tabpanel"
          aria-labelledby="project-tab-feedback"
          tabIndex={0}
          className="flex flex-col gap-8 medium:gap-10 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
        >
          {feedbackCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 medium:py-16 border border-dashed border-line rounded-[12px]">
              <p className="font-syne font-bold text-[24px] text-ink mb-2">No test reports yet.</p>
              <p className="font-mono text-[14px] text-ink-muted">
                Share your project in the community to start receiving test reports.
              </p>
            </div>
          ) : (
            byMission.map(({ mission, items }) => (
              <div key={mission.id}>
                {/* Mission heading */}
                <h2 className="font-syne font-bold text-[20px] text-ink mb-4">
                  {mission.title}
                </h2>

                <div className="flex flex-col gap-4">
                  {items.map((result) => (
                    <Link
                      key={result.id}
                      href={`/dashboard/${projectId}/mission/${mission.id}`}
                      className="group block border-l-[3px] border-line pl-4 hover:border-accent-ink active:border-accent-ink active:bg-ink/[0.04] transition-colors duration-150"
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-[12px] text-ink-muted">
                          {testerLabel(result.testerNumber)}
                        </span>
                        <span aria-hidden="true" className="w-1 h-1 rounded-full bg-line" />
                        <span className="font-mono text-[12px] text-ink-muted">
                          {relativeTime(result.created_at)}
                        </span>
                      </div>

                      {/* Feedback body (truncated — full breakdown on mission page) */}
                      {result.entries?.length ? (
                        // A list preview, so the count only — the full log lives
                        // on the mission page this links to.
                        <PassRate entries={result.entries} />
                      ) : (
                        <p className="font-mono text-[16px] leading-6 text-ink line-clamp-3">
                          {result.tester_comment ?? "No written comment."}
                        </p>
                      )}

                      <ScreenshotStrip urls={screenshotList(result)} />

                      <span className="mt-3 inline-flex items-center gap-1 font-mono text-[12px] text-ink-muted group-hover:text-accent-ink transition-colors duration-150">
                        Read full test report
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
