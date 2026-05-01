import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, Compass, ExternalLink, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default async function ExploreMissions() {
  const supabase = await createClient();

  const { data: missions } = await supabase
    .from("missions")
    .select(`
      *,
      projects (
        name,
        description,
        app_url
      )
    `)
    .neq("is_active", false)
    .order("created_at", { ascending: false });

  // Helper to get relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return "today";
    if (diffInDays === 1) return "1d ago";
    return `${diffInDays}d ago`;
  };

  return (
    <div className="max-w-6xl mx-auto p-8 lg:p-12">
      <header className="mb-8">
        <h1 className="font-syne text-4xl lg:text-5xl text-chalk font-bold tracking-tight mb-4">Explore Projects</h1>
        <p className="font-mono text-sm text-ash max-w-2xl leading-relaxed">
          Help developers build better apps. Pick a mission, test the flow, and get hands-on experience in real-world scenarios.
        </p>
      </header>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button className="px-5 py-2 rounded-full border border-voltage/50 text-voltage text-xs font-mono bg-voltage/10 transition-colors">
            All
          </button>
          <button className="px-5 py-2 rounded-full border border-[#27272A] text-[#A1A1AA] hover:text-white hover:border-[#3F3F46] text-xs font-mono transition-colors bg-[#18181B]/50">
            Recently Added
          </button>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" size={16} />
          <input 
            type="text" 
            placeholder="Search projects..." 
            className="w-full h-10 pl-10 pr-4 bg-[#18181B] border border-[#27272A] rounded-lg text-sm font-mono text-chalk placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#3F3F46] transition-colors"
          />
        </div>
      </div>

      {/* The Mission Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {missions?.map((mission: any) => (
          <Link 
            key={mission.id}
            href={`/mission/${mission.id}`}
            className="group block"
          >
            <Card interactive className="h-full flex flex-col p-6 bg-[#18181B] border-[#27272A] hover:border-[#3F3F46] rounded-xl transition-all">
              
              <div className="mb-4">
                <h3 className="font-syne text-2xl font-bold text-white mb-1.5 tracking-tight">
                  {mission.projects?.name || mission.title}
                </h3>
                <div className="font-mono text-[13px] text-[#A1A1AA]">
                  by @{mission.projects?.name?.toLowerCase().replace(/\s+/g, '') || 'townhall'} <span className="mx-1.5">·</span> {getRelativeTime(mission.created_at)}
                </div>
              </div>

              <p className="font-mono text-[15px] leading-[1.6] text-[#D4D4D8] mb-5 line-clamp-3 flex-1">
                {mission.task_description || mission.projects?.description}
              </p>

              {mission.projects?.app_url && (
                <div className="mb-5">
                  <span className="inline-flex items-center gap-2 font-mono text-[14px] text-[#38BDF8] hover:underline cursor-pointer">
                    <ExternalLink size={14} />
                    {mission.projects.app_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </span>
                </div>
              )}

              <div className="border-t border-[#27272A] pt-4 mt-auto flex items-center justify-between font-mono text-[12px] uppercase tracking-wider text-[#A1A1AA]">
                <div>
                  1 MISSION <span className="mx-1.5">·</span> 0 FEEDBACKS
                </div>
                <div className="flex items-center gap-1 group-hover:text-white transition-colors font-medium">
                  Test it <ArrowRight size={14} className="ml-0.5" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {(!missions || missions.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 px-8 mt-8 bg-obsidian border border-dashed border-iron rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-iron rounded-2xl flex items-center justify-center mb-8 border border-transparent">
            <Compass className="text-ash w-8 h-8 opacity-60" />
          </div>
          <h2 className="font-syne text-3xl text-chalk font-bold mb-4 tracking-tight">No Active Missions</h2>
          <p className="font-mono text-sm text-ash max-w-md mx-auto leading-relaxed">
            No missions are currently available. Check back soon for structured opportunities to test and explore!
          </p>
        </div>
      )}
    </div>
  );
}