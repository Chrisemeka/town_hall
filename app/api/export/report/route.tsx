import { renderToBuffer } from "@react-pdf/renderer"
// requireAccount, not a hand-rolled getUser(): it carries the
// email-confirmation and per-role verification gates with it.
import { requireAccount } from "@/lib/auth"
import { download, loadFeedback, slug, today } from "@/lib/exportDb"
import { checkRateLimit, tooManyResponse } from "@/lib/rateLimitDb"
import { buildReport, reportCapMessage, screenshotsMissing } from "@/lib/report"
import { fetchScreenshots, isMiss } from "@/lib/reportImages"
import { screenshotList } from "@/lib/utils/screenshots"
import { ReportDocument } from "@/components/report/ReportDocument"

/*
 * The feedback on one project as a PDF report — one mission, or every mission
 * in one document with a section each. The selection is ExportPanel's, shared
 * with the CSV route beside this one.
 *
 * THIS ROUTE HAS NO MIDDLEWARE. app/api is outside middleware.ts's matcher, so
 * requireAccount() below is the only gate, not a second opinion.
 *
 * OWNERSHIP is loadFeedback()'s owner_id filter (lib/exportDb.ts), proven from
 * the data, never from the request.
 *
 * The work is capped before anything is fetched or rendered (lib/report.ts):
 * a function timing out halfway through a render is a broken download with
 * no explanation, so an oversized request is refused with a message instead.
 */

// Room for 40 screenshot fetches and a long render, inside the caps.
export const maxDuration = 60

export async function GET(request: Request) {
  const { userId } = await requireAccount("builder")

  // ponytail: free to every builder for now, by decision. A plan gate goes
  // here: resolve the plan via planIdFor() (lib/vocabulary.ts) off the
  // builder's accounts row, the same resolution lib/allowance.ts runs at
  // publish. Put "Shareable formatted report" back on Pro in lib/plans.ts in
  // the same change, and not before.

  // Its own rule, not export:account: a render with images is far heavier
  // than a CSV. Tier 2, fails closed.
  const rate = await checkRateLimit(["export:pdf:account", userId])
  if (!rate.ok) return tooManyResponse(rate.retryAfter)

  const params = new URL(request.url).searchParams
  const project = params.get("project")
  const mission = params.get("mission")
  const withScreenshots = params.get("screenshots") !== "0"
  if (!project) return new Response("Choose a project to export.", { status: 400 })

  const { rows, error } = await loadFeedback(userId, project, mission)
  if (error) {
    console.error("[export/report] query failed:", error)
    return new Response("Could not build the report.", { status: 500 })
  }
  // The same answer for "not yours" and "no reports yet" — the CSV's words.
  if (rows.length === 0) return new Response("Nothing to export there yet.", { status: 404 })

  const urls = withScreenshots ? rows.flatMap(screenshotList) : []
  const tooMuch = reportCapMessage(rows.length, urls.length, !!mission)
  if (tooMuch) return new Response(tooMuch, { status: 413 })

  const report = buildReport(rows, !!mission)
  try {
    const images = withScreenshots ? await fetchScreenshots(urls) : null
    // Once per image left out, with its reason and report. Never the URL: it
    // is the storage path of a builder's private screenshot.
    for (const r of images ? rows : []) {
      for (const url of screenshotList(r)) {
        const img = images?.get(url)
        if (isMiss(img)) {
          console.warn("[export/report] screenshot left out", { reason: img?.failed, detail: img?.detail, report: r.id })
        }
      }
    }
    const pdf = await renderToBuffer(<ReportDocument report={report} images={images} />)
    const res = download(
      new Uint8Array(pdf),
      "application/pdf",
      `${slug(report.project)}-${mission ? slug(report.scope) : "all-missions"}-report-${today()}.pdf`,
    )
    // ExportPanel reads this to say so at download, not only on page one.
    const missing = screenshotsMissing(images)
    if (missing) res.headers.set("X-Screenshots-Missing", `${missing.failed}/${missing.total}`)
    return res
  } catch (e) {
    console.error("[export/report] render failed:", e)
    return new Response("Could not build the report.", { status: 500 })
  }
}
