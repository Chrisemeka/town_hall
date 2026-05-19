import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Pencil, Flag } from "lucide-react";
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
  const supabase = await createClient();
  const { projectId } = await params;

  const [projectRes, missionsRes, resultsRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase
      .from("missions")
      .select("id, title, task_description, created_at, is_active, test_results(count)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("test_results")
      .select("id, tester_comment, screenshot_url, created_at, missions!inner(id, title, project_id)")
      .eq("missions.project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  if (!projectRes.data) return notFound();

  const project  = projectRes.data;
  const missions = (missionsRes.data ?? []) as any[];
  const results  = (resultsRes.data ?? []) as any[];

  const missionCount  = missions.length;
  const feedbackCount = results.length;
  const status        = getStatus(missionCount, feedbackCount);

  return (
    <div className="max-w-[1128px] mx-auto px-8 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ash mb-8">
        <Link href="/dashboard" className="hover:text-chalk transition-colors duration-150">
          My Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron" />
        <span className="text-chalk truncate max-w-[240px]">{project.name}</span>
      </div>

      {/* Flag warning banner (shown to owner when an admin has flagged this project) */}
      {project.flagged_at && (
        <div
          className="rounded-[12px] p-5 mb-8 flex items-start gap-4"
          style={{
            background: "rgba(255,79,79,0.06)",
            border: "1px solid rgba(255,79,79,0.3)",
          }}
        >
          <div
            className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,79,79,0.12)", border: "1px solid rgba(255,79,79,0.3)" }}
          >
            <Flag className="w-4 h-4" style={{ color: "#FF4F4F" }} />
          </div>
          <div className="min-w-0">
            <p className="font-syne font-bold text-[16px]" style={{ color: "#FF4F4F" }}>
              This project has been flagged by an admin.
            </p>
            <p className="font-mono text-[13px] text-ash mt-1 leading-5">
              Your project is hidden from public discovery (Explore, Browse Missions, search) until the issue is resolved.
            </p>
            {project.flag_reason && (
              <div className="mt-3 rounded-[8px] p-3" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,79,79,0.2)" }}>
                <p className="font-mono text-[11px] uppercase tracking-[1px] text-ash mb-1">Reason</p>
                <p className="font-mono text-[13px] text-chalk leading-5 whitespace-pre-wrap">
                  {project.flag_reason}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-10">
        <div className="flex flex-col gap-3 min-w-0">
          {/* Name + badge */}
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="font-syne font-bold text-[48px] leading-[52px] tracking-[-0.5px] text-chalk">
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
              className="font-mono text-[13px] text-sky hover:underline w-fit"
            >
              {project.app_url.replace(/^https?:\/\//, "")}
            </a>
          )}

          {/* Summary */}
          {project.description && (
            <p className="font-mono text-[16px] leading-6 text-ash max-w-2xl">
              {project.description}
            </p>
          )}
        </div>

        {/* Edit button */}
        <Link
          href={`/dashboard/${projectId}/edit`}
          className="h-9 px-4 border border-iron text-ash rounded-[8px] font-mono text-[14px] hover:text-chalk hover:border-ash transition-colors duration-150 flex items-center gap-2 shrink-0"
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
