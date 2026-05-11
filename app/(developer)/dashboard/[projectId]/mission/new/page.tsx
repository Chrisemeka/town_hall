import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AddMissionForm from "@/components/AddMissionForm";

export const metadata = { title: "New Mission — Townhall" };

export default async function NewMissionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const supabase = await createClient();
  const { projectId } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (!project) return notFound();

  return (
    <div className="max-w-[640px] mx-auto px-6 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ash mb-8 flex-wrap">
        <Link href="/dashboard" className="hover:text-chalk transition-colors duration-150">
          My Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron shrink-0" />
        <Link
          href={`/dashboard/${projectId}`}
          className="hover:text-chalk transition-colors duration-150 truncate max-w-[160px]"
        >
          {project.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron shrink-0" />
        <span className="text-chalk">New Mission</span>
      </div>

      <AddMissionForm projectId={projectId} projectName={project.name} />

    </div>
  );
}
