import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccount } from "@/lib/auth";
import type { MissionRow } from "@/lib/types/db";

/** Exactly what the select below asks for. */
type PagedMissionRow = Pick<MissionRow, "id" | "title" | "is_active" | "project_id"> & {
  test_results: { count: number }[] | null;
};
import Link from "next/link";
import { Target } from "lucide-react";
import { MissionListPaged, type PagedMission } from "@/components/MissionListPaged";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "My Missions — Twnhall" };

export default async function MyMissionsPage() {
  const { userId } = await requireAccount("builder");
  // Service role: owner_id and test_results are not readable by a signed-in
  // user (20261006_01). The owner_id filter is the scoping; missions are keyed
  // off its ids.
  const admin = createAdminClient();

  const { data: projects } = await admin
    .from("projects")
    .select("id, name")
    .eq("owner_id", userId);

  const projectIds  = (projects ?? []).map((p) => p.id);
  const projectMap  = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]));

  const { data: rawMissions } =
    projectIds.length > 0
      ? await admin
          .from("missions")
          .select("id, title, is_active, project_id, test_results(count)")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
      : { data: [] as PagedMissionRow[] };

  const missions: PagedMission[] = (rawMissions ?? []).map((m) => ({
    id:            m.id,
    title:         m.title,
    project_id:    m.project_id,
    projectName:   projectMap[m.project_id] ?? "Unknown Project",
    feedbackCount: m.test_results?.[0]?.count ?? 0,
    status:        m.is_active !== false ? "active" : "draft",
  }));

  return (
    <div className="max-w-[800px] mx-auto px-4 medium:px-6 expanded:px-8 pt-16 pb-6 medium:pt-20 medium:pb-8 expanded:py-10">

      {/* Compact: the button sits under the subhead, full width, rather than
          fighting the h1 for 328px. */}
      <div id="tour-my-missions-header" className="flex flex-col gap-4 medium:flex-row medium:items-start medium:justify-between mb-6 medium:mb-8">
        <div>
          <h1 className="font-syne font-bold text-[28px] leading-9 medium:text-[32px] medium:leading-10 expanded:text-[36px] expanded:leading-[44px] tracking-[-0.5px] text-ink">
            My Missions
          </h1>
          <p className="font-mono text-[14px] text-ink-muted mt-1">
            All missions across your projects.
          </p>
        </div>
        {/* A mission belongs to a project: with none, there is nothing to add
            one to, and the empty state below points at My Projects. */}
        {projectIds.length > 0 && (
          <Button variant="ghost" asChild>
            <Link href="/dashboard" className="shrink-0 w-full medium:w-auto medium:mt-1">
              + Add Mission
            </Link>
          </Button>
        )}
      </div>

      {missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 medium:py-16 border border-dashed border-line rounded-[12px] text-center px-6">
          <Target className="w-12 h-12 text-ink-muted mb-4 opacity-40" />
          <h3 className="font-syne font-bold text-[24px] text-ink mb-2">No missions yet.</h3>
          <p className="font-mono text-[14px] text-ink-muted mb-6 max-w-[340px]">
            Add a mission to active your project and start receiving tester feedback.
          </p>
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Go to My Projects</Link>
          </Button>
        </div>
      ) : (
        <MissionListPaged missions={missions} />
      )}

    </div>
  );
}
