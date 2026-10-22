"use client"

import { useState } from "react"
import { Download, FileText } from "lucide-react"
import { inputClass } from "@/components/ui/Field"

const BUTTON =
  "h-12 lg:h-10 w-full justify-center medium:w-auto px-5 shrink-0 inline-flex items-center gap-2 rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] aria-disabled:opacity-60 aria-disabled:cursor-wait transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"

/** A project and the missions on it that have reports — nothing else is offered. */
export type ExportProject = { id: string; name: string; missions: { id: string; title: string }[] }

/**
 * Export the feedback on one of your projects, two ways from one selection:
 *
 *   - a spreadsheet: one mission as CSV, or every mission as an Excel workbook
 *     with a sheet each. A CSV cannot hold sheets, which is the only reason the
 *     format changes with the choice.
 *   - a PDF report (/api/export/report): one mission, or every mission in one
 *     document with a section each. It does not split.
 *
 * Above Danger Zone on purpose: both are operations on your own data, and
 * export-then-delete is the familiar pairing.
 *
 * A link rather than a form submit — the route is a GET, and a link keeps
 * open-in-new-tab and "save link as" working. The scope is a query parameter
 * on that link, so there is no state to submit.
 *
 * A plain click fetches instead of navigating, so a refusal (the rate limit's
 * 429, the PDF's size cap, or a failed build) can be said here in the app's
 * own alert rather than as the browser's failed-download notice. The route's
 * plain-text body is the message; it never states the limit.
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
  // "" is every mission in the project: a workbook, or one PDF with a section each.
  const [missionId, setMissionId] = useState("")
  // On by default — the report is asked to be as detailed as it can be.
  const [screenshots, setScreenshots] = useState(true)
  // The href being fetched, so only that button says it is working.
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Said at download, not left for the builder to find on page one.
  const [note, setNote] = useState<string | null>(null)

  const project = projects.find((p) => p.id === projectId)
  const workbook = missionId === ""
  const scope =
    `?project=${encodeURIComponent(projectId)}` +
    (workbook ? "" : `&mission=${encodeURIComponent(missionId)}`)
  const sheetHref = `/api/export/feedback${scope}`
  const pdfHref = `/api/export/report${scope}${screenshots ? "" : "&screenshots=0"}`

  async function download(e: React.MouseEvent<HTMLAnchorElement>, href: string, fallback: string) {
    // Modified clicks keep the link's own behaviour (new tab, save as).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (busy) return
    setError(null)
    setNote(null)
    setBusy(href)
    try {
      await save(href, fallback)
    } finally {
      setBusy(null)
    }
  }

  async function save(href: string, fallback: string) {
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
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallback
    const [failed, total] = (res.headers.get("X-Screenshots-Missing") ?? "").split("/")
    if (total) setNote(`Downloaded — ${failed} of ${total} screenshots couldn't be included. Each is marked in the PDF.`)
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h2 className="font-syne font-bold text-[20px] text-ink mb-6">
        Export your data
      </h2>

      {!hasFeedback || projects.length === 0 ? (
        // Saying so beats downloading a file with only a header row, which
        // looks like a broken export rather than an empty one.
        <p className="font-sans text-[14px] leading-6 text-ink">
          Nothing to export yet. Once testers have filed reports on your
          missions, you can download all of it as a spreadsheet or a PDF report.
        </p>
      ) : (
        <>
          <p className="font-sans text-[14px] leading-6 text-ink mb-6">
            The reports on a project — one row per test-case step, with what
            the tester did, what happened, and how to reproduce it. Pick one
            mission for a CSV, or all of them for an Excel workbook with a sheet
            per mission. Or download a PDF report to read or pass on: what to
            fix first, then every answer, step by step.
          </p>

          <div className="flex flex-col medium:flex-row medium:items-end gap-4">
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
                className={`${inputClass(false)} cursor-pointer`}
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
                className={`${inputClass(false)} cursor-pointer`}
              >
                <option value="">All missions</option>
                {(project?.missions ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col medium:flex-row medium:items-center gap-4 mt-4">
            <label className="flex items-center gap-3 min-h-12 lg:min-h-0 cursor-pointer w-fit medium:mr-auto">
              <input
                type="checkbox"
                checked={screenshots}
                onChange={(e) => setScreenshots(e.target.checked)}
                className="w-5 h-5 lg:w-4 lg:h-4 accent-voltage rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
              />
              <span className="font-mono text-[14px] text-ink">
                Include screenshots in the PDF
                <span className="block font-mono text-[12px] text-ink-muted">Makes the file larger.</span>
              </span>
            </label>

            {/* Two equal exports, so neither is the Voltage CTA. */}
            <a
              href={sheetHref}
              onClick={(e) => download(e, sheetHref, workbook ? "twnhall-feedback.xlsx" : "twnhall-feedback.csv")}
              download
              aria-disabled={busy !== null}
              className={BUTTON}
            >
              <Download size={14} aria-hidden="true" />
              {workbook ? "Download Excel" : "Download CSV"}
            </a>
            <a
              href={pdfHref}
              onClick={(e) => download(e, pdfHref, "twnhall-report.pdf")}
              download
              aria-disabled={busy !== null}
              className={BUTTON}
            >
              <FileText size={14} aria-hidden="true" />
              {busy === pdfHref ? "Preparing…" : "Download PDF"}
            </a>
          </div>

          {error && (
            <p role="alert" className="font-mono text-[13px] leading-5 text-danger-ink mt-4">
              {error}
            </p>
          )}
          {note && (
            <p role="status" className="font-mono text-[13px] leading-5 text-info-ink mt-4">
              {note}
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
