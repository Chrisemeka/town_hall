import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccount } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AddMissionForm from "@/components/AddMissionForm";
import { AllowanceNotice } from "@/components/missions/AllowanceNotice";
import { reportBalance } from "@/lib/allowanceDb";

export const metadata = { title: "New Mission — Twnhall" };

export default async function NewMissionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { userId } = await requireAccount("builder");

  // Service role: owner_id is not readable by a signed-in user (20261006_01).
  const { data: project } = await createAdminClient()
    .from("projects")
    .select("id, name, app_url, description, owner_id")
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
    <div className="max-w-[640px] mx-auto px-4 medium:px-6 pt-16 pb-6 medium:pt-20 medium:pb-10 expanded:py-10">

      {/* Below 600px a 48px back link to the project; from 600px the trail. */}
      <Link href={`/dashboard/${projectId}`} className="medium:hidden inline-flex items-center gap-1 min-h-12 -ml-2 px-2 mb-4 font-mono text-[14px] text-ink-muted hover:text-ink transition-colors duration-150 [overflow-wrap:anywhere]">
        <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
        {project.name}
      </Link>
      <div className="hidden medium:flex items-center gap-1.5 font-mono text-[13px] text-ink-muted mb-8 flex-wrap">
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

      <AddMissionForm
        projectId={projectId}
        // Named, not the row: the row carries owner_id, and this is a client component.
        project={{ name: project.name, app_url: project.app_url, description: project.description }}
        allowance={<AllowanceNotice view={await reportBalance(userId)} />}
      />

    </div>
  );
}
