"use client"

import { useState } from "react"
import { Download } from "lucide-react"

/**
 * Export every piece of feedback on your own projects as CSV.
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
  projects: { id: string; name: string }[]
  /** Whether there is anything to export at all. */
  hasFeedback: boolean
}) {
  const [scope, setScope] = useState("all")
  const [error, setError] = useState<string | null>(null)
  const href = `/api/export/feedback?project=${encodeURIComponent(scope)}`

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
      "twnhall-feedback.csv"
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
              href={href}
              onClick={download}
              download
              className="h-10 px-5 shrink-0 inline-flex items-center gap-2 rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
            >
              <Download size={14} aria-hidden="true" />
              Download CSV
            </a>
          </div>

          {error && (
            <p role="alert" className="font-mono text-[13px] leading-5 text-danger-ink mt-4">
              {error}
            </p>
          )}

          <p className="font-mono text-[12px] text-ink-muted mt-4 leading-5">
            Includes each tester&apos;s display name. It never includes email
            addresses — a downloaded file is out of your hands.
          </p>
        </>
      )}
    </div>
  )
}
