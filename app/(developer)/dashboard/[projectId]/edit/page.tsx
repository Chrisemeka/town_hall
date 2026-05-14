import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import EditProjectForm from "@/components/EditProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const supabase = await createClient();
  const { projectId } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) return notFound();

  return (
    <div className="max-w-[1128px] mx-auto px-8 py-10">
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ash mb-8">
        <Link href="/dashboard" className="hover:text-chalk transition-colors duration-150">
          My Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron" />
        <Link href={`/dashboard/${projectId}`} className="hover:text-chalk transition-colors duration-150 truncate max-w-[240px]">
          {project.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron" />
        <span className="text-chalk">Edit</span>
      </div>

      <div className="max-w-2xl mx-auto">
        <EditProjectForm
          projectId={projectId}
          initialName={project.name ?? ""}
          initialUrl={project.app_url ?? ""}
          initialDescription={project.description ?? ""}
        />
      </div>
    </div>
  );
}
