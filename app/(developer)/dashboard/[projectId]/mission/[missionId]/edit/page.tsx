import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/auth";
import { one } from "@/lib/utils/project";
import type { Embedded, ProjectRow } from "@/lib/types/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import EditMissionForm from "@/components/EditMissionForm";
import { storedTestStepsSchema } from "@/lib/validation/schemas";

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

  const { userId } = await requireAccount("builder");

  const { data: mission } = await supabase
    .from("missions")
    .select("*, projects(id, name, owner_id)")
    .eq("id", missionId)
    .single();

  if (!mission) return notFound();

  // Ownership, in the page as well as in middleware. accessFor() only proves the
  // caller is a builder, and nothing here was checking whose mission this is.
  // Checked against the mission's OWN project rather than the projectId in the
  // URL — otherwise owning the project in the path would be enough to open
  // someone else's mission through it. The project_id match is the other half:
  // it keeps the breadcrumb honest. notFound rather than a 403, so a refusal
  // does not confirm the mission exists.
  const missionProject = one(mission.projects as Embedded<Pick<ProjectRow, "id" | "name" | "owner_id">>);
  if (missionProject?.owner_id !== userId) return notFound();
  if (mission.project_id !== projectId) return notFound();

  const projectName = missionProject?.name ?? "Project";

  // Parsed here rather than in the form: test_steps is jsonb and nothing in the
  // database constrains its shape, so a row written before the schema existed —
  // or by hand — must degrade to an empty editor rather than crash the page.
  const parsedSteps = storedTestStepsSchema.safeParse(mission.test_steps);
  const initialSteps = parsedSteps.success ? parsedSteps.data : [];

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
        initialDeviceTarget={mission.device_target ?? "both"}
        initialSteps={initialSteps}
        initialTemplateId={mission.template_id ?? null}
        initialCategory={mission.category ?? ""}
        isActive={mission.is_active !== false}
      />

    </div>
  );
}
