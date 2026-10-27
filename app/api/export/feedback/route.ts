// requireAccount, not a hand-rolled getUser(): it carries the
// email-confirmation and per-role verification gates with it, and skipping
// either here would make this route a way around them.
import { requireAccount } from "@/lib/auth"
import { CSV_BOM, toCsv } from "@/lib/csv"
import { testerNumbers } from "@/lib/testerNumbers"
import { screenshotList } from "@/lib/utils/screenshots"
import { sheetNames, toXlsx, type Cell } from "@/lib/xlsx"
import { checkRateLimit, tooManyResponse } from "@/lib/rateLimitDb"
import { deviceTargetLabel, testCategoryLabel } from "@/lib/vocabulary"
import { download, loadFeedback, slug, today, type FeedbackRow } from "@/lib/exportDb"

/*
 * Every piece of feedback on the caller's own projects, one row per test-case
 * step.
 *
 * THIS ROUTE HAS NO MIDDLEWARE. `middleware.ts`'s matcher excludes `api` in
 * its negative lookahead, so app/api/** is not gated at all. CLAUDE.md's
 * two-layer rule — middleware AND an in-code check — has one of its layers
 * structurally absent here, which makes requireAccount() below the only
 * opinion rather than a second one. Do not remove it on the grounds that
 * "middleware handles it".
 *
 * OWNERSHIP is lib/exportDb.ts's loadFeedback(), shared with the PDF report
 * so the one filter that matters exists once.
 *
 * ponytail: the whole result is assembled in memory before it is sent. Fine
 * at the current volume — tens of submissions — and it will need streaming
 * when it is thousands. The upgrade path is a ReadableStream writing rows as
 * the cursor produces them.
 */

const HEADERS = [
  "Project",
  "Test Case",
  "Test category",
  "Device target",
  "Submitted at",
  // A number, never a name: builders do not learn who tested (CLAUDE.md,
  // Tester anonymity). Per mission — the header says so, because "1" on two
  // missions is two different people.
  "Tester # (per test case)",
  "Submission status",
  "Rating",
  // Not in the original column list, and the export loses its legacy content
  // without it. Twenty-four submissions predate the audit log and carry only
  // tester_comment — and it is the "anything else?" field on every modern
  // submission too.
  "Tester comment",
  "Step",
  "Action",
  "Expected",
  "Step status",
  "Actual result",
  "Issue summary",
  "Steps to reproduce",
  "AI sentiment",
  "Screenshots",
] as const

/** One row per test-case step, or one for a legacy comment-only report. */
function rowsFor(submissions: FeedbackRow[]): Cell[][] {
  // Every report of an exported mission is exported (scope never narrows
  // within a mission), so these numbers match the app's.
  const numbers = testerNumbers(submissions)

  const rows: Cell[][] = []
  for (const s of submissions) {
    const shared: Cell[] = [
      s.missions?.projects?.name ?? "",
      s.missions?.title ?? "",
      s.missions?.category ? testCategoryLabel(s.missions.category) : "",
      s.missions?.device_target ? deviceTargetLabel(s.missions.device_target) : "",
      s.created_at,
      numbers.get(s.id),
      s.status,
      s.rating,
      s.tester_comment ?? "",
    ]
    const screenshots = screenshotList(s).length
    const entries = [...(s.test_result_entries ?? [])].sort(
      (a, b) => a.step_index - b.step_index,
    )

    if (entries.length === 0) {
      // A submission that predates the audit log. It carries only the
      // comment, and dropping it would silently lose twenty-four of them —
      // the same two shapes components/submissions/SubmissionBody.tsx already
      // branches on, handled the same way.
      rows.push([...shared, "", "", "", "", "", "", "", s.ai_sentiment ?? "", screenshots])
      continue
    }

    for (const e of entries) {
      rows.push([
        ...shared,
        e.step_index + 1,
        e.step_action,
        e.step_expected,
        e.status,
        e.actual_result ?? "",
        e.issue_summary ?? "",
        e.steps_to_reproduce ?? "",
        s.ai_sentiment ?? "",
        screenshots,
      ])
    }
  }
  return rows
}

/**
 * Two shapes, both scoped to one project:
 *
 *   ?project=P&mission=M   one mission, as CSV
 *   ?project=P             every mission in the project, as .xlsx with one
 *                          sheet per mission — a CSV cannot hold sheets
 */
export async function GET(request: Request) {
  // Redirects when the caller is not a verified builder. In a Route Handler
  // Next turns that into a 307, which is the right answer for a link a
  // browser follows.
  const { userId } = await requireAccount("builder")

  // Tier 2 at an API path: an expensive query and a bulk-exfiltration path on
  // a stolen session. Keyed on the account, fails closed.
  const rate = await checkRateLimit(["export:account", userId])
  if (!rate.ok) return tooManyResponse(rate.retryAfter)

  const params = new URL(request.url).searchParams
  const project = params.get("project")
  const mission = params.get("mission")
  if (!project) return new Response("Choose a project to export.", { status: 400 })

  const { rows: submissions, error } = await loadFeedback(userId, project, mission)
  if (error) {
    console.error("[export/feedback] query failed:", error)
    return new Response("Could not build the export.", { status: 500 })
  }

  // The same answer for "not yours" and "no reports yet", so a refusal does
  // not confirm a project exists. A header-only file looks like a broken
  // export, and a workbook with no sheets will not open at all.
  if (submissions.length === 0) {
    return new Response("Nothing to export there yet.", { status: 404 })
  }

  const projectName = submissions[0].missions?.projects?.name

  if (mission) {
    // The BOM is what makes Excel read this as UTF-8 rather than the local
    // codepage, which is the difference between a Nigerian name and mojibake.
    return download(
      CSV_BOM + toCsv(HEADERS, rowsFor(submissions)),
      "text/csv; charset=utf-8",
      `${slug(projectName)}-${slug(submissions[0].missions?.title)}-${today()}.csv`,
    )
  }

  // One sheet per mission, oldest mission first — the order they were run.
  const byMission = new Map<string, FeedbackRow[]>()
  for (const s of submissions) byMission.set(s.mission_id, [...(byMission.get(s.mission_id) ?? []), s])
  const groups = [...byMission.values()].sort((a, b) =>
    (a[0].missions?.created_at ?? "") < (b[0].missions?.created_at ?? "") ? -1 : 1,
  )
  const names = sheetNames(groups.map((g) => g[0].missions?.title ?? "Mission"))

  return download(
    toXlsx(groups.map((g, i) => ({ name: names[i], headers: HEADERS, rows: rowsFor(g) }))),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    `${slug(projectName)}-test-reports-${today()}.xlsx`,
  )
}
