import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccount } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import EditProjectForm from "@/components/EditProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { userId } = await requireAccount("builder");
  const { projectId } = await params;

  // Service role: owner_id is not readable by a signed-in user (20261006_01).
  const { data: project } = await createAdminClient()
    .from("projects")
    .select("name, app_url, description, category, owner_id")
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
    <div className="max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10">
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ink-muted mb-8">
        <Link href="/dashboard" className="hover:text-ink transition-colors duration-150">
          My Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-line" />
        <Link href={`/dashboard/${projectId}`} className="hover:text-ink transition-colors duration-150 truncate max-w-[240px]">
          {project.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-line" />
        <span className="text-ink">Edit</span>
      </div>

      <div className="max-w-2xl mx-auto">
        <EditProjectForm
          projectId={projectId}
          initialName={project.name ?? ""}
          initialUrl={project.app_url ?? ""}
          initialDescription={project.description ?? ""}
          initialCategory={project.category ?? null}
        />
      </div>
    </div>
  );
}
