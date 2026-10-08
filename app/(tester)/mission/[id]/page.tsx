import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { MissionChips, TestCaseView } from "@/components/missions/TestCaseView";
import { storedTestStepsSchema } from "@/lib/validation/schemas";
import { CheckCircle2, ChevronRight, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { one } from "@/lib/utils/project";
import type { Embedded, ProjectRow } from "@/lib/types/db";
import AuditLogForm from "@/components/tester/AuditLogForm";
import { isCohortTester, missionsForTester } from "@/lib/cohortDb";
import { toStatus } from "@/lib/review";
import { BuilderNote } from "@/components/tester/BuilderNote";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();

  // Only what the page renders. The builder's owner_id is never read here: a
  // tester is not told whose project this is (CLAUDE.md, Tester anonymity).
  const { data: mission } = await supabase
    .from("missions")
    .select("id, title, task_description, category, device_target, test_steps, projects(id, name, app_url, description, flagged_at)")
    .eq("id", id)
    .single();

  if (!mission) return notFound();

  const project = one(
    mission.projects as Embedded<Pick<ProjectRow, "id" | "name" | "app_url" | "description" | "flagged_at">>,
  );

  // Read schema, not the write schema: a mission with no steps is the normal
  // state for everything written before test cases, and the form falls back to
  // comment-and-screenshots for those rather than refusing to render.
  const parsedSteps = storedTestStepsSchema.safeParse(mission.test_steps);
  const steps = parsedSteps.success ? parsedSteps.data : [];
  if (project?.flagged_at) return notFound();
  // Owner and earlier-report checks run server-side through service role and
  // reach the page only as booleans: owner_id and test_results are not
  // readable by a signed-in user (20261006_01).
  const admin = createAdminClient();
  const { count: owned } = user && project
    ? await admin
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("id", project.id)
        .eq("owner_id", user.id)
    : { count: 0 };
  const isOwner = !!owned;

  // One report per tester per mission (20260930_02).
  // Read whole rather than counted: once reviewed, the builder's rating and
  // note are shown here. Newest first and limited, not maybeSingle — rows from
  // before 20260930_02 can hold a duplicate, which maybeSingle would throw on.
  const { data: ownRows } = user && !isOwner
    ? await admin
        .from("test_results")
        .select("status, rating, review_note")
        .eq("mission_id", id)
        .eq("tester_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
    : { data: [] };
  const ownReport = (ownRows ?? [])[0] as
    | { status: string | null; rating: number | null; review_note: string | null }
    | undefined;
  const ownReports = !!ownReport;
  const ownStatus = toStatus(ownReport?.status);

  // A paid cohort tester can reach any mission by URL — missions are public.
  // Tell them before they start if this one will not be paid; the payout
  // sheet is what actually decides.
  const unpaidForCohort =
    !!user && !isOwner && !ownReports && (await isCohortTester(user.id)) &&
    !(await missionsForTester(user.id, [id])).has(id);

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ink-muted mb-8 flex-wrap">
        <Link href="/explore" className="hover:text-ink transition-colors duration-150">
          Explore
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-line shrink-0" />
        <span className="text-ink-muted truncate max-w-[180px]">{project?.name}</span>
        <ChevronRight className="w-3.5 h-3.5 text-line shrink-0" />
        <span className="text-ink truncate max-w-[200px]">{mission.title}</span>
      </div>

      {/* Mission title */}
      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-ink mb-6">
        {mission.title}
      </h2>

      {/* Project context card */}
      <div
        id="tour-mission-project"
        className="mb-8 border border-line"
        style={{ background: "var(--color-surface-raised)", borderRadius: 12, padding: "20px 24px" }}
      >
        <h5 className="font-syne font-bold text-[18px] text-ink mb-1">
          {project?.name}
        </h5>
        {project?.app_url && (
          <a
            href={project.app_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] text-info-ink hover:underline block mb-2 truncate"
          >
            {project.app_url.replace(/^https?:\/\//, "")}
          </a>
        )}
        {project?.description && (
          <p className="font-mono text-[14px] text-ink-muted leading-5">
            {project.description}
          </p>
        )}
      </div>

      <div className="mb-8">
        {/* Optional since 20260907_01. Omitted rather than empty-stated: the
            test case is directly below, so an absent notes block is a missing
            block, not a screen with nothing on it (Design.md §8). */}
        {mission.task_description && (
          <div className="mb-6">
            <p
              className="font-mono text-[11px] font-medium uppercase text-accent-ink mb-3"
              style={{ letterSpacing: "1px" }}
            >
              Notes from the Builder
            </p>
            <div
              style={{
                background: "rgba(232,255,71,0.05)",
                borderLeft: "3px solid var(--color-accent-ink)",
                borderRadius: "0 8px 8px 0",
                padding: "16px 20px",
              }}
            >
              <p className="font-mono text-[16px] text-ink leading-6 whitespace-pre-wrap">
                {mission.task_description}
              </p>
            </div>
          </div>
        )}

        <MissionChips
          category={mission.category}
          deviceTarget={mission.device_target}
        />

        {/* The tour's first step anchors here rather than on the notes above,
            which a mission need not have. */}
        <div id="tour-mission-testcase">
          <p className="font-mono text-[12px] text-accent-ink uppercase tracking-[1px] mt-6 mb-3">
            Test steps
          </p>
          <TestCaseView steps={mission.test_steps} />
        </div>
      </div>

      {/* Submission section */}
      {isOwner ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-line rounded-[12px] text-center px-6">
          <ShieldAlert className="w-10 h-10 text-ink-muted mb-4" />
          <h3 className="font-syne font-bold text-[20px] text-ink mb-2">Project Owner</h3>
          <p className="font-mono text-[14px] text-ink-muted max-w-[400px]">
            You created this project. Developers cannot submit test results for their own missions.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 font-mono text-[13px] text-accent-ink hover:underline"
          >
            Go to Dashboard to view results
          </Link>
        </div>
      ) : ownReports ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-line rounded-[12px] text-center px-6">
          <CheckCircle2 className="w-10 h-10 text-success-ink mb-4" aria-hidden="true" />
          <h3 className="font-syne font-bold text-[20px] text-ink mb-2">You&apos;ve tested this mission</h3>
          {ownStatus === "approved" ? (
            <p className="font-mono text-[14px] text-ink max-w-[400px]">
              The builder approved your report
              {ownReport?.rating != null && <> and rated it {ownReport.rating} out of 5</>}.
            </p>
          ) : (
            <p className="font-mono text-[14px] text-ink-muted max-w-[400px]">
              Your report is with the builder. Each mission takes one report per tester.
            </p>
          )}
          {/* In full here — the feed card that links to this page clamps it. */}
          {ownReport?.review_note && (
            <div className="mt-6 w-full max-w-[480px]">
              <BuilderNote note={ownReport.review_note} danger={ownStatus === "changes_requested"} />
            </div>
          )}
          <Link
            href="/explore"
            className="mt-6 font-mono text-[13px] text-accent-ink hover:underline"
          >
            Find another mission
          </Link>
        </div>
      ) : (
        <div id="tour-mission-submit-form">
          {unpaidForCohort && (
            <p className="mb-6 font-mono text-[13px] leading-5 text-ink border-l-2 border-info-ink pl-4">
              This mission isn&apos;t paid for cohort testers. You can still test it — it earns you a
              report, like anyone else.
            </p>
          )}
          <AuditLogForm
            missionId={mission.id}
            appUrl={project?.app_url ?? null}
            steps={steps}
            category={mission.category}
          />
        </div>
      )}

    </div>
  );
}
