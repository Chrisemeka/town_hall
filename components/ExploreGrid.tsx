"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Search, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/Badge"

export type ExploreProject = {
  id: string
  name: string
  description: string | null
  app_url: string | null
  created_at: string
  missionCount: number
  feedbackCount: number
  firstMissionId: string | null
  status: "active" | "needs-testers"
}

type Filter = "all" | "recent"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",    label: "All"            },
  { key: "recent", label: "Recently Added" },
]

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function handleFromUrl(url: string | null, name: string) {
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "")
      const slug = host.split(".")[0]
      return `@${slug}`
    } catch { /* fall through */ }
  }
  return `@${name.toLowerCase().replace(/\s+/g, "")}`
}

export function ExploreGrid({ projects }: { projects: ExploreProject[] }) {
  const [filter,  setFilter]  = useState<Filter>("all")
  const [query,   setQuery]   = useState("")
  const [visible, setVisible] = useState(6)

  /* reset pagination whenever the filtered set changes */
  useEffect(() => setVisible(6), [filter, query])

  const displayed = useMemo(() => {
    let list = [...projects]

    /* Search */
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      )
    }

    /* Sort */
    if (filter === "recent") {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return list
  }, [projects, filter, query])

  return (
    <div>
      {/* Filters + Search */}
      <div id="tour-explore-filters" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        {/* Pill filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="h-8 px-4 font-mono text-[13px] font-medium transition-colors duration-200 rounded-full"
                style={
                  active
                    ? {
                        background: "rgba(232,255,71,0.12)",
                        border: "1px solid rgba(232,255,71,0.4)",
                        color: "#E8FF47",
                      }
                    : {
                        background: "#1A1A1F",
                        border: "1px solid #2C2C35",
                        color: "#8A8A99",
                      }
                }
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-[280px] shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ash pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-graphite border border-iron rounded-[8px] font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150"
          />
        </div>
      </div>

      {/* Grid */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-iron rounded-[12px]">
          <p className="font-syne font-bold text-[24px] text-chalk mb-2">Nothing matches.</p>
          <p className="font-mono text-[14px] text-ash mb-6">Try a broader search or clear your filters.</p>
          <button
            onClick={() => { setFilter("all"); setQuery("") }}
            className="h-10 px-4 bg-transparent text-chalk border border-iron rounded-[8px] font-mono font-medium text-[14px] hover:border-voltage hover:text-voltage transition-colors duration-150"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayed.slice(0, visible).map((project) => (
              <div
                key={project.id}
                className="bg-graphite border border-iron rounded-[12px] p-6 flex flex-col transition-colors duration-150 hover:border-voltage/30"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                {/* Name + badge */}
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h5 className="font-syne font-bold text-[20px] leading-7 text-chalk truncate">
                    {project.name}
                  </h5>
                  <Badge variant={project.status} />
                </div>

                {/* @handle · time */}
                <p className="font-mono text-[12px] text-ash mb-3">
                  {handleFromUrl(project.app_url, project.name)}
                  {" · "}
                  {relativeTime(project.created_at)}
                </p>

                {/* Description */}
                <p className="font-mono text-[14px] leading-5 text-ash line-clamp-2 mb-4 flex-1">
                  {project.description || "No description provided."}
                </p>

                {/* URL */}
                {project.app_url && (
                  <p className="font-mono text-[13px] text-sky truncate mb-5">
                    {project.app_url.replace(/^https?:\/\//, "")}
                  </p>
                )}

                {/* Footer */}
                <div className="pt-4 border-t border-iron flex items-center justify-between">
                  <span className="font-mono text-[12px] text-ash">
                    {project.missionCount} Mission{project.missionCount !== 1 ? "s" : ""}
                    {" · "}
                    {project.feedbackCount} Feedback{project.feedbackCount !== 1 ? "s" : ""}
                  </span>

                  {project.missionCount > 0 ? (
                    <Link
                      href={`/explore/project/${project.id}`}
                      className="font-mono text-[13px] font-medium text-ash hover:text-chalk transition-colors duration-150 flex items-center gap-1"
                    >
                      Test it <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <span className="font-mono text-[12px] text-ash/50 italic">No missions yet</span>
                  )}
                </div>
              </div>
            ))}
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
