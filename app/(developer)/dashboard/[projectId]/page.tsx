import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import AddMissionForm from "@/components/AddMissionForm";
import { TestResultCard } from "@/components/test-card";
import { Beaker, Globe, ClipboardList, Package, PowerOff } from "lucide-react";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const supabase = await createClient();
  const { projectId } = await params;

  // 1. Fetch Project, Missions, and Results in parallel
  const [projectRes, missionsRes, resultsRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("missions").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("test_results").select("*, missions!inner(title, project_id)").eq("missions.project_id", projectId).order("created_at", { ascending: false })
  ]);

  if (!projectRes.data) return notFound();

  const project = projectRes.data;
  const missions = missionsRes.data || [];
  const results = resultsRes.data || [];

  return (
    <div className="max-w-7xl mx-auto p-8 lg:p-16">
      <header className="mb-16 border-b border-outline-variant/30 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-surface-variant rounded-xl flex items-center justify-center border border-outline-variant">
              <Package className="text-secondary" size={24} />
            </div>
            <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-on-surface">{project.name}</h1>
          </div>
          {project.app_url && (
            <a href={project.app_url} target="_blank" className="text-sm font-medium text-secondary hover:text-on-surface flex items-center gap-2 transition-colors">
              <Globe size={16} /> {project.app_url}
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Left Column: Results Feed (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          <section>
            <h2 className="text-2xl font-medium text-on-surface mb-8 flex items-center gap-3 tracking-tight">
              <div className="w-8 h-8 rounded bg-surface-variant flex items-center justify-center border border-outline-variant">
                <ClipboardList size={16} className="text-secondary" />
              </div>
              Latest Test Insights
            </h2>
            
            {results.length > 0 ? (
              <div className="grid grid-cols-1 gap-8">
                {results.map((result) => (
                  <TestResultCard key={result.id} data={result} />
                ))}
              </div>
            ) : (
              <div className="p-16 text-center bg-surface border border-dashed border-outline-variant rounded-2xl flex flex-col items-center">
                 <ClipboardList size={32} className="text-outline mb-4 opacity-50" />
                 <p className="text-sm text-secondary">No test results reported. Broadcast your missions to proceed.</p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Mission Management (4 cols) */}
        <div className="lg:col-span-4 space-y-12">
          <section className="sticky top-8">
            <AddMissionForm projectId={projectId} />
            
            <div className="mt-12">
              <h3 className="text-xs font-semibold text-secondary mb-6 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-on-surface opacity-50" />
                Active Missions
              </h3>
              <div className="space-y-4">
                {missions.length > 0 ? missions.map((m) => (
                  <Link 
                    key={m.id} 
                    href={`/dashboard/${projectId}/mission/${m.id}`}
                    className={`block p-4 rounded-xl border border-outline-variant hover:border-outline transition-colors ${
                      m.is_active === false ? 'bg-surface-variant/30 opacity-70' : 'bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                       <p className="text-sm font-medium text-on-surface line-clamp-1">{m.title}</p>
                       {m.is_active === false && (
                         <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider text-error bg-error-container/20 border border-error/20 rounded uppercase flex items-center gap-1 shrink-0">
                           <PowerOff size={10} /> Inactive
                         </span>
                       )}
                    </div>
                    <p className="text-xs text-secondary line-clamp-2 mt-2 leading-relaxed">{m.task_description}</p>
                  </Link>
                )) : (
                  <p className="text-xs text-outline italic">No missions defined.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}