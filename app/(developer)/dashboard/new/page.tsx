import CreateProjectForm from "@/components/CreateProjectForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Create New Project | TownHall",
  description: "Register your application to start getting user feedback.",
};

export default async function NewProjectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/explore");
  }

  return (
    <div className="min-h-screen bg-surface py-16 px-8 flex justify-center">
      <div className="w-full max-w-2xl">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-secondary hover:text-on-surface transition-colors mb-12 group"
        >
          <div className="w-8 h-8 rounded bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:bg-on-surface group-hover:text-surface transition-colors">
            <ArrowLeft size={16} />
          </div>
          <span className="text-sm font-medium">Back to Grid</span>
        </Link>

        {/* Note: CreateProjectForm component will be refactored next for inner styling */}
        <CreateProjectForm />
        
        <p className="mt-8 text-center text-xs text-secondary max-w-md mx-auto leading-relaxed">
          Once initialized, you will define structural missions for the QA network to process.
        </p>
      </div>
    </div>
  );
}