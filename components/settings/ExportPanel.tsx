"use client"

import { useState } from "react"
import { Download } from "lucide-react"

/** A project and the missions on it that have reports — nothing else is offered. */
export type ExportProject = { id: string; name: string; missions: { id: string; title: string }[] }

/**
 * Export the feedback on one of your projects: one mission as CSV, or every
 * mission as an Excel workbook with a sheet each. A CSV cannot hold sheets,
 * which is the only reason the format changes with the choice.
 *
 * Above Danger Zone on purpose: both are operations on your own data, and
 * export-then-delete is the familiar pairing.
 *
 * A link rather than a form submit — the route is a GET, and a link keeps
 * open-in-new-tab and "save link as" working. The scope is a query parameter
 * on that link, so there is no state to submit.
 *
 * A plain click fetches instead of navigating, so a refusal (the rate limit's
 * 429, or a failed build) can be said here in the app's own alert rather than
 * as the browser's failed-download notice. The route's plain-text body is the
 * message; it never states the limit.
 */
export function ExportPanel({
  projects,
  hasFeedback,
}: {
  projects: ExportProject[]
  /** Whether there is anything to export at all. */
  hasFeedback: boolean
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "")
  // "" is every mission in the project, as a workbook.
  const [missionId, setMissionId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const project = projects.find((p) => p.id === projectId)
  const workbook = missionId === ""
  const href =
    `/api/export/feedback?project=${encodeURIComponent(projectId)}` +
    (workbook ? "" : `&mission=${encodeURIComponent(missionId)}`)

  async function download(e: React.MouseEvent<HTMLAnchorElement>) {
    // Modified clicks keep the link's own behaviour (new tab, save as).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    setError(null)
    const res = await fetch(href)
    // requireAccount() redirected (session gone, role unverified): go where it said.
    if (res.redirected) {
      window.location.href = res.url
      return
    }
    if (!res.ok) {
      setError((await res.text()) || "Could not build the export.")
      return
    }
    const name =
      /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
      (workbook ? "twnhall-feedback.xlsx" : "twnhall-feedback.csv")
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h5 className="font-syne font-bold text-[20px] text-ink mb-6">
        Export your data
      </h5>

      {!hasFeedback || projects.length === 0 ? (
        // Saying so beats downloading a file with only a header row, which
        // looks like a broken export rather than an empty one.
        <p className="font-sans text-[14px] leading-6 text-ink">
          Nothing to export yet. Once testers have filed reports on your
          missions, you can download all of it as a spreadsheet.
        </p>
      ) : (
        <>
          <p className="font-sans text-[14px] leading-6 text-ink mb-6">
            The reports on a project — one row per test-case step, with what
            the tester did, what happened, and how to reproduce it. Pick one
            mission for a CSV, or all of them for an Excel workbook with a sheet
            per mission. Both open in Excel, Numbers or Google Sheets.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <label htmlFor="project" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
                Project
              </label>
              <select
                id="project"
                name="project"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value)
                  // Another project's mission id would match nothing.
                  setMissionId("")
                }}
                className="h-10 w-full rounded-[8px] border border-ink-muted bg-surface px-4 font-mono text-[14px] text-ink focus:outline-none focus:border-accent-ink transition-colors duration-150 cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <label htmlFor="mission" className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
                Mission
              </label>
              <select
                id="mission"
                name="mission"
                value={missionId}
                onChange={(e) => setMissionId(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-ink-muted bg-surface px-4 font-mono text-[14px] text-ink focus:outline-none focus:border-accent-ink transition-colors duration-150 cursor-pointer"
              >
                <option value="">All missions — one sheet each</option>
                {(project?.missions ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            <a
              href={href}
              onClick={download}
              download
              className="h-10 px-5 shrink-0 inline-flex items-center gap-2 rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
            >
              <Download size={14} aria-hidden="true" />
              {workbook ? "Download Excel" : "Download CSV"}
            </a>
          </div>

          {error && (
            <p role="alert" className="font-mono text-[13px] leading-5 text-danger-ink mt-4">
              {error}
            </p>
          )}

          <p className="font-mono text-[12px] text-ink-muted mt-4 leading-5">
            Testers appear as Tester 1, 2, 3 — numbered within each mission, so
            Tester 1 on two missions is two different people. No names or email
            addresses: a downloaded file is out of your hands.
          </p>
        </>
      )}
    </div>
  )
}
