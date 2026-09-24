import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AddMissionForm from "@/components/AddMissionForm";

export const metadata = { title: "New Mission — Twnhall" };

export default async function NewMissionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const supabase = await createClient();
  const { projectId } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  const { userId } = await requireAccount("builder");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, owner_id")
    .eq("id", projectId)
    .single();

  if (!project) return notFound();

  // Ownership, in the page as well as in middleware. accessFor() only proves
  // the caller is a builder — every /dashboard/[projectId] route is one builder's
  // alone, and nothing else was checking whose. notFound rather than a 403: a
  // refusal that distinguishes "not yours" from "no such project" confirms the
  // project exists.
  if (project.owner_id !== userId) return notFound();

  return (
    <div className="max-w-[640px] mx-auto px-6 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ink-muted mb-8 flex-wrap">
        <Link href="/dashboard" className="hover:text-ink transition-colors duration-150">
          My Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-line shrink-0" />
        <Link
          href={`/dashboard/${projectId}`}
          className="hover:text-ink transition-colors duration-150 truncate max-w-[160px]"
        >
          {project.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-line shrink-0" />
        <span className="text-ink">New Mission</span>
      </div>

      <AddMissionForm projectId={projectId} projectName={project.name} />

    </div>
  );
}
