import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import EditMissionForm from "@/components/EditMissionForm";

export const metadata = { title: "Edit Mission — Twnhall" };

export default async function EditMissionPage({
  params,
}: {
  params: Promise<{ projectId: string; missionId: string }>;
}) {
  const supabase = await createClient();
  const { projectId, missionId } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  const { data: mission } = await supabase
    .from("missions")
    .select("*, projects(id, name)")
    .eq("id", missionId)
    .single();

  if (!mission) return notFound();

  const projectName = (mission.projects as { name: string } | null)?.name ?? "Project";

  return (
    <div className="max-w-[640px] mx-auto px-6 py-10">

      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ash mb-8 flex-wrap">
        <Link href="/dashboard" className="hover:text-chalk transition-colors duration-150">
          My Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron shrink-0" />
        <Link
          href={`/dashboard/${projectId}`}
          className="hover:text-chalk transition-colors duration-150 truncate max-w-[120px]"
        >
          {projectName}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron shrink-0" />
        <Link
          href={`/dashboard/${projectId}/mission/${missionId}`}
          className="hover:text-chalk transition-colors duration-150"
        >
          Mission
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron shrink-0" />
        <span className="text-chalk">Edit</span>
      </div>

      <EditMissionForm
        missionId={missionId}
        projectId={projectId}
        projectName={projectName}
        initialTitle={mission.title}
        initialDescription={mission.task_description}
        isActive={mission.is_active !== false}
      />

    </div>
  );
}
