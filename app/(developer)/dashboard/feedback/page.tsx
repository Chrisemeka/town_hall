import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccount } from "@/lib/auth";
import { testerNumbers } from "@/lib/testerNumbers";
import type { SubmissionEntry } from "@/components/submissions/SubmissionBody";
import type { Embedded, TestResultRow } from "@/lib/types/db";
import { one } from "@/lib/utils/project";

/** Exactly what the select below asks for, beside its embeds. */
type ResultLite = Pick<
  TestResultRow,
  "id" | "tester_comment" | "screenshot_url" | "screenshot_urls" | "created_at" | "mission_id"
>;
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { FeedbackListPaged, type FeedbackEntry } from "@/components/FeedbackListPaged";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Test Reports — Twnhall" };

export default async function FeedbackReceivedPage() {
  const { userId } = await requireAccount("builder");
  // Service role throughout: test_results and projects.owner_id are not
  // readable by a signed-in user (20261006_01). The owner_id filter on the
  // embedded project is the scoping: one read for reports, their mission and
  // project, and their entries, where there used to be four in a row
  // (docs/perf/DIAGNOSIS-2026-11.md F4).
  const { data } = await createAdminClient()
    .from("test_results")
    .select(
      "id, tester_comment, screenshot_url, screenshot_urls, created_at, mission_id, missions!inner(title, project_id, projects!inner(name, owner_id)), test_result_entries(id, step_index, step_action, step_expected, status, issue_summary, steps_to_reproduce, actual_result, expected_result, screenshot_urls)",
    )
    .eq("missions.projects.owner_id", userId)
    .order("created_at", { ascending: true })
    .order("step_index", { referencedTable: "test_result_entries", ascending: true });

  const rawResults = (data ?? []) as unknown as (ResultLite & {
    missions: Embedded<{ title: string; project_id: string; projects: Embedded<{ name: string }> }>
    test_result_entries: SubmissionEntry[] | null
  })[];
  const numbers = testerNumbers(rawResults);

  /* flatten into FeedbackEntry[] with mission context attached */
  const items: FeedbackEntry[] = rawResults.flatMap((r) => {
    const mission = one(r.missions);
    if (!mission) return [];
    return [{
      id:            r.id,
      missionId:     r.mission_id,
      missionTitle:  mission.title,
      projectId:     mission.project_id,
      projectName:   one(mission.projects)?.name ?? "Unknown Project",
      tester_comment: r.tester_comment,
      screenshot_url: r.screenshot_url,
      screenshot_urls: r.screenshot_urls,
      created_at:    r.created_at,
      testerNumber:  numbers.get(r.id),
      entries:       r.test_result_entries?.length ? r.test_result_entries : null,
    }];
  });

  /* sort by most recent first for display (newest feedback first) */
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="max-w-[800px] mx-auto px-4 medium:px-6 expanded:px-8 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-10">

      <div id="tour-feedback-header" className="mb-6 medium:mb-8">
        <h1 className="font-syne font-bold text-[28px] leading-9 medium:text-[32px] medium:leading-10 expanded:text-[36px] expanded:leading-[44px] tracking-[-0.5px] text-ink">
          Test Reports
        </h1>
        <p className="font-mono text-[14px] text-ink-muted mt-1">
          All test reports from your active test cases.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 medium:py-16 border border-dashed border-line rounded-[12px] text-center px-6">
          <MessageSquare className="w-12 h-12 text-ink-muted mb-4 opacity-40" />
          <h3 className="font-syne font-bold text-[24px] text-ink mb-2">No test reports yet.</h3>
          <p className="font-mono text-[14px] text-ink-muted mb-6 max-w-[340px]">
            Share your project in the community to start receiving test reports.
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
