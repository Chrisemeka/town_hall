import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { toggleMissionStatus } from "@/actions/missions";
import { TestResultCard } from "@/components/test-card";
import { ChevronLeft, Info, Activity, PowerOff, Power } from "lucide-react";

export default async function DeveloperMissionDetailPage({ 
  params 
}: { 
  params: Promise<{ projectId: string; missionId: string }> 
}) {
  const supabase = await createClient();
  const { projectId, missionId } = await params;

  const [missionRes, resultsRes] = await Promise.all([
    supabase.from("missions").select("*, projects(*)").eq("id", missionId).single(),
    supabase.from("test_results").select("*, missions!inner(title, project_id)").eq("mission_id", missionId).order("created_at", { ascending: false })
  ]);

  if (!missionRes.data) return notFound();

  const mission = missionRes.data;
  const results = resultsRes.data || [];

  return (
    <div className="max-w-5xl mx-auto p-8 lg:p-16">
      <Link 
        href={`/dashboard/${projectId}`} 
        className="inline-flex items-center gap-2 text-secondary hover:text-on-surface transition-colors mb-12 group"
      >
        <div className="w-8 h-8 rounded bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:bg-on-surface group-hover:text-surface transition-colors">
          <ChevronLeft size={16} />
        </div>
        <span className="text-sm font-medium">Back to Project Hub</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        
        {/* Left Col: Mission Config */}
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-surface border border-outline-variant rounded-2xl p-8 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-on-surface opacity-[0.02] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex items-center justify-between mb-6">
              <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                mission.is_active !== false 
                  ? "bg-on-surface text-surface" 
                  : "bg-surface-variant text-secondary border border-outline-variant"
              }`}>
                {mission.is_active !== false ? <Activity size={12} /> : <PowerOff size={12} />}
                {mission.is_active !== false ? "Active" : "Inactive"}
              </span>
            </div>

            <h1 className="text-3xl font-medium tracking-tight text-on-surface mb-6 leading-tight">{mission.title}</h1>
            
            <div className="mb-8 p-4 bg-surface-variant/50 rounded-xl border border-outline-variant/50">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-secondary uppercase tracking-wider mb-2">
                <Info size={14} /> Execution Parameters
              </h3>
              <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                {mission.task_description}
              </p>
            </div>

            <div className="pt-8 border-t border-outline-variant/50">
              <form action={async () => {
                "use server";
                await toggleMissionStatus(mission.id, projectId, mission.is_active !== false ? false : true);
              }}>
                <button
                  type="submit"
                  className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-medium transition-all ${
                    mission.is_active !== false
                      ? "bg-surface-variant hover:bg-error-container/20 border border-outline-variant hover:border-error/20 hover:text-error text-secondary"
                      : "bg-on-surface text-surface hover:bg-white/90 border border-transparent shadow-sm"
                  }`}
                >
                  {mission.is_active !== false ? (
                    <><PowerOff size={16} /> Deactivate Mission</>
                  ) : (
                    <><Power size={16} /> Reactivate Mission</>
                  )}
                </button>
              </form>
              <p className="text-xs text-secondary mt-3 text-center leading-relaxed">
                {mission.is_active !== false 
                  ? "Deactivating hides this mission from testers to prevent further submissions."
                  : "Reactivating publishes this mission back to the tester network."}
              </p>
            </div>
          </section>
        </div>

        {/* Right Col: Feed Specific to this mission */}
        <div className="lg:col-span-7">
          <section>
            <h2 className="text-xl font-medium text-on-surface mb-8 tracking-tight">Test Results ({results.length})</h2>
            
            {results.length > 0 ? (
              <div className="grid grid-cols-1 gap-8">
                {results.map((result) => (
                  <TestResultCard key={result.id} data={result} />
                ))}
              </div>
            ) : (
              <div className="p-16 text-center bg-surface border border-dashed border-outline-variant rounded-2xl flex flex-col items-center shadow-sm">
                 <Activity size={32} className="text-outline mb-4 opacity-50" />
                 <p className="text-sm text-secondary">Awaiting first successful teleport of evidence.</p>
              </div>
            )}
          </section>
        </div>

      </div>
    </div>
  );
}
