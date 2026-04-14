import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Layout, ArrowRight, Home } from "lucide-react";

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
      <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-16 border-b border-outline-variant/30 pb-8 gap-6">
        <div>
          <h1 className="text-5xl font-medium text-on-surface tracking-tight mb-4">My Projects</h1>
          <p className="text-base text-secondary max-w-xl leading-relaxed">Systematic quality assurance. Manage your active environments and create new testing missions.</p>
        </div>
        
        {/* Create Project Button */}
        <Link 
          href="/dashboard/new"
          className="h-12 px-6 bg-on-surface text-surface rounded-full flex items-center gap-2 hover:bg-white/90 shadow-sm transition-all font-medium text-sm whitespace-nowrap"
        >
          <Plus size={18} />
          New Project
        </Link>
      </header>

      {/* 3. The Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <Link 
              key={project.id} 
              href={`/dashboard/${project.id}`}
              className="group bg-surface rounded-2xl p-8 border border-outline-variant hover:border-outline hover:shadow-m3-1 transition-all flex flex-col min-h-[240px]"
            >
              <div className="flex-1">
                <div className="w-12 h-12 bg-surface-variant rounded-xl flex items-center justify-center mb-6 border border-outline-variant">
                  <Layout className="text-secondary" size={20} />
                </div>
                <h3 className="text-xl font-medium text-on-surface tracking-tight mb-3">{project.name}</h3>
                <p className="text-sm text-secondary leading-relaxed line-clamp-2">
                  {project.description || "No description provided."}
                </p>
              </div>
              
              <div className="mt-8 pt-6 border-t border-outline-variant/50 flex items-center justify-between">
                <span className="text-sm font-medium text-secondary group-hover:text-on-surface transition-colors">Access Environment</span>
                <div className="w-8 h-8 rounded bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:bg-on-surface group-hover:text-surface transition-colors">
                  <ArrowRight size={16} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-surface border border-dashed border-outline-variant rounded-2xl p-16 py-32 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="w-16 h-16 bg-surface-variant rounded-2xl flex items-center justify-center mb-8 border border-outline-variant">
            <Layout className="text-secondary w-8 h-8 opacity-60" />
          </div>
          <h2 className="text-3xl text-on-surface font-medium mb-4 tracking-tight">No projects created</h2>
          <p className="text-sm text-secondary max-w-md mx-auto mb-8 leading-relaxed">
            Start your first project container to begin the QA process.
          </p>
          <Link 
            href="/dashboard/new"
            className="h-12 px-6 bg-on-surface text-surface rounded-full flex items-center gap-2 hover:bg-white/90 shadow-sm transition-all font-medium text-sm"
          >
            <Plus size={18} />
            New Project
          </Link>
        </div>
      )}
    </div>
  );
}