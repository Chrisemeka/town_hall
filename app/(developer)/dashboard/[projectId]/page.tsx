import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccount } from "@/lib/auth";
import { one } from "@/lib/utils/project";
import type { Embedded, MissionRow, TestResultRow } from "@/lib/types/db";
import { testerNumbers } from "@/lib/testerNumbers";
import type { SubmissionEntry } from "@/components/submissions/SubmissionBody";

/** Exactly what the two list selects below ask for. */
type ProjectMission = Pick<
  MissionRow,
  "id" | "title" | "task_description" | "created_at" | "is_active" | "category" | "device_target"
> & { test_results: { count: number }[] | null };
/** The `missions!inner(...)` embed. PostgREST returns an object here, but
 *  supabase-js infers an array from the select string, so the type admits both
 *  and one() settles it before the rows leave this file. */
type ProjectResult = Pick<
  TestResultRow,
  "id" | "tester_comment" | "screenshot_url" | "screenshot_urls" | "created_at" | "mission_id"
> & { missions: Embedded<Pick<MissionRow, "id" | "title" | "project_id">> };
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Flag } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProjectDetailTabs } from "@/components/ProjectDetailTabs";

type ProjectStatus = "active" | "needs-testers" | "draft";

function getStatus(missionCount: number, feedbackCount: number): ProjectStatus {
  if (missionCount === 0) return "draft";
  if (feedbackCount === 0) return "needs-testers";
  return "active";
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { userId } = await requireAccount("builder");
  // Service role: projects.owner_id and test_results are not readable by a
  // signed-in user (20261006_01). The owner check below is the scoping.
  const admin = createAdminClient();
  const { projectId } = await params;

  const [projectRes, missionsRes, resultsRes] = await Promise.all([
    // Not flagged_by: which admin flagged it is not the owner's business.
    admin
      .from("projects")
      .select("id, name, description, app_url, owner_id, flagged_at, flag_reason")
      .eq("id", projectId)
      .single(),
    admin
      .from("missions")
      .select("id, title, task_description, created_at, is_active, category, device_target, test_results(count)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    admin
      .from("test_results")
      .select("id, tester_comment, screenshot_url, screenshot_urls, created_at, mission_id, missions!inner(id, title, project_id)")
      .eq("missions.project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  if (!projectRes.data) return notFound();

  // Ownership, in the page as well as in middleware. accessFor() only proves
  // the caller is a builder — every /dashboard/[projectId] route is one builder's
  // alone, and nothing else was checking whose. notFound rather than a 403: a
  // refusal that distinguishes "not yours" from "no such project" confirms the
  // project exists.
  if (projectRes.data.owner_id !== userId) return notFound();

  const project  = projectRes.data;
  const missions = (missionsRes.data ?? []) as ProjectMission[];
  const rawResults = (resultsRes.data ?? []) as ProjectResult[];

  // The same two things /dashboard/feedback shows for a report: "Tester N",
  // stable per mission (the number the mission page and the CSV use), and the
  // audit log's entries — a report filed step by step has no comment, and
  // this tab used to render it as a blank paragraph under "Developer #01".
  // Keyed off the ids above, so this cannot widen the scope.
  const numbers = testerNumbers(rawResults);
  const resultIds = rawResults.map((r) => r.id);
  const { data: entryRows } = resultIds.length
    ? await admin
        .from("test_result_entries")
        .select(
          "id, test_result_id, step_index, step_action, step_expected, status, issue_summary, steps_to_reproduce, actual_result, expected_result",
        )
        .in("test_result_id", resultIds)
        .order("step_index", { ascending: true })
    : { data: [] };
  const entriesByResult = new Map<string, SubmissionEntry[]>();
  for (const row of (entryRows ?? []) as (SubmissionEntry & { test_result_id: string })[]) {
    const list = entriesByResult.get(row.test_result_id) ?? [];
    list.push(row);
    entriesByResult.set(row.test_result_id, list);
  }

  const results = rawResults.map((r) => ({
    ...r,
    missions: one(r.missions),
    testerNumber: numbers.get(r.id),
    entries: entriesByResult.get(r.id) ?? null,
  }));

  const missionCount  = missions.length;
  const feedbackCount = results.length;
  const status        = getStatus(missionCount, feedbackCount);

  return (
    <div className="max-w-[1128px] mx-auto px-4 medium:px-6 expanded:px-8 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-10">

      {/* Breadcrumb. Below 600px a 48px back link — the h1 right under it
          already names the project. From 600px, the trail. */}
      <div className="flex items-center gap-1.5 font-mono text-[14px] lg:text-[13px] text-ink-muted mb-4 medium:mb-8 min-w-0">
        <Link href="/dashboard" className="inline-flex items-center gap-1 min-h-12 -ml-2 px-2 medium:min-h-0 medium:ml-0 medium:px-0 hover:text-ink transition-colors duration-150 shrink-0">
          <ChevronLeft className="w-4 h-4 medium:hidden" aria-hidden="true" />
          My Projects
        </Link>
        <ChevronRight className="hidden medium:block w-3.5 h-3.5 text-line shrink-0" aria-hidden="true" />
        <span className="hidden medium:inline text-ink truncate max-w-[240px]">{project.name}</span>
      </div>

      {/* Flag warning banner (shown to owner when an admin has flagged this project) */}
      {project.flagged_at && (
        <div
          className="rounded-[12px] p-4 gap-3 medium:p-5 medium:gap-4 mb-6 medium:mb-8 flex items-start"
          style={{
            background: "rgba(255,79,79,0.06)",
            border: "1px solid rgba(255,79,79,0.3)",
          }}
        >
          <div
            className="hidden medium:flex w-9 h-9 rounded-[8px] items-center justify-center shrink-0"
            style={{ background: "rgba(255,79,79,0.12)", border: "1px solid rgba(255,79,79,0.3)" }}
          >
            <Flag className="w-4 h-4" style={{ color: "var(--color-danger-ink)" }} />
          </div>
          <div className="min-w-0">
            <p className="font-syne font-bold text-[16px]" style={{ color: "var(--color-danger-ink)" }}>
              This project has been flagged by an admin.
            </p>
            <p className="font-mono text-[14px] lg:text-[13px] text-ink-muted mt-1 leading-5">
              Your project is hidden from public discovery (Explore, Browse Missions, search) until the issue is resolved.
            </p>
            {project.flag_reason && (
              <div className="mt-3 rounded-[8px] p-3" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,79,79,0.2)" }}>
                <p className="font-mono text-[12px] lg:text-[11px] uppercase tracking-[1px] text-ink-muted mb-1">Reason</p>
                <p className="font-mono text-[13px] text-ink leading-5 whitespace-pre-wrap">
                  {project.flag_reason}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project header */}
      <div className="flex flex-col medium:flex-row medium:items-start medium:justify-between gap-6 mb-6 medium:mb-10">
        <div className="flex flex-col gap-3 min-w-0">
          {/* Name + badge */}
          <div className="flex items-center gap-3 medium:gap-4 flex-wrap">
            <h1 className="font-syne font-bold text-[28px] leading-9 medium:text-[36px] medium:leading-[44px] expanded:text-[40px] expanded:leading-[44px] lg:text-[48px] lg:leading-[52px] tracking-[-0.5px] text-ink [overflow-wrap:anywhere] min-w-0">
              {project.name}
            </h1>
            <Badge variant={status} />
          </div>

          {/* URL */}
          {project.app_url && (
            <a
              href={project.app_url}
              target="_blank"
              rel="noopener noreferrer"
              // 48px tall below lg without moving the layout; a long URL breaks
              // instead of running out of the column.
              className="inline-flex items-center min-h-12 -my-3 lg:min-h-0 lg:my-0 [overflow-wrap:anywhere] font-mono text-[14px] lg:text-[13px] text-info-ink hover:underline w-fit"
            >
              {project.app_url.replace(/^https?:\/\//, "")}
            </a>
          )}

          {/* Summary */}
          {project.description && (
            <p className="font-mono text-[16px] leading-6 text-ink-muted max-w-2xl">
              {project.description}
            </p>
          )}
        </div>

        {/* Edit button */}
        <Link
          href={`/dashboard/${projectId}/edit`}
          className="h-12 lg:h-9 self-start px-4 border border-line text-ink-muted rounded-[8px] font-mono text-[14px] hover:text-ink hover:border-ink-muted transition-colors duration-150 flex items-center gap-2 shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Link>
      </div>

      {/* Tabs */}
      <ProjectDetailTabs
        projectId={projectId}
        missions={missions}
        results={results}
      />

    </div>
  );
}
