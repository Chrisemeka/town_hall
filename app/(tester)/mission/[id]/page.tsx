import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import TesterSubmissionForm from "@/components/TesterSubmissionForm";
import { CheckCircle2, Info, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getOwnerId } from "@/lib/utils/project";

export default async function MissionDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const supabase = await createClient();
  const { id } = await params;

  // 1. Get the current user
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Fetch the mission and its project owner
  const { data: mission } = await supabase
    .from("missions")
    .select("*, projects(*)")
    .eq("id", id)
    .single();

  if (!mission) return notFound();

  // 3. Robust check for owner_id (handles Supabase object or array returns)
  const projectData = mission.projects as any;
  const projectOwnerId = getOwnerId(mission?.projects);
  const isOwner = user?.id === projectOwnerId;

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-12">
      <Link 
        href="/explore" 
        className="inline-flex items-center gap-2 text-secondary hover:text-on-surface transition-colors mb-8 group"
      >
        <div className="w-8 h-8 rounded bg-surface-variant flex items-center justify-center border border-outline-variant group-hover:bg-on-surface group-hover:text-surface transition-colors">
          <ArrowLeft size={16} />
        </div>
        <span className="text-sm font-medium">Back to Explore</span>
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* Left Side: Instructions */}
        <section>
          <header className="mb-8">
            <span className="text-label-medium text-primary bg-primary-container px-3 py-1 rounded-full">
              Mission Details
            </span>
            <h1 className="text-display-small text-on-surface mt-4">{mission.title}</h1>
            <p className="text-title-medium text-secondary mt-2">
              for {Array.isArray(projectData) ? projectData[0]?.name : projectData?.name}
            </p>
          </header>

          <div className="bg-surface-container-high p-6 rounded-m3-l border border-outline-variant">
            <h3 className="flex items-center gap-2 text-title-medium text-on-surface mb-4">
              <Info size={20} className="text-primary" />
              Your Task
            </h3>
            <p className="text-body-large text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {mission.task_description}
            </p>
          </div>
        </section>

        {/* Right Side: Conditional Submission Form */}
        <section className="bg-surface-container rounded-m3-xl p-8 shadow-m3-1">
          {isOwner ? (
            <div className="flex flex-col items-center text-center p-6 bg-secondary-container rounded-m3-m text-on-secondary-container">
              <ShieldAlert size={48} className="mb-4 text-secondary" />
              <h2 className="text-title-large">Project Owner View</h2>
              <p className="text-body-medium mt-3 opacity-90">
                You created this project. To ensure high-quality, unbiased feedback, 
                developers cannot submit test results for their own missions.
              </p>
              <a 
                href="/dashboard" 
                className="mt-6 text-label-large underline hover:text-primary transition-colors"
              >
                Go to Dashboard to view results
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-title-large text-on-surface mb-6">Submit Evidence</h2>
              <TesterSubmissionForm missionId={mission.id} />
            </>
          )}
        </section>

      </div>
    </div>
  );
}