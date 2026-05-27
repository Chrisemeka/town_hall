import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Target } from "lucide-react";
import { MissionListPaged, type PagedMission } from "@/components/MissionListPaged";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "My Missions — Townhall" };

export default async function MyMissionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("owner_id", user.id);

  const projectIds  = (projects ?? []).map((p) => p.id);
  const projectMap  = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]));

  const { data: rawMissions } =
    projectIds.length > 0
      ? await supabase
          .from("missions")
          .select("id, title, is_active, project_id, test_results(count)")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

  const missions: PagedMission[] = (rawMissions ?? []).map((m: any) => ({
    id:            m.id,
    title:         m.title,
    project_id:    m.project_id,
    projectName:   projectMap[m.project_id] ?? "Unknown Project",
    feedbackCount: m.test_results?.[0]?.count ?? 0,
    status:        m.is_active !== false ? "active" : "draft",
  }));

  return (
    <div className="max-w-[800px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">

      <div id="tour-my-missions-header" className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk">
            My Missions
          </h1>
          <p className="font-mono text-[14px] text-ash mt-1">
            All missions across your projects.
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/dashboard" className="shrink-0 mt-1">
            + Add Mission
          </Link>
        </Button>
      </div>

      {missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-iron rounded-[12px] text-center px-6">
          <Target className="w-12 h-12 text-ash mb-4 opacity-40" />
          <h3 className="font-syne font-bold text-[24px] text-chalk mb-2">No missions yet.</h3>
          <p className="font-mono text-[14px] text-ash mb-6 max-w-[340px]">
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
