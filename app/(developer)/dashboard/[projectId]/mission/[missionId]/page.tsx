import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { toggleMissionStatus } from "@/actions/missions";
import { ChevronLeft, Pencil, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import DeleteMissionButton from "@/components/DeleteMissionButton";
import MissionResultRow from "@/components/MissionResultRow";

export default async function DeveloperMissionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; missionId: string }>;
}) {
  const supabase = await createClient();
  const { projectId, missionId } = await params;

  const [missionRes, resultsRes] = await Promise.all([
    supabase.from("missions").select("*, projects(*)").eq("id", missionId).single(),
    supabase
      .from("test_results")
      .select("*, missions!inner(title, project_id)")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: false }),
  ]);

  if (!missionRes.data) return notFound();

  const mission = missionRes.data;
  const results = resultsRes.data || [];
  const project = (mission as any).projects as any;
  const isActive = mission.is_active !== false;

  return (
    <div className="max-w-[1128px] mx-auto px-8 py-8">

      {/* Navigation bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-10 pb-6 border-b border-iron">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/dashboard/${projectId}`}
            className="flex items-center gap-1.5 h-8 px-3 border border-iron rounded-[6px] font-mono text-[13px] text-ash hover:text-chalk hover:border-ash transition-colors duration-150 shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <div className="font-mono text-[13px] text-ash flex items-center gap-1.5 min-w-0">
            <Link href="/dashboard" className="hover:text-chalk transition-colors duration-150 shrink-0">
              My Projects
            </Link>
            <span className="text-iron shrink-0">/</span>
            <Link
              href={`/dashboard/${projectId}`}
              className="hover:text-chalk transition-colors duration-150 truncate max-w-[100px] sm:max-w-[160px]"
            >
              {project?.name ?? "Project"}
            </Link>
            <span className="text-iron shrink-0">/</span>
            <span className="text-chalk truncate max-w-[120px] sm:max-w-[200px]">{mission.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/dashboard/${projectId}/mission/${missionId}/edit`}
            className="h-8 px-3 border border-iron text-ash rounded-[6px] font-mono text-[13px] hover:text-chalk hover:border-ash transition-colors duration-150 flex items-center gap-1.5"
          >
            <Pencil className="w-3 h-3" />
            Edit Mission
          </Link>

          <form
            action={async () => {
              "use server";
              await toggleMissionStatus(mission.id, projectId, !isActive);
            }}
          >
            <button
              type="submit"
              className={`h-8 px-3 rounded-[6px] font-mono text-[13px] transition-colors duration-150 flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? "bg-ember/10 border border-ember/30 text-ember hover:bg-ember/20"
                  : "bg-voltage/10 border border-voltage/30 text-voltage hover:bg-voltage/20"
              }`}
            >
              {isActive ? (
                <><PowerOff className="w-3 h-3" /> Deactivate</>
              ) : (
                <><Power className="w-3 h-3" /> Reactivate</>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Mission header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Badge variant={isActive ? "active" : "draft"} />
          <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk">
            {mission.title}
          </h1>
        </div>
        <p className="font-mono text-[11px] text-voltage uppercase tracking-[0.8px] mb-2">
          EXECUTION PARAMETERS
        </p>
        <p className="font-mono text-[15px] leading-6 text-ash max-w-3xl">
          {mission.task_description}
        </p>
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-iron rounded-[12px]">
          <p className="font-syne font-bold text-[20px] text-chalk mb-2">No submissions yet.</p>
          <p className="font-mono text-[14px] text-ash">
            Results will appear here once testers start submitting feedback.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {results.map((result, i) => (
            <MissionResultRow
              key={result.id}
              result={result}
              index={i}
              appUrl={project?.app_url ?? null}
            />
          ))}
        </div>
      )}

      {/* Delete (inactive missions only) */}
      {!isActive && (
        <div className="mt-10 pt-6 border-t border-iron flex flex-col items-start gap-2">
          <DeleteMissionButton missionId={mission.id} projectId={projectId} />
          <p className="font-mono text-[12px] text-ash">
            Permanently deletes this draft. This cannot be undone.
          </p>
        </div>
      )}
    </div>
  );
}
