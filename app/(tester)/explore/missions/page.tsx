import { createClient } from "@/lib/supabase/server";
import { BrowseMissions, type BrowseMission } from "@/components/BrowseMissions";

export const metadata = { title: "Browse Missions — Townhall" };

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
      projects (id, name, app_url),
      test_results (count)
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const missions: BrowseMission[] = (raw ?? []).map((m: any) => {
    const project = Array.isArray(m.projects) ? m.projects[0] : m.projects;
    return {
      id:             m.id,
      title:          m.title,
      created_at:     m.created_at,
      projectId:      project?.id ?? "",
      projectName:    project?.name ?? "Unknown",
      projectHandle:  handleFromUrl(project?.app_url ?? null, project?.name ?? ""),
      feedbackCount:  m.test_results?.[0]?.count ?? 0,
    } satisfies BrowseMission;
  });

  return (
    <div className="max-w-[800px] mx-auto px-8 py-10">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk">
          Browse Missions
        </h1>
        <p className="font-mono text-[14px] text-ash mt-1">
          Pick a mission and start testing.
        </p>
      </div>

      <BrowseMissions missions={missions} />

    </div>
  );
}
