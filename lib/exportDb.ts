import { createAdminClient } from "@/lib/supabase/admin"

/*
 * The one owner-scoped read behind both feedback exports — the CSV/workbook
 * (app/api/export/feedback) and the PDF report (app/api/export/report).
 *
 * OWNERSHIP IS THE WHOLE FILE. Service role bypasses RLS, so the owner_id
 * filter on the join is the only thing scoping this read. Getting it wrong
 * hands one builder another builder's feedback. It lives once, here, so the
 * two exports cannot drift apart on it.
 *
 * tester_id is not selected, and must not be: builders never learn who tested
 * (CLAUDE.md, Tester anonymity), and a column that is never read cannot leak
 * into a CSV or a PDF. Testers are told apart by testerNumbers() alone.
 */

export type FeedbackEntry = {
  step_id: string | null
  step_index: number
  step_action: string
  step_expected: string
  status: string
  actual_result: string | null
  issue_summary: string | null
  steps_to_reproduce: string | null
}

export type FeedbackRow = {
  id: string
  mission_id: string
  created_at: string
  status: string
  rating: number | null
  tester_comment: string | null
  ai_summary: string | null
  ai_sentiment: string | null
  screenshot_urls: string[] | null
  /** Legacy single screenshot — read both through screenshotList(), never directly. */
  screenshot_url: string | null
  missions: {
    title: string
    created_at: string
    category: string | null
    device_target: string | null
    projects: { name: string; owner_id: string } | null
  } | null
  test_result_entries: FeedbackEntry[] | null
}

/**
 * Every report on `projectId` — or on one mission of it — that `userId` owns,
 * oldest first. An id the caller does not own matches nothing.
 */
export async function loadFeedback(
  userId: string,
  projectId: string,
  missionId?: string | null,
): Promise<{ rows: FeedbackRow[]; error: string | null }> {
  let query = createAdminClient()
    .from("test_results")
    .select(
      `id, mission_id, created_at, status, rating, tester_comment, ai_summary, ai_sentiment, screenshot_urls, screenshot_url,
       missions!inner(title, created_at, category, device_target, projects!inner(name, owner_id)),
       test_result_entries(step_id, step_index, step_action, step_expected, status, actual_result, issue_summary, steps_to_reproduce)`,
    )
    // The ownership filter. Service role sees everything, so this is the only
    // thing keeping one builder's export out of another's.
    .eq("missions.projects.owner_id", userId)
    // Narrowing is ADDITIONAL to the owner filter, never instead of it: an id
    // the caller does not own then matches nothing, rather than returning
    // somebody else's feedback.
    .eq("missions.project_id", projectId)
    .order("created_at", { ascending: true })

  if (missionId) query = query.eq("mission_id", missionId)

  const { data, error } = await query
  return { rows: (data ?? []) as unknown as FeedbackRow[], error: error?.message ?? null }
}

/** Something safe in a Content-Disposition header: ASCII, no quotes. */
export function slug(text: string | undefined): string {
  const s = (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
  return s || "export"
}

export const today = () => new Date().toISOString().slice(0, 10)

/** A person's own feedback, assembled per request. Never a shared cache. */
export function download(body: BodyInit, type: string, name: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  })
}
