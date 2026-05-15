"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, LayoutDashboard, Target, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Result =
  | { kind: "project"; id: string; name: string; description: string | null }
  | { kind: "mission"; id: string; title: string; projectName: string; projectId: string }

export function GlobalSearch() {
  const router  = useRouter()
  const supabase = createClient()

  const [query,    setQuery]    = useState("")
  const [results,  setResults]  = useState<Result[]>([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [cursor,   setCursor]   = useState(-1)

  const containerRef  = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── search ────────────────────────────────────────── */
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const pattern = `%${q}%`

    const [projectRes, missionRes] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, description")
        .ilike("name", pattern)
        .limit(5),
      supabase
        .from("missions")
        .select("id, title, project_id, projects(name)")
        .eq("is_active", true)
        .ilike("title", pattern)
        .limit(5),
    ])

    const items: Result[] = []

    for (const p of projectRes.data ?? []) {
      items.push({ kind: "project", id: p.id, name: p.name, description: p.description })
    }
    for (const m of missionRes.data ?? []) {
      const project = Array.isArray((m as any).projects)
        ? (m as any).projects[0]
        : (m as any).projects
      items.push({
        kind:        "mission",
        id:          m.id,
        title:       m.title,
        projectName: project?.name ?? "Unknown",
        projectId:   (m as any).project_id,
      })
    }

    setResults(items)
    setLoading(false)
    setCursor(-1)
  }, [supabase])

  /* debounce */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => search(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

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
    setResults([])
    if (r.kind === "project") {
      router.push(`/dashboard/${r.id}`)
    } else {
      router.push(`/dashboard/${r.projectId}/mission/${r.id}`)
    }
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
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ash pointer-events-none" />
        {loading && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ash animate-spin" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search projects or missions..."
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full h-9 pl-9 pr-8 bg-graphite border border-iron rounded-[8px] font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute top-[calc(100%+6px)] left-0 right-0 bg-graphite border border-iron rounded-[8px] overflow-hidden z-[200]"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3">
              <Loader2 className="w-3.5 h-3.5 text-ash animate-spin shrink-0" />
              <span className="font-mono text-[13px] text-ash">Searching…</span>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3">
              <p className="font-mono text-[13px] text-ash">
                No results for <span className="text-chalk">"{query}"</span>
              </p>
            </div>
          ) : (
            <div className="py-1">

              {/* Projects */}
              {projectResults.length > 0 && (
                <div>
                  <p
                    className="font-mono text-[11px] uppercase text-ash px-4 pt-3 pb-1"
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
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
                        style={{
                          background: cursor === idx ? "rgba(232,255,71,0.06)" : "transparent",
                        }}
                        onMouseEnter={() => setCursor(idx)}
                      >
                        <LayoutDashboard className="w-4 h-4 text-ash shrink-0" />
                        <div className="min-w-0">
                          <p className="font-mono text-[14px] text-chalk truncate">{r.name}</p>
                          {r.description && (
                            <p className="font-mono text-[12px] text-ash truncate">{r.description}</p>
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
                    className="font-mono text-[11px] uppercase text-ash px-4 pt-3 pb-1"
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
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
                        style={{
                          background: cursor === idx ? "rgba(232,255,71,0.06)" : "transparent",
                        }}
                        onMouseEnter={() => setCursor(idx)}
                      >
                        <Target className="w-4 h-4 text-ash shrink-0" />
                        <div className="min-w-0">
                          <p className="font-mono text-[14px] text-chalk truncate">{r.title}</p>
                          <p className="font-mono text-[12px] text-ash truncate">{r.projectName}</p>
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
