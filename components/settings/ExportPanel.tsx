"use client"

import { useState } from "react"
import { Download } from "lucide-react"

/**
 * Export every piece of feedback on your own projects as CSV.
 *
 * Above Danger Zone on purpose: both are operations on your own data, and
 * export-then-delete is the familiar pairing.
 *
 * A link rather than a form submit — the route is a GET, the browser handles
 * the download from Content-Disposition, and a link keeps open-in-new-tab and
 * "save link as" working. The scope is a query parameter on that link, so
 * there is no state to submit.
 */
export function ExportPanel({
  projects,
  hasFeedback,
}: {
  projects: { id: string; name: string }[]
  /** Whether there is anything to export at all. */
  hasFeedback: boolean
}) {
  const [scope, setScope] = useState("all")

  return (
    <div>
      <h5 className="font-syne font-bold text-[20px] text-ink mb-6">
        Export your data
      </h5>

      {!hasFeedback ? (
        // Saying so beats downloading a file with only a header row, which
        // looks like a broken export rather than an empty one.
        <p className="font-sans text-[14px] leading-6 text-ink">
          Nothing to export yet. Once testers have filed reports on your
          missions, you can download all of it as a spreadsheet.
        </p>
      ) : (
        <>
          <p className="font-sans text-[14px] leading-6 text-ink mb-6">
            Every report on your projects as a CSV — one row per test-case
            step, with what the tester did, what happened, and how to reproduce
            it. Opens in Excel, Numbers or Google Sheets.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <label
                htmlFor="project"
                className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]"
              >
                Scope
              </label>
              <select
                id="project"
                name="project"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="h-10 w-full rounded-[8px] border border-ink-muted bg-surface px-4 font-mono text-[14px] text-ink focus:outline-none focus:border-accent-ink transition-colors duration-150 cursor-pointer"
              >
                <option value="all">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <a
              href={`/api/export/feedback?project=${encodeURIComponent(scope)}`}
              download
              className="h-10 px-5 shrink-0 inline-flex items-center gap-2 rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
            >
              <Download size={14} aria-hidden="true" />
              Download CSV
            </a>
          </div>

          <p className="font-mono text-[12px] text-ink-muted mt-4 leading-5">
            Includes each tester&apos;s display name. It never includes email
            addresses — a downloaded file is out of your hands.
          </p>
        </>
      )}
    </div>
  )
}
