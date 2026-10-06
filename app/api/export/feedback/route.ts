import { createAdminClient } from "@/lib/supabase/admin"
// requireAccount, not a hand-rolled getUser(): it carries the
// email-confirmation and per-role verification gates with it, and skipping
// either here would make this route a way around them.
import { requireAccount } from "@/lib/auth"
import { CSV_BOM, toCsv } from "@/lib/csv"
import { testerNumbers } from "@/lib/testerNumbers"
import { sheetNames, toXlsx, type Cell } from "@/lib/xlsx"
import { checkRateLimit, tooManyResponse } from "@/lib/rateLimitDb"
import { deviceTargetLabel, testCategoryLabel } from "@/lib/vocabulary"

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
 * OWNERSHIP IS THE WHOLE FILE. Service role bypasses RLS, so the owner_id
 * filter on the join is the only thing scoping this read. Getting it wrong
 * hands one builder another builder's feedback.
 *
 * ponytail: the whole result is assembled in memory before it is sent. Fine
 * at the current volume — tens of submissions — and it will need streaming
 * when it is thousands. The upgrade path is a ReadableStream writing rows as
 * the cursor produces them.
 */

const HEADERS = [
  "Project",
  "Mission",
  "Test category",
  "Device target",
  "Submitted at",
  // A number, never a name: builders do not learn who tested (CLAUDE.md,
  // Tester anonymity). Per mission — the header says so, because "1" on two
  // missions is two different people.
  "Tester # (per mission)",
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

type EntryRow = {
  step_index: number
  step_action: string
  step_expected: string
  status: string
  actual_result: string | null
  issue_summary: string | null
  steps_to_reproduce: string | null
}

type SubmissionRow = {
  id: string
  mission_id: string
  created_at: string
  status: string
  rating: number | null
  tester_comment: string | null
  ai_sentiment: string | null
  screenshot_urls: string[] | null
  missions: {
    title: string
    created_at: string
    category: string | null
    device_target: string | null
    projects: { name: string; owner_id: string } | null
  } | null
  test_result_entries: EntryRow[] | null
}

/** Something safe in a Content-Disposition header: ASCII, no quotes. */
function slug(text: string | undefined): string {
  const s = (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
  return s || "export"
}

const today = () => new Date().toISOString().slice(0, 10)

/** One row per test-case step, or one for a legacy comment-only report. */
function rowsFor(submissions: SubmissionRow[]): Cell[][] {
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
    const screenshots = s.screenshot_urls?.length ?? 0
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

/** A person's own feedback, assembled per request. Never a shared cache. */
function download(body: BodyInit, type: string, name: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  })
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

  let query = createAdminClient()
    .from("test_results")
    .select(
      `id, mission_id, created_at, status, rating, tester_comment, ai_sentiment, screenshot_urls,
       missions!inner(title, created_at, category, device_target, projects!inner(name, owner_id)),
       test_result_entries(step_index, step_action, step_expected, status, actual_result, issue_summary, steps_to_reproduce)`,
    )
    // The ownership filter. Service role sees everything, so this is the only
    // thing keeping one builder's export out of another's.
    .eq("missions.projects.owner_id", userId)
    // Narrowing is ADDITIONAL to the owner filter, never instead of it: an id
    // the caller does not own then matches nothing, rather than returning
    // somebody else's feedback.
    .eq("missions.project_id", project)
    .order("created_at", { ascending: true })

  if (mission) query = query.eq("mission_id", mission)

  const { data, error } = await query
  if (error) {
    console.error("[export/feedback] query failed:", error.message)
    return new Response("Could not build the export.", { status: 500 })
  }

  const submissions = (data ?? []) as unknown as SubmissionRow[]
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
  const byMission = new Map<string, SubmissionRow[]>()
  for (const s of submissions) byMission.set(s.mission_id, [...(byMission.get(s.mission_id) ?? []), s])
  const groups = [...byMission.values()].sort((a, b) =>
    (a[0].missions?.created_at ?? "") < (b[0].missions?.created_at ?? "") ? -1 : 1,
  )
  const names = sheetNames(groups.map((g) => g[0].missions?.title ?? "Mission"))

  return download(
    toXlsx(groups.map((g, i) => ({ name: names[i], headers: HEADERS, rows: rowsFor(g) }))),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    `${slug(projectName)}-feedback-${today()}.xlsx`,
  )
}
