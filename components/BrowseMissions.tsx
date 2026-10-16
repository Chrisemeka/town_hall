"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SearchField } from "@/components/ui/SearchField"
import { MissionChips } from "@/components/missions/TestCaseView"

/** How many cards a page shows, and how many each "Load more" adds. */
const PAGE_SIZE = 6

export type BrowseMission = {
  id: string
  title: string
  created_at: string
  category: string | null
  deviceTarget: string | null
  projectId: string
  projectName: string
  projectHandle: string
  feedbackCount: number
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function BrowseMissions({ missions }: { missions: BrowseMission[] }) {
  const [query,   setQuery]   = useState("")
  const [visible, setVisible] = useState(PAGE_SIZE)

  // Pagination resets whenever the query changes. Adjusted during render
  // rather than in an effect: React re-runs this render before committing, so
  // the browser never paints the old page size against the new query. An
  // effect would paint one frame of the wrong thing, then correct it.
  const [lastQuery, setLastQuery] = useState(query)
  if (query !== lastQuery) {
    setLastQuery(query)
    setVisible(PAGE_SIZE)
  }

  const displayed = useMemo(() => {
    if (!query.trim()) return missions
    const q = query.toLowerCase()
    return missions.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.projectName.toLowerCase().includes(q),
    )
  }, [missions, query])

  /* No missions on the platform at all — distinct from a search miss */
  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-line rounded-[12px]">
        <p className="font-syne font-bold text-[24px] text-ink mb-2">No missions yet.</p>
        <p className="font-mono text-[14px] text-ink-muted mb-6">Be the first to put your work in front of the community.</p>
        <Link
          href="/dashboard/new"
          className="h-10 px-4 inline-flex items-center border border-ink text-ink rounded-[8px] font-mono font-medium text-[14px] hover:border-accent-ink hover:text-accent-ink transition-colors duration-150"
        >
          New Project
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Search */}
      <SearchField
        label="Search missions"
        placeholder="Search missions…"
        value={query}
        onChange={setQuery}
        className="w-full medium:w-[280px] mb-6 medium:mb-8"
      />

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-line rounded-[12px]">
          <p className="font-syne font-bold text-[24px] text-ink mb-2">Nothing matches.</p>
          <p className="font-mono text-[14px] text-ink-muted mb-6">Try a different search term.</p>
          <button
            onClick={() => setQuery("")}
            className="h-10 px-4 bg-transparent text-ink border border-line rounded-[8px] font-mono font-medium text-[14px] hover:border-accent-ink hover:text-accent-ink transition-colors duration-150"
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
          {displayed.slice(0, visible).map((mission, i) => {
            const num = (i + 1).toString().padStart(2, "0")
            return (
              // The whole row is the mission's link: the title's ::after
              // stretches over it. Nothing else in the row is a link.
              <div
                key={mission.id}
                className="group relative overflow-hidden bg-surface-raised border border-line rounded-[12px] px-4 py-4 medium:px-6 medium:py-5 flex items-center justify-between gap-4 transition-colors duration-150 hover:border-accent-ink/30 active:border-accent-ink has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent-ink"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                {/* Left content */}
                <div className="flex-1 min-w-0">
                  {/* Number + project · handle */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-syne font-bold text-[14px] text-accent-ink leading-none">
                      {num}
                    </span>
                    <span className="font-mono text-[12px] text-ink-muted">
                      {mission.projectName}
                      {" · "}
                      {mission.projectHandle}
                    </span>
                    <span className="font-mono text-[12px] text-ink-muted/50">
                      {relTime(mission.created_at)}
                    </span>
                  </div>

                  {/* Mission title */}
                  <h2 className="font-syne font-bold text-[18px] text-ink leading-6 max-medium:line-clamp-2 medium:truncate">
                    <Link
                      href={`/mission/${mission.id}`}
                      className="after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {mission.title}
                    </Link>
                  </h2>

                  <MissionChips
                    category={mission.category}
                    deviceTarget={mission.deviceTarget}
                    className="mt-2"
                  />

                  {/* Feedback count */}
                  {mission.feedbackCount > 0 && (
                    <p className="font-mono text-[12px] text-ink-muted mt-1">
                      {mission.feedbackCount} feedback{mission.feedbackCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Decorative: the title is the link. */}
                <span
                  aria-hidden="true"
                  className="shrink-0 flex items-center gap-1.5 font-mono text-[13px] font-medium text-ink-muted group-hover:text-accent-ink transition-colors duration-150"
                >
                  Start <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            )
          })}
          </div>

          {/* Load More */}
          {displayed.length > visible && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="h-10 px-6 border border-line text-ink rounded-[8px] font-mono text-[14px] hover:bg-surface-raised transition-colors duration-150"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
