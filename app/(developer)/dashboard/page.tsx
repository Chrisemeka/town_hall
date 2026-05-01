import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Layout, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default async function ProjectGallery() {
  const supabase = await createClient();
  
  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  // 2. Fetch projects owned by this user
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto p-8 lg:p-16">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-16 border-b border-iron/50 pb-8 gap-6">
        <div>
          <h1 className="text-5xl font-syne font-bold text-chalk tracking-tight mb-4">My Projects</h1>
          <p className="font-mono text-sm text-ash max-w-xl leading-relaxed">Systematic quality assurance. Manage your active environments and create new testing missions.</p>
        </div>
        
        {/* Create Project Button */}
        <Button variant="primary" asChild>
          <Link href="/dashboard/new" className="gap-2">
            <Plus size={18} />
            New Project
          </Link>
        </Button>
      </header>

      {/* 3. The Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <Link 
              key={project.id} 
              href={`/dashboard/${project.id}`}
              className="group block"
            >
              <Card interactive className="h-full flex flex-col justify-between p-6">
                <div className="flex-1">
                  <div className="w-12 h-12 bg-iron rounded-xl flex items-center justify-center mb-6 border border-iron">
                    <Layout className="text-ash" size={20} />
                  </div>
                  <h3 className="font-syne text-xl font-bold text-chalk tracking-tight mb-3">{project.name}</h3>
                  <p className="font-mono text-sm text-ash leading-relaxed line-clamp-2">
                    {project.description || "No description provided."}
                  </p>
                </div>
                
                <div className="mt-8 pt-6 border-t border-iron flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-ash group-hover:text-chalk transition-colors">Access Environment</span>
                  <div className="w-8 h-8 rounded bg-iron flex items-center justify-center border border-transparent group-hover:bg-chalk group-hover:text-obsidian transition-colors">
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-obsidian border border-dashed border-iron rounded-2xl p-16 py-32 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="w-16 h-16 bg-iron rounded-2xl flex items-center justify-center mb-8 border border-transparent">
            <Layout className="text-ash w-8 h-8 opacity-60" />
          </div>
          <h2 className="font-syne text-3xl text-chalk font-bold mb-4 tracking-tight">No projects created</h2>
          <p className="font-mono text-sm text-ash max-w-md mx-auto mb-8 leading-relaxed">
            Start your first project container to begin the QA process.
          </p>
          <Button variant="primary" asChild>
            <Link href="/dashboard/new" className="gap-2">
              <Plus size={18} />
              New Project
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}