"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, LayoutDashboard, Target, Loader2 } from "lucide-react"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import type { AccountType } from "@/lib/access"
import { searchHref } from "@/lib/searchHref"
import { searchEverything, type SearchResult as Result } from "@/actions/search"

/**
 * The two roles search different things and land in different places.
 *
 * A tester searches the community — every unflagged project and active mission
 * — and opens them on /explore and /mission. A builder searches their own work
 * and opens it on /dashboard. Sending either one to the other's routes is a
 * redirect at best: accessFor() bounces a tester off /dashboard straight to
 * /explore, which is what this used to do to every result it showed them.
 */
export function GlobalSearch({
  account = "builder",
}: {
  account?: AccountType
}) {
  const router  = useRouter()

  const [query,     setQuery]     = useState("")
  const [open,      setOpen]      = useState(false)
  const [cursor,    setCursor]    = useState(-1)
  // What came back, and which query it answers. Keeping the second half is what
  // lets `loading` and the visible list be derived instead of stored — a stored
  // `loading` has to be flipped on from the effect that starts the search, and a
  // synchronous setState in an effect is a cascading render.
  const [fetched,    setFetched]    = useState<Result[]>([])
  const [fetchedFor, setFetchedFor] = useState("")

  // max-width, not !min-width: useMediaQuery answers false on the server, so
  // this way the server renders the long placeholder and only narrow clients
  // swap after hydration — rather than every desktop doing it.
  const narrow = useMediaQuery("(max-width: 599px)")
  const containerRef  = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)

  /* ── search ────────────────────────────────────────── */
  // Server-side: a builder's search filters on projects.owner_id, which a
  // signed-in user cannot read (20261006_01). See actions/search.ts.
  const search = useCallback(async (q: string) => {
    const items = await searchEverything(q)
    setFetched(items)
    setFetchedFor(q)
    setCursor(-1)
  }, [])

  /* debounce — schedules the search and nothing else */
  const longEnough = query.length >= 2
  useEffect(() => {
    if (!longEnough) return
    const timer = setTimeout(() => { void search(query) }, 250)
    return () => clearTimeout(timer)
  }, [query, longEnough, search])

  // Derived, so a slow response for an earlier query can never overwrite the
  // view for the current one: results only show while they answer what is in
  // the box, and anything else still counts as loading.
  const results = fetchedFor === query ? fetched : []
  const loading = longEnough && fetchedFor !== query

  /* close on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  /* navigate on result click */
  function navigate(r: Result) {
    setOpen(false)
    setQuery("")
    router.push(
      searchHref(account, r.kind === "project"
        ? { kind: "project", id: r.id }
        : { kind: "mission", id: r.id, projectId: r.projectId }),
    )
  }

  /* keyboard navigation */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, -1))
    } else if (e.key === "Enter" && cursor >= 0) {
      e.preventDefault()
      navigate(results[cursor])
    }
  }

  const showDropdown = open && (query.length >= 2 || loading)

  /* split results */
  const projectResults = results.filter((r): r is Extract<Result, { kind: "project" }> => r.kind === "project")
  const missionResults = results.filter((r): r is Extract<Result, { kind: "mission" }> => r.kind === "mission")

  /* flattened index for cursor tracking */
  const flatItems: Result[] = [...projectResults, ...missionResults]

  return (
    <div ref={containerRef} className="relative w-full">

      {/* Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
        {loading && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted animate-spin motion-reduce:animate-none" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          // Two placeholders rather than one truncated: at 480px the long
          // version renders as "Search projects o", which reads as a bug.
          // CSS cannot swap placeholder text, so the breakpoint is read here.
          // Text is 16px on touch so iOS does not zoom in on focus.
          placeholder={narrow ? "Search…" : "Search projects or missions..."}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full h-12 lg:h-9 pl-9 pr-8 bg-surface-raised border border-line rounded-[8px] font-mono text-[16px] pointer-fine:text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent-ink transition-colors duration-150"
        />
      </div>

      {/* Dropdown. Below 600px the field is ~160px wide, so the panel spans
          the screen under the bar instead; below 840px it stops short of the
          bottom nav and scrolls. */}
      {showDropdown && (
        <div
          className="fixed left-4 right-4 top-[60px] medium:absolute medium:top-[calc(100%+6px)] medium:left-0 medium:right-0 max-h-[calc(100dvh-140px)] overflow-y-auto expanded:max-h-none expanded:overflow-hidden bg-surface-raised border border-line rounded-[8px] z-[200]"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3">
              <Loader2 className="w-3.5 h-3.5 text-ink-muted animate-spin motion-reduce:animate-none shrink-0" />
              <span className="font-mono text-[13px] text-ink-muted">Searching…</span>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3">
              <p className="font-mono text-[13px] text-ink-muted">
                No results for <span className="text-ink">&quot;{query}&quot;</span>
              </p>
            </div>
          ) : (
            <div className="py-1">

              {/* Projects */}
              {projectResults.length > 0 && (
                <div>
                  <p
                    className="font-mono text-[12px] lg:text-[11px] uppercase text-ink-muted px-4 pt-3 pb-1"
                    style={{ letterSpacing: "1px" }}
                  >
                    Projects
                  </p>
                  {projectResults.map((r) => {
                    const idx = flatItems.indexOf(r)
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(r)}
                        className="w-full min-h-12 lg:min-h-0 flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
                        style={{
                          background: cursor === idx ? "rgba(232,255,71,0.06)" : "transparent",
                        }}
                        onMouseEnter={() => setCursor(idx)}
                      >
                        <LayoutDashboard className="w-4 h-4 text-ink-muted shrink-0" />
                        <div className="min-w-0">
                          <p className="font-mono text-[14px] text-ink truncate">{r.name}</p>
                          {r.description && (
                            <p className="font-mono text-[12px] text-ink-muted truncate">{r.description}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Missions */}
              {missionResults.length > 0 && (
                <div>
                  <p
                    className="font-mono text-[12px] lg:text-[11px] uppercase text-ink-muted px-4 pt-3 pb-1"
                    style={{ letterSpacing: "1px" }}
                  >
                    Missions
                  </p>
                  {missionResults.map((r) => {
                    const idx = flatItems.indexOf(r)
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(r)}
                        className="w-full min-h-12 lg:min-h-0 flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
                        style={{
                          background: cursor === idx ? "rgba(232,255,71,0.06)" : "transparent",
                        }}
                        onMouseEnter={() => setCursor(idx)}
                      >
                        <Target className="w-4 h-4 text-ink-muted shrink-0" />
                        <div className="min-w-0">
                          <p className="font-mono text-[14px] text-ink truncate">{r.title}</p>
                          <p className="font-mono text-[12px] text-ink-muted truncate">{r.projectName}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  )
}
