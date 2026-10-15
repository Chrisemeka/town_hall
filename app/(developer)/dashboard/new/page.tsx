import CreateProjectForm from "@/components/CreateProjectForm";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "New Project — Twnhall",
};

export default async function NewProjectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/explore");

  return (
    <div className="max-w-[640px] mx-auto px-4 medium:px-6 pt-16 pb-6 medium:pt-20 medium:pb-10 expanded:py-10">

      {/* Below 600px a 48px back link; from 600px the trail. */}
      <Link href="/dashboard" className="medium:hidden inline-flex items-center gap-1 min-h-12 -ml-2 px-2 mb-4 font-mono text-[14px] text-ink-muted hover:text-ink transition-colors duration-150">
        <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
        My Projects
      </Link>
      <div className="hidden medium:flex items-center gap-1.5 font-mono text-[13px] text-ink-muted mb-8">
        <Link href="/dashboard" className="hover:text-ink transition-colors duration-150">
          My Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
        <span className="text-ink">New Project</span>
      </div>

      <CreateProjectForm />

    </div>
  );
}
