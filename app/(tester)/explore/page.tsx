import { createClient } from "@/lib/supabase/server";
import { ExploreGrid, type ExploreProject } from "@/components/ExploreGrid";

export default async function ExploreProjectsPage() {
  const supabase = await createClient();

  /* Fetch all projects with their missions */
  const { data: raw } = await supabase
    .from("projects")
    .select(`
      id, name, description, app_url, created_at,
      missions (id, is_active)
    `)
    .is("flagged_at", null)
    .order("created_at", { ascending: false });

  /* Collect all active mission IDs across every project */
  const allActiveMissionIds = (raw ?? []).flatMap((p: any) =>
    (p.missions ?? [])
      .filter((m: any) => m.is_active !== false)
      .map((m: any) => m.id),
  );

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

  const projects: ExploreProject[] = (raw ?? [])
    .map((p: any) => {
      const allMissions: any[] = p.missions ?? [];
      const active = allMissions.filter((m) => m.is_active !== false);
      const missionCount  = active.length;
      const feedbackCount = active.reduce(
        (sum: number, m: any) => sum + (feedbacksByMission[m.id] ?? 0),
        0,
      );
      const firstMissionId = active[0]?.id ?? null;

      return {
        id:            p.id,
        name:          p.name,
        description:   p.description,
        app_url:       p.app_url,
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
    <div className="max-w-[1128px] mx-auto px-8 py-10">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk">
          Explore Projects
        </h1>
        <p className="font-mono text-[14px] text-ash mt-1">
          Find something to test.
        </p>
      </div>

      <ExploreGrid projects={projects} />

    </div>
  );
}
