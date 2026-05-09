"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Search, ArrowRight } from "lucide-react"

export type BrowseMission = {
  id: string
  title: string
  created_at: string
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

function handleFromUrl(url: string | null, name: string) {
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "")
      return `@${host.split(".")[0]}`
    } catch { /* fall through */ }
  }
  return `@${name.toLowerCase().replace(/\s+/g, "")}`
}

export function BrowseMissions({ missions }: { missions: BrowseMission[] }) {
  const [query,   setQuery]   = useState("")
  const [visible, setVisible] = useState(6)

  useEffect(() => setVisible(6), [query])

  const displayed = useMemo(() => {
    if (!query.trim()) return missions
    const q = query.toLowerCase()
    return missions.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.projectName.toLowerCase().includes(q),
    )
  }, [missions, query])

  return (
    <div>
      {/* Search */}
      <div className="relative w-full sm:w-[280px] mb-8">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ash pointer-events-none" />
        <input
          type="text"
          placeholder="Search missions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-9 pl-9 pr-4 bg-graphite border border-iron rounded-[8px] font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150"
        />
      </div>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-iron rounded-[12px]">
          <p className="font-syne font-bold text-[24px] text-chalk mb-2">Nothing matches.</p>
          <p className="font-mono text-[14px] text-ash mb-6">Try a different search term.</p>
          <button
            onClick={() => setQuery("")}
            className="h-10 px-4 bg-transparent text-chalk border border-iron rounded-[8px] font-mono font-medium text-[14px] hover:border-voltage hover:text-voltage transition-colors duration-150"
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
              <div
                key={mission.id}
                className="relative overflow-hidden bg-graphite border border-iron rounded-[12px] px-6 py-5 flex items-center justify-between gap-4 transition-colors duration-150 hover:border-voltage/30"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                {/* Watermark number */}
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 font-syne font-bold select-none pointer-events-none leading-none text-voltage"
                  style={{ fontSize: 96, opacity: 0.08 }}
                  aria-hidden="true"
                >
                  {num}
                </span>

                {/* Left content */}
                <div className="flex-1 min-w-0 relative z-10">
                  {/* Number + project · handle */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="font-syne font-bold text-voltage leading-none"
                      style={{ fontSize: 14 }}
                    >
                      {num}
                    </span>
                    <span className="font-mono text-[12px] text-ash">
                      {mission.projectName}
                      {" · "}
                      {mission.projectHandle}
                    </span>
                    <span className="font-mono text-[12px] text-ash/50">
                      {relTime(mission.created_at)}
                    </span>
                  </div>

                  {/* Mission title */}
                  <p className="font-syne font-bold text-[18px] text-chalk leading-6 truncate">
                    {mission.title}
                  </p>

                  {/* Feedback count */}
                  {mission.feedbackCount > 0 && (
                    <p className="font-mono text-[12px] text-ash mt-1">
                      {mission.feedbackCount} feedback{mission.feedbackCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Start → */}
                <Link
                  href={`/mission/${mission.id}`}
                  className="shrink-0 relative z-10 flex items-center gap-1.5 font-mono text-[13px] font-medium text-ash hover:text-voltage transition-colors duration-150"
                >
                  Start <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )
          })}
          </div>

          {/* Load More */}
          {displayed.length > visible && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setVisible((v) => v + 6)}
                className="h-10 px-6 border border-iron text-chalk rounded-[8px] font-mono text-[14px] hover:bg-graphite transition-colors duration-150"
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
