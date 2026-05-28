import { createClient } from "@/lib/supabase/server";
import { BrowseMissions, type BrowseMission } from "@/components/BrowseMissions";

export const metadata = { title: "Browse Missions — Twnhall" };

function handleFromUrl(url: string | null, name: string) {
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "")
      return `@${host.split(".")[0]}`
    } catch { /* fall through */ }
  }
  return `@${name.toLowerCase().replace(/\s+/g, "")}`
}

export default async function BrowseMissionsPage() {
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("missions")
    .select(`
      id, title, created_at,
      projects!inner (id, name, app_url, flagged_at)
    `)
    .eq("is_active", true)
    .is("projects.flagged_at", null)
    .order("created_at", { ascending: false });

  const missionIds = (raw ?? []).map((m: any) => m.id);
  const countByMission: Record<string, number> = {};
  if (missionIds.length > 0) {
    const { data: counts } = await supabase
      .from("mission_feedback_counts")
      .select("mission_id, count")
      .in("mission_id", missionIds);

    for (const c of counts ?? []) {
      countByMission[c.mission_id] = c.count;
    }
  }

  const missions: BrowseMission[] = (raw ?? []).map((m: any) => {
    const project = Array.isArray(m.projects) ? m.projects[0] : m.projects;
    return {
      id:             m.id,
      title:          m.title,
      created_at:     m.created_at,
      projectId:      project?.id ?? "",
      projectName:    project?.name ?? "Unknown",
      projectHandle:  handleFromUrl(project?.app_url ?? null, project?.name ?? ""),
      feedbackCount:  countByMission[m.id] ?? 0,
    } satisfies BrowseMission;
  });

  return (
    <div className="max-w-[800px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">

      {/* Page header */}
      <div id="tour-browse-missions-header" className="mb-8">
        <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk">
          Browse Missions
        </h1>
        <p className="font-mono text-[14px] text-ash mt-1">
          Pick a mission and start testing.
        </p>
      </div>

      <div id="tour-browse-missions-list">
        <BrowseMissions missions={missions} />
      </div>

    </div>
  );
}
