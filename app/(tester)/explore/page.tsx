import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Telescope, ArrowRight, Compass } from "lucide-react";

export default async function ExploreMissions() {
  const supabase = await createClient();

  const { data: missions } = await supabase
    .from("missions")
    .select(`
      *,
      projects (
        name,
        description
      )
    `)
    .neq("is_active", false)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto p-8 lg:p-16">
      <header className="mb-16 border-b border-outline-variant/30 pb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-surface-variant rounded-xl flex items-center justify-center border border-outline-variant">
            <Telescope className="text-secondary" size={24} />
          </div>
          <h1 className="text-5xl lg:text-6xl text-on-surface font-medium tracking-tight">Explore Missions</h1>
        </div>
        <p className="text-base text-secondary max-w-2xl leading-relaxed">
          Help developers build better apps. Pick a mission, test the flow, and get hands-on experience in real-world scenarios.
        </p>
      </header>

      {/* The Mission Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {missions?.map((mission: any) => (
          <Link 
            key={mission.id}
            href={`/mission/${mission.id}`}
            className="group bg-surface rounded-2xl p-8 border border-outline-variant hover:border-outline hover:shadow-m3-1 transition-all flex flex-col"
          >
            <div className="flex justify-between items-start mb-8">
              <span className="px-3 py-1 bg-surface-variant border border-outline-variant text-on-surface text-xs font-semibold rounded uppercase tracking-wider">
                {mission.projects?.name}
              </span>
              <span className="text-xs text-secondary font-medium">
                {new Date(mission.created_at).toLocaleDateString()}
              </span>
            </div>

            <h3 className="text-2xl text-on-surface font-medium mb-4 tracking-tight group-hover:text-primary transition-colors">
              {mission.title}
            </h3>
            
            <p className="text-sm text-secondary leading-relaxed line-clamp-2">
              {mission.task_description}
            </p>

            <div className="mt-8 pt-6 border-t border-outline-variant/50 flex items-center justify-between">
              <span className="text-sm font-medium text-secondary group-hover:text-on-surface transition-colors">Begin Testing</span>
              <div className="w-8 h-8 rounded bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:bg-on-surface group-hover:text-surface transition-colors">
                <ArrowRight size={16} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {(!missions || missions.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 px-8 mt-8 bg-surface border border-dashed border-outline-variant rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-surface-variant rounded-2xl flex items-center justify-center mb-8 border border-outline-variant">
            <Compass className="text-secondary w-8 h-8 opacity-60" />
          </div>
          <h2 className="text-3xl text-on-surface font-medium mb-4 tracking-tight">No Active Missions</h2>
          <p className="text-sm text-secondary max-w-md mx-auto leading-relaxed">
            No missions are currently available. Check back soon for structured opportunities to test and explore!
          </p>
        </div>
      )}
    </div>
  );
}