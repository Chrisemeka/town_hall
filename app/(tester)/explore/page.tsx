import { createClient } from "@/lib/supabase/server";
import { ExploreGrid, type ExploreProject } from "@/components/ExploreGrid";

export default async function ExploreProjectsPage() {
  const supabase = await createClient();

  /* Fetch all projects that have at least one active mission */
  const { data: raw } = await supabase
    .from("projects")
    .select(`
      id, name, description, app_url, created_at,
      missions (id, is_active, test_results (count))
    `)
    .order("created_at", { ascending: false });

  const projects: ExploreProject[] = (raw ?? [])
    .map((p: any) => {
      const allMissions: any[] = p.missions ?? [];
      const active = allMissions.filter((m) => m.is_active !== false);
      const missionCount  = active.length;
      const feedbackCount = active.reduce(
        (sum: number, m: any) => sum + (m.test_results?.[0]?.count ?? 0),
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
