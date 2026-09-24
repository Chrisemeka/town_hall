import { createAdminClient } from "@/lib/supabase/admin"
// requireAccount, not a hand-rolled getUser(): it carries the
// email-confirmation and per-role verification gates with it, and skipping
// either here would make this route a way around them.
import { requireAccount } from "@/lib/auth"
import { CSV_BOM, toCsv } from "@/lib/csv"
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
  "Tester",
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
  created_at: string
  status: string
  rating: number | null
  tester_comment: string | null
  ai_sentiment: string | null
  screenshot_urls: string[] | null
  tester_id: string
  missions: {
    title: string
    category: string | null
    device_target: string | null
    projects: { name: string; owner_id: string } | null
  } | null
  test_result_entries: EntryRow[] | null
}

function filename(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `twnhall-feedback-${today}.csv`
}

export async function GET(request: Request) {
  // Redirects when the caller is not a verified builder. In a Route Handler
  // Next turns that into a 307, which is the right answer for a link a
  // browser follows.
  const { userId } = await requireAccount("builder")

  const scope = new URL(request.url).searchParams.get("project") ?? "all"
  const admin = createAdminClient()

  let query = admin
    .from("test_results")
    .select(
      `created_at, status, rating, tester_comment, ai_sentiment, screenshot_urls, tester_id,
       missions!inner(title, category, device_target, projects!inner(name, owner_id)),
       test_result_entries(step_index, step_action, step_expected, status, actual_result, issue_summary, steps_to_reproduce)`,
    )
    // The ownership filter. Service role sees everything, so this is the only
    // thing keeping one builder's export out of another's.
    .eq("missions.projects.owner_id", userId)
    .order("created_at", { ascending: false })

  if (scope !== "all") {
    // Narrowing by project is ADDITIONAL to the owner filter, never instead
    // of it: a project id the caller does not own then matches nothing,
    // rather than returning somebody else's feedback.
    query = query.eq("missions.project_id", scope)
  }

  const { data, error } = await query
  if (error) {
    console.error("[export/feedback] query failed:", error.message)
    return new Response("Could not build the export.", { status: 500 })
  }

  const submissions = (data ?? []) as unknown as SubmissionRow[]

  // One read for the names. The tester's display name is included because the
  // builder already sees it in the app; their email address never is, because
  // a CSV leaves your control the moment it is downloaded.
  const testerIds = [...new Set(submissions.map((s) => s.tester_id))]
  const names = new Map<string, string>()
  if (testerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", testerIds)
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      names.set(p.id, p.full_name ?? "")
    }
  }

  const rows: unknown[][] = []
  for (const s of submissions) {
    const shared = [
      s.missions?.projects?.name ?? "",
      s.missions?.title ?? "",
      s.missions?.category ? testCategoryLabel(s.missions.category) : "",
      s.missions?.device_target ? deviceTargetLabel(s.missions.device_target) : "",
      s.created_at,
      names.get(s.tester_id) ?? "",
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

  // The BOM is what makes Excel read this as UTF-8 rather than the local
  // codepage, which is the difference between a Nigerian name and mojibake.
  const body = CSV_BOM + toCsv(HEADERS, rows)

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename()}"`,
      // A person's own feedback, assembled per request. Never a shared cache.
      "Cache-Control": "no-store",
    },
  })
}
