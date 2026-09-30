import { createClient } from "@/lib/supabase/server";
import { missionsForTester } from "@/lib/cohortDb";
import { ExploreGrid, type ExploreProject } from "@/components/ExploreGrid";
import type { MissionRow, ProjectRow } from "@/lib/types/db";

/** Exactly what the select below asks for. */
type ExploreRow = Pick<
  ProjectRow,
  "id" | "name" | "description" | "app_url" | "category" | "created_at"
> & {
  missions: Pick<MissionRow, "id" | "is_active">[] | null;
};

export default async function ExploreProjectsPage() {
  const supabase = await createClient();

  /* Fetch all projects with their missions */
  const { data: raw } = await supabase
    .from("projects")
    .select(`
      id, name, description, app_url, category, created_at,
      missions (id, is_active)
    `)
    .is("flagged_at", null)
    .order("created_at", { ascending: false });

  /* Collect all active mission IDs across every project */
  const rows = (raw ?? []) as ExploreRow[];
  const liveIds = rows.flatMap((p) =>
    (p.missions ?? [])
      .filter((m) => m.is_active !== false)
      .map((m) => m.id),
  );
  // A paid cohort tester sees only missions the cohort may be paid for.
  // Everyone else gets every live mission back.
  const { data: { user } } = await supabase.auth.getUser();
  const shown = await missionsForTester(user?.id, liveIds);
  const allActiveMissionIds = liveIds.filter((id) => shown.has(id));

  /* Counts come from the public view so tester comments stay private */
  const feedbacksByMission: Record<string, number> = {};
  if (allActiveMissionIds.length > 0) {
    const { data: counts } = await supabase
      .from("mission_feedback_counts")
      .select("mission_id, count")
      .in("mission_id", allActiveMissionIds);

    for (const c of counts ?? []) {
      feedbacksByMission[c.mission_id] = c.count;
    }
  }

  const projects: ExploreProject[] = rows
    .map((p) => {
      const allMissions = p.missions ?? [];
      const active = allMissions.filter((m) => m.is_active !== false && shown.has(m.id));
      const missionCount  = active.length;
      const feedbackCount = active.reduce(
        (sum, m) => sum + (feedbacksByMission[m.id] ?? 0),
        0,
      );
      const firstMissionId = active[0]?.id ?? null;

      return {
        id:            p.id,
        name:          p.name,
        description:   p.description,
        app_url:       p.app_url,
        category:      p.category,
        created_at:    p.created_at,
        missionCount,
        feedbackCount,
        firstMissionId,
        status: feedbackCount === 0 ? "needs-testers" : "active",
      } satisfies ExploreProject;
    })
    /* Only surface projects with at least one active mission */
    .filter((p) => p.missionCount > 0);

  return (
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">

      {/* Page header */}
      <div id="tour-explore-header" className="mb-8">
        <h1 className="font-syne font-bold text-[28px] leading-[34px] sm:text-[32px] sm:leading-[40px] md:text-[36px] md:leading-[44px] tracking-[-0.5px] text-ink">
          Explore Projects
        </h1>
        <p className="font-mono text-[14px] text-ink-muted mt-1">
          Find something to test.
        </p>
      </div>

      <div id="tour-explore-grid">
        <ExploreGrid projects={projects} />
      </div>

    </div>
  );
}
