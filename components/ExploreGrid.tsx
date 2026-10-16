"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SearchField } from "@/components/ui/SearchField"
import { inputClass } from "@/components/ui/Field"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/Badge"
import { UNCATEGORISED_LABEL } from "@/lib/vocabulary"

export type ExploreProject = {
  id: string
  name: string
  description: string | null
  app_url: string | null
  category: string | null
  created_at: string
  missionCount: number
  feedbackCount: number
  firstMissionId: string | null
  status: "active" | "needs-testers"
}

type Filter = "all" | "needs"

// "Recently Added" sorted by created_at, which is the order the page already
// loads in, so it was the same list as "All". "Need Testers" narrows to the
// projects whose card carries that badge: no reports yet.
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",   label: "All"          },
  { key: "needs", label: "Need Testers" },
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

/** How many cards a page shows, and how many each "Load more" adds. */
const PAGE_SIZE = 6

export function ExploreGrid({ projects }: { projects: ExploreProject[] }) {
  const [filter,  setFilter]  = useState<Filter>("all")
  const [query,   setQuery]   = useState("")
  // "" means every category. Only categories actually present are offered —
  // listing all fourteen when eleven match nothing is eleven dead options.
  const [category, setCategory] = useState("")
  const [visible, setVisible] = useState(PAGE_SIZE)

  // Pagination resets whenever the filter or query changes. Adjusted during render
  // rather than in an effect: React re-runs this render before committing, so
  // the browser never paints the old page size against the new filter or query. An
  // effect would paint one frame of the wrong thing, then correct it.
  const [lastFilter, setLastFilter] = useState(filter)
  const [lastQuery,  setLastQuery]  = useState(query)
  const [lastCategory, setLastCategory] = useState(category)
  if (filter !== lastFilter || query !== lastQuery || category !== lastCategory) {
    setLastFilter(filter)
    setLastQuery(query)
    setLastCategory(category)
    setVisible(PAGE_SIZE)
  }

  const presentCategories = useMemo(
    () =>
      Array.from(new Set(projects.map((p) => p.category).filter((c): c is string => !!c))).sort(),
    [projects],
  )

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

    /* Category */
    if (category) {
      list = list.filter((p) => p.category === category)
    }

    /* Need Testers */
    if (filter === "needs") {
      list = list.filter((p) => p.status === "needs-testers")
    }

    return list
  }, [projects, filter, query, category])

  /* No projects on the platform at all — distinct from a filter/search miss */
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-line rounded-[12px]">
        <p className="font-syne font-bold text-[24px] text-ink mb-2">Nothing to test yet.</p>
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
      {/* Filters + Search */}
      {/* Below 840px each control is a full-width row, search first: it is
          the one most used. order-* only, so the DOM order is unchanged. */}
      <div id="tour-explore-filters" className="flex flex-col gap-3 expanded:flex-row expanded:items-center expanded:flex-wrap expanded:justify-between expanded:gap-4 mb-6 medium:mb-8">
        {/* Pill filters */}
        <div className="flex items-center gap-x-2 gap-y-4 flex-wrap">
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
                        color: "var(--color-accent-ink)",
                      }
                    : {
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-line)",
                        color: "var(--color-ink-muted)",
                      }
                }
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Category filter — a select rather than more pills: fourteen pills
            would wrap to three rows and swamp the sort row above them. Only
            categories present in the loaded set are offered. */}
        {presentCategories.length > 0 && (
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            // The shared chrome so iOS does not zoom; 36px from lg, matching
            // the search beside it.
            className={cn(inputClass(false, { raised: true }), "lg:h-9 w-full expanded:w-auto shrink-0 cursor-pointer")}
          >
            <option value="">All categories</option>
            {presentCategories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}

        {/* Search */}
        <SearchField
          label="Search projects"
          placeholder="Search projects…"
          value={query}
          onChange={setQuery}
          className="order-first expanded:order-none w-full expanded:w-[280px] shrink-0"
        />
      </div>

      {/* Grid */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-line rounded-[12px]">
          <p className="font-syne font-bold text-[24px] text-ink mb-2">Nothing matches.</p>
          <p className="font-mono text-[14px] text-ink-muted mb-6">Try a broader search or clear your filters.</p>
          <button
            onClick={() => { setFilter("all"); setQuery(""); setCategory("") }}
            className="h-10 px-4 bg-transparent text-ink border border-line rounded-[8px] font-mono font-medium text-[14px] hover:border-accent-ink hover:text-accent-ink transition-colors duration-150"
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
                className="bg-surface-raised border border-line rounded-[12px] p-6 flex flex-col transition-colors duration-150 hover:border-accent-ink/30"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                {/* Name + badge */}
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h5 className="font-syne font-bold text-[20px] leading-7 text-ink truncate">
                    {project.name}
                  </h5>
                  <Badge variant={project.status} />
                </div>

                {/* Category chip. Design.md §5.4: the label carries the meaning,
                    never the colour on its own — and an uncategorised project
                    says so rather than being quietly folded into a real one. */}
                <div className="mb-2">
                  <span
                    className={[
                      "inline-block font-mono text-[12px] font-medium tracking-[0.5px] rounded-[4px] px-2 py-0.5 border",
                      project.category
                        ? "text-ink border-line bg-surface"
                        : "text-ink-muted border-line/60 bg-transparent",
                    ].join(" ")}
                  >
                    {project.category ?? UNCATEGORISED_LABEL}
                  </span>
                </div>

                {/* @handle · time */}
                <p className="font-mono text-[12px] text-ink-muted mb-3">
                  {handleFromUrl(project.app_url, project.name)}
                  {" · "}
                  {relativeTime(project.created_at)}
                </p>

                {/* Description */}
                <p className="font-mono text-[14px] leading-5 text-ink-muted line-clamp-2 mb-4 flex-1">
                  {project.description || "No description provided."}
                </p>

                {/* URL */}
                {project.app_url && (
                  <p className="font-mono text-[13px] text-info-ink truncate mb-5">
                    {project.app_url.replace(/^https?:\/\//, "")}
                  </p>
                )}

                {/* Footer */}
                <div className="pt-4 border-t border-line flex items-center justify-between">
                  <span className="font-mono text-[12px] text-ink-muted">
                    {project.missionCount} Mission{project.missionCount !== 1 ? "s" : ""}
                    {" · "}
                    {project.feedbackCount} Feedback{project.feedbackCount !== 1 ? "s" : ""}
                  </span>

                  {project.missionCount > 0 ? (
                    <Link
                      href={`/explore/project/${project.id}`}
                      className="font-mono text-[13px] font-medium text-ink-muted hover:text-ink transition-colors duration-150 flex items-center gap-1"
                    >
                      Test it <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <span className="font-mono text-[12px] text-ink-muted/50 italic">No missions yet</span>
                  )}
                </div>
              </div>
            ))}
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
