import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubmissionEntry } from "@/components/submissions/SubmissionBody";
import type { MissionRow, TestResultRow } from "@/lib/types/db";

/** Exactly what the two selects below ask for. */
type MissionLite = Pick<MissionRow, "id" | "title" | "project_id">;
type ResultLite = Pick<
  TestResultRow,
  "id" | "tester_comment" | "screenshot_url" | "screenshot_urls" | "created_at" | "mission_id"
>;
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { FeedbackListPaged, type FeedbackEntry } from "@/components/FeedbackListPaged";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Feedback Received — Twnhall" };

export default async function FeedbackReceivedPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  /* 1 — user's projects */
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("owner_id", user.id);

  const projectIds = (projects ?? []).map((p) => p.id);
  const projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]));

  /* 2 — missions belonging to those projects */
  const { data: missions } =
    projectIds.length > 0
      ? await supabase
          .from("missions")
          .select("id, title, project_id")
          .in("project_id", projectIds)
      : { data: [] as MissionLite[] };

  const missionIds = (missions ?? []).map((m) => m.id);
  const missionMeta: Record<string, { title: string; projectId: string; projectName: string }> =
    Object.fromEntries(
      (missions ?? []).map((m) => [
        m.id,
        {
          title:       m.title,
          projectId:   m.project_id,
          projectName: projectMap[m.project_id] ?? "Unknown Project",
        },
      ]),
    );

  /* 3 — all test_results, flat list ordered asc (so Developer #01 = first tester) */
  const { data: rawResults } =
    missionIds.length > 0
      ? await supabase
          .from("test_results")
          .select("id, tester_comment, screenshot_url, screenshot_urls, created_at, mission_id")
          .in("mission_id", missionIds)
          .order("created_at", { ascending: true })
      : { data: [] as ResultLite[] };

  /* 3b — entries, via service role: test_result_entries has RLS on with no
     policy. Keyed off the ids the query above returned, so the caller's own
     scoping carries over and this cannot widen what they see. */
  const resultIds = (rawResults ?? []).map((r) => r.id)
  const { data: entryRows } = resultIds.length
    ? await createAdminClient()
        .from("test_result_entries")
        .select(
          "id, test_result_id, step_index, step_action, step_expected, status, issue_summary, steps_to_reproduce, actual_result, expected_result",
        )
        .in("test_result_id", resultIds)
        .order("step_index", { ascending: true })
    : { data: [] }

  const entriesByResult = new Map<string, SubmissionEntry[]>()
  for (const row of (entryRows ?? []) as (SubmissionEntry & { test_result_id: string })[]) {
    const list = entriesByResult.get(row.test_result_id) ?? []
    list.push(row)
    entriesByResult.set(row.test_result_id, list)
  }

  /* flatten into FeedbackEntry[] with mission context attached */
  const items: FeedbackEntry[] = (rawResults ?? [])
    .filter((r) => missionMeta[r.mission_id])
    .map((r) => ({
      id:            r.id,
      missionId:     r.mission_id,
      missionTitle:  missionMeta[r.mission_id].title,
      projectId:     missionMeta[r.mission_id].projectId,
      projectName:   missionMeta[r.mission_id].projectName,
      tester_comment: r.tester_comment,
      screenshot_url: r.screenshot_url,
      screenshot_urls: r.screenshot_urls,
      created_at:    r.created_at,
      entries:       entriesByResult.get(r.id) ?? null,
    }));

  /* sort by most recent first for display (newest feedback first) */
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="max-w-[800px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">

      <div id="tour-feedback-header" className="mb-8">
        <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-ink">
          Feedback Received
        </h1>
        <p className="font-mono text-[14px] text-ink-muted mt-1">
          All feedback from your active missions.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-line rounded-[12px] text-center px-6">
          <MessageSquare className="w-12 h-12 text-ink-muted mb-4 opacity-40" />
          <h3 className="font-syne font-bold text-[24px] text-ink mb-2">No feedback yet.</h3>
          <p className="font-mono text-[14px] text-ink-muted mb-6 max-w-[340px]">
            Share your project in the community to start receiving feedback.
          </p>
          <Button variant="ghost" asChild>
            <Link href="/explore">Explore Community</Link>
          </Button>
        </div>
      ) : (
        <FeedbackListPaged items={sorted} />
      )}

    </div>
  );
}
