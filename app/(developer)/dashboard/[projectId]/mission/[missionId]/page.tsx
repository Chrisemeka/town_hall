import { requireAccount } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubmissionEntry } from "@/components/submissions/SubmissionBody";
import { one } from "@/lib/utils/project";
import type { Embedded, ProjectRow } from "@/lib/types/db";
import { testerNumbers } from "@/lib/testerNumbers";
import type { MissionResult } from "@/components/MissionResultRow";
import { notFound } from "next/navigation";
import Link from "next/link";
import { toggleMissionStatus } from "@/actions/missions";
import { MissionStatusButton } from "@/components/missions/MissionStatusButton";
import { tooManyMessage } from "@/lib/rateLimit";
import { ChevronLeft, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MissionChips, TestCaseView } from "@/components/missions/TestCaseView";
import DeleteMissionButton from "@/components/DeleteMissionButton";
import MissionResultRow from "@/components/MissionResultRow";
import { AllowanceNotice, CappedNotice } from "@/components/missions/AllowanceNotice";
import { reportBalance } from "@/lib/allowanceDb";

export default async function DeveloperMissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; missionId: string }>;
  searchParams: Promise<{ limited?: string }>;
}) {
  const { userId } = await requireAccount("builder");
  // Service role: test_results and projects.owner_id are not readable by a
  // signed-in user (20261006_01). The ownership check below is the scoping.
  const admin = createAdminClient();
  const { projectId, missionId } = await params;
  // Set by toggleMissionStatus when Reactivate hit the rate limit. Only ever
  // rendered through tooManyMessage(), which states no parameters.
  const limited = Number((await searchParams).limited) || 0;

  const [missionRes, resultsRes] = await Promise.all([
    admin
      .from("missions")
      .select(
        "id, project_id, title, task_description, is_active, category, device_target, test_steps, testers_needed, projects(name, app_url, owner_id)",
      )
      .eq("id", missionId)
      .single(),
    // An explicit list, never "*": a wildcard here once shipped every
    // tester_id to the browser through MissionResultRow, a client component.
    // Builders never learn who tested (CLAUDE.md, Tester anonymity).
    admin
      .from("test_results")
      .select(
        "id, mission_id, created_at, screenshot_url, screenshot_urls, tester_comment, ai_summary, ai_sentiment, status, rating, review_note",
      )
      .eq("mission_id", missionId)
      .order("created_at", { ascending: false }),
  ]);

  if (!missionRes.data) return notFound();

  // Ownership, in the page as well as in middleware. accessFor() only proves the
  // caller is a builder, and nothing here was checking whose mission this is.
  // Checked against the mission's OWN project rather than the projectId in the
  // URL — otherwise owning the project in the path would be enough to open
  // someone else's mission through it. The project_id match is the other half:
  // it keeps the breadcrumb honest. notFound rather than a 403, so a refusal
  // does not confirm the mission exists.
  const missionProject = one(
    missionRes.data.projects as Embedded<Pick<ProjectRow, "name" | "app_url" | "owner_id">>,
  );
  if (missionProject?.owner_id !== userId) return notFound();
  if (missionRes.data.project_id !== projectId) return notFound();

  const mission = missionRes.data;
  const results = (resultsRes.data ?? []) as unknown as MissionResult[];
  const numbers = testerNumbers(results);

  // Entries are keyed off the ids above, which the ownership check already
  // scoped, so this cannot widen what the caller sees.
  const resultIds = results.map((r) => r.id)
  const { data: entryRows } = resultIds.length
    ? await admin
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

  const project = missionProject;
  const isActive = mission.is_active !== false;
  // Drafts say what publishing would spend, which is also why a refused
  // publish left this a draft. Live missions need only the cap, from the row.
  const allowance = await reportBalance(userId);

  return (
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">

      {/* Navigation bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-10 pb-6 border-b border-line">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/dashboard/${projectId}`}
            className="flex items-center gap-1.5 h-8 px-3 border border-line rounded-[6px] font-mono text-[13px] text-ink-muted hover:text-ink hover:border-ink-muted transition-colors duration-150 shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <div className="font-mono text-[13px] text-ink-muted flex items-center gap-1.5 min-w-0">
            <Link href="/dashboard" className="hover:text-ink transition-colors duration-150 shrink-0">
              My Projects
            </Link>
            <span className="text-line shrink-0">/</span>
            <Link
              href={`/dashboard/${projectId}`}
              className="hover:text-ink transition-colors duration-150 truncate max-w-[100px] sm:max-w-[160px]"
            >
              {project?.name ?? "Project"}
            </Link>
            <span className="text-line shrink-0">/</span>
            <span className="text-ink truncate max-w-[120px] sm:max-w-[200px]">{mission.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/dashboard/${projectId}/mission/${missionId}/edit`}
            className="h-8 px-3 border border-line text-ink-muted rounded-[6px] font-mono text-[13px] hover:text-ink hover:border-ink-muted transition-colors duration-150 flex items-center gap-1.5"
          >
            <Pencil className="w-3 h-3" />
            Edit Mission
          </Link>

          <form
            action={async () => {
              "use server";
              await toggleMissionStatus(mission.id, projectId, !isActive);
            }}
          >
            <MissionStatusButton isActive={isActive} />
          </form>
        </div>
      </div>

      {/* Why this is still a draft, above the fold: below the test case it
          went unseen, and a refused publish is the first thing to know. */}
      {!isActive && (
        <div className="mb-8 max-w-3xl">
          {limited > 0 && (
            <p role="alert" className="font-mono text-[13px] leading-5 text-danger-ink mb-4">
              {tooManyMessage(limited)}
            </p>
          )}
          <AllowanceNotice view={allowance} />
        </div>
      )}

      {/* Mission header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Badge variant={isActive ? "active" : "draft"} />
          <h1 className="font-syne font-bold text-[26px] leading-[32px] sm:text-[32px] sm:leading-[38px] md:text-[36px] md:leading-[44px] tracking-[-0.5px] text-ink break-words min-w-0">
            {mission.title}
          </h1>
        </div>
        {/* Optional since 20260907_01 — omitted entirely rather than left as a
            heading over blank space. */}
        {mission.task_description && (
          <>
            <p className="font-mono text-[11px] text-accent-ink uppercase tracking-[0.8px] mb-2">
              NOTES FOR TESTERS
            </p>
            <p className="font-mono text-[15px] leading-6 text-ink-muted max-w-3xl whitespace-pre-wrap">
              {mission.task_description}
            </p>
          </>
        )}

        <MissionChips
          category={mission.category}
          deviceTarget={mission.device_target}
          className="mt-4"
        />

        <p className="font-mono text-[11px] text-accent-ink uppercase tracking-[0.8px] mt-6 mb-3">
          TEST STEPS
        </p>
        <div className="max-w-3xl">
          <TestCaseView steps={mission.test_steps} />
        </div>

        {isActive && mission.testers_needed != null && (
          <CappedNotice testers={mission.testers_needed} max={allowance.testersPerMission} />
        )}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-line rounded-[12px]">
          <p className="font-syne font-bold text-[20px] text-ink mb-2">No submissions yet.</p>
          <p className="font-mono text-[14px] text-ink-muted">
            Results will appear here once testers start submitting feedback.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {results.map((result, i) => (
            <div key={result.id}>
              {i > 0 && <div className="my-10 border-t border-line" />}
              <MissionResultRow
                result={result}
                entries={entriesByResult.get(result.id) ?? null}
                testerNumber={numbers.get(result.id)}
                appUrl={project?.app_url ?? null}
              />
            </div>
          ))}
        </div>
      )}

      {/* Delete (inactive missions only) */}
      {!isActive && (
        <div className="mt-10 pt-6 border-t border-line flex flex-col items-start gap-2">
          <DeleteMissionButton missionId={mission.id} projectId={projectId} />
          <p className="font-mono text-[12px] text-ink-muted">
            Permanently deletes this draft. This cannot be undone.
          </p>
        </div>
      )}
    </div>
  );
}
