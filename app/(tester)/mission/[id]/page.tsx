import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ChevronRight, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getOwnerId } from "@/lib/utils/project";
import TesterSubmissionForm from "@/components/TesterSubmissionForm";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();

  const { data: mission } = await supabase
    .from("missions")
    .select("*, projects(*)")
    .eq("id", id)
    .single();

  if (!mission) return notFound();

  const projectData = mission.projects as any;
  const project = Array.isArray(projectData) ? projectData[0] : projectData;
  if (project?.flagged_at) return notFound();
  const isOwner = user?.id === getOwnerId(mission.projects);

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ash mb-8 flex-wrap">
        <Link href="/explore" className="hover:text-chalk transition-colors duration-150">
          Explore
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron shrink-0" />
        <span className="text-ash truncate max-w-[180px]">{project?.name}</span>
        <ChevronRight className="w-3.5 h-3.5 text-iron shrink-0" />
        <span className="text-chalk truncate max-w-[200px]">{mission.title}</span>
      </div>

      {/* Mission title */}
      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk mb-6">
        {mission.title}
      </h2>

      {/* Project context card */}
      <div
        className="mb-8 border border-iron"
        style={{ background: "#1A1A1F", borderRadius: 12, padding: "20px 24px" }}
      >
        <h5 className="font-syne font-bold text-[18px] text-chalk mb-1">
          {project?.name}
        </h5>
        {project?.app_url && (
          <a
            href={project.app_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] text-sky hover:underline block mb-2 truncate"
          >
            {project.app_url.replace(/^https?:\/\//, "")}
          </a>
        )}
        {project?.description && (
          <p className="font-mono text-[14px] text-ash leading-5">
            {project.description}
          </p>
        )}
      </div>

      {/* YOUR MISSION callout */}
      <div className="mb-8">
        <p
          className="font-mono text-[11px] font-medium uppercase text-voltage mb-3"
          style={{ letterSpacing: "1px" }}
        >
          Your Mission
        </p>
        <div
          style={{
            background: "rgba(232,255,71,0.05)",
            borderLeft: "3px solid #E8FF47",
            borderRadius: "0 8px 8px 0",
            padding: "16px 20px",
          }}
        >
          <p className="font-mono text-[16px] text-chalk leading-6 whitespace-pre-wrap">
            {mission.task_description}
          </p>
        </div>
      </div>

      {/* Submission section */}
      {isOwner ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-iron rounded-[12px] text-center px-6">
          <ShieldAlert className="w-10 h-10 text-ash mb-4" />
          <h3 className="font-syne font-bold text-[20px] text-chalk mb-2">Project Owner</h3>
          <p className="font-mono text-[14px] text-ash max-w-[400px]">
            You created this project. Developers cannot submit test results for their own missions.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 font-mono text-[13px] text-voltage hover:underline"
          >
            Go to Dashboard to view results
          </Link>
        </div>
      ) : (
        <TesterSubmissionForm
          missionId={mission.id}
          appUrl={project?.app_url ?? null}
        />
      )}

    </div>
  );
}
