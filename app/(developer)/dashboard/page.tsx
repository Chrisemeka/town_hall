import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type ProjectStatus = "active" | "needs-testers" | "draft";

function getStatus(missionCount: number, feedbackCount: number): ProjectStatus {
  if (missionCount === 0) return "draft";
  if (feedbackCount === 0) return "needs-testers";
  return "active";
}

export default async function MyProjectsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch projects with mission and feedback counts
  const { data: raw } = await supabase
    .from("projects")
    .select(`
      id, name, description, app_url, created_at,
      missions (
        id,
        test_results (count)
      )
    `)
    .eq("owner_id", user?.id)
    .order("created_at", { ascending: false });

  const projects = (raw ?? []).map((p: any) => {
    const missions: any[] = p.missions ?? [];
    const missionCount = missions.length;
    const feedbackCount = missions.reduce(
      (sum: number, m: any) => sum + (m.test_results?.[0]?.count ?? 0),
      0,
    );
    return {
      ...p,
      missionCount,
      feedbackCount,
      status: getStatus(missionCount, feedbackCount) as ProjectStatus,
    };
  });

  return (
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">

      {/* Page header */}
      <div id="tour-my-projects-header" className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-syne font-bold text-[28px] leading-[34px] sm:text-[32px] sm:leading-[40px] md:text-[36px] md:leading-[44px] tracking-[-0.5px] text-chalk">
            My Projects
          </h1>
          <p className="font-mono text-[14px] text-ash mt-1">
            Manage your submissions and review incoming feedback.
          </p>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/${project.id}`}
              className="group block"
            >
              <div
                className="bg-graphite border border-iron rounded-[12px] p-6 flex flex-col h-full transition-colors duration-150 group-hover:border-voltage/30"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                {/* Card header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h5 className="font-syne font-bold text-[20px] leading-7 text-chalk group-hover:text-voltage transition-colors duration-150 truncate">
                    {project.name}
                  </h5>
                  <Badge variant={project.status} />
                </div>

                {/* Description */}
                <p className="font-mono text-[14px] leading-5 text-ash line-clamp-2 mb-4">
                  {project.description || "No description provided."}
                </p>

                {/* URL */}
                {project.app_url && (
                  <p className="font-mono text-[13px] text-sky truncate mb-6">
                    {project.app_url.replace(/^https?:\/\//, "")}
                  </p>
                )}

                {/* Footer row */}
                <div className="mt-auto pt-4 border-t border-iron flex items-center justify-between">
                  <span className="font-mono text-[12px] text-ash">
                    {project.missionCount} Mission{project.missionCount !== 1 ? "s" : ""}
                    {" · "}
                    {project.feedbackCount} Feedback{project.feedbackCount !== 1 ? "s" : ""}
                  </span>
                  <span className="font-mono text-[13px] font-medium text-ash group-hover:text-chalk transition-colors duration-150 flex items-center gap-1">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-iron rounded-[12px] bg-graphite/30">
          <FolderOpen className="w-12 h-12 text-ash mb-4" strokeWidth={1.5} />
          <h4 className="font-syne font-bold text-[24px] text-chalk mb-2">Nothing here yet.</h4>
          <p className="font-mono text-[14px] text-ash mb-6 text-center max-w-xs">
            Submit your first project and let the community test it.
          </p>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/new" className="flex items-center gap-2">
              <span>+</span> New Project
            </Link>
          </Button>
        </div>
      )}

    </div>
  );
}
