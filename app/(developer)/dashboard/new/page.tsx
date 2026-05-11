import CreateProjectForm from "@/components/CreateProjectForm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "New Project — Townhall",
};

export default async function NewProjectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/explore");

  return (
    <div className="max-w-[640px] mx-auto px-6 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ash mb-8">
        <Link href="/dashboard" className="hover:text-chalk transition-colors duration-150">
          My Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron" />
        <span className="text-chalk">New Project</span>
      </div>

      <CreateProjectForm />

    </div>
  );
}
