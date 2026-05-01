import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import TesterSubmissionForm from "@/components/TesterSubmissionForm";
import { CheckCircle2, Info, ShieldAlert, ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getOwnerId } from "@/lib/utils/project";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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
        className="inline-flex items-center gap-2 text-ash hover:text-chalk transition-colors mb-8 group"
      >
        <div className="w-8 h-8 rounded bg-iron flex items-center justify-center border border-transparent group-hover:bg-chalk group-hover:text-obsidian transition-colors">
          <ArrowLeft size={16} />
        </div>
        <span className="font-mono text-sm font-medium">Back to Explore</span>
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* Left Side: Instructions */}
        <section>
          <header className="mb-8">
            <Badge variant="role-tester">
              Mission Details
            </Badge>
            <h1 className="font-syne text-4xl font-bold text-chalk mt-4 leading-tight">{mission.title}</h1>
            <p className="font-mono text-base text-ash mt-2">
              for {Array.isArray(projectData) ? projectData[0]?.name : projectData?.name}
            </p>
            <Button variant="secondary" className="mt-6 gap-2" asChild>
              <a 
                href={Array.isArray(projectData) ? projectData[0]?.app_url : projectData?.app_url} 
                target="_blank"
              >
                Launch Application
                <ExternalLink size={16} />
              </a>
            </Button>
          </header>

          <div className="bg-iron/30 p-6 rounded-lg border border-iron relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 font-syne text-[100px] font-bold text-voltage opacity-5 select-none pointer-events-none leading-none">
              T1
            </div>
            <h3 className="flex items-center gap-2 font-syne text-lg font-bold text-chalk mb-4 relative z-10">
              <Info size={20} className="text-voltage" />
              Your Task
            </h3>
            <p className="font-mono text-sm text-ash leading-relaxed whitespace-pre-wrap relative z-10">
              {mission.task_description}
            </p>
          </div>

          <div className="bg-iron/30 p-6 rounded-lg border border-iron mt-6">
            <h3 className="flex items-center gap-2 font-syne text-lg font-bold text-chalk mb-4">
              <CheckCircle2 size={20} className="text-voltage" />
              Submission Guidelines
            </h3>
            <p className="font-mono text-sm text-ash leading-relaxed whitespace-pre-wrap">
              - Provide clear screenshots (not more than <strong>5MB</strong>) that demonstrates the issue or task completion.<br />
              - Ensure your evidence is relevant and directly related to the mission's task description.<br />
            </p>
          </div>
        </section>

        {/* Right Side: Conditional Submission Form */}
        <section className="bg-obsidian border border-iron rounded-lg p-8 shadow-sm">
          {isOwner ? (
            <div className="flex flex-col items-center text-center p-6 bg-iron/50 rounded-lg text-chalk">
              <ShieldAlert size={48} className="mb-4 text-ash" />
              <h2 className="font-syne text-xl font-bold">Project Owner View</h2>
              <p className="font-mono text-sm mt-3 text-ash">
                You created this project. To ensure high-quality, unbiased feedback, 
                developers cannot submit test results for their own missions.
              </p>
              <Link 
                href="/dashboard" 
                className="mt-6 font-mono text-sm underline hover:text-voltage transition-colors"
              >
                Go to Dashboard to view results
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-syne text-xl font-bold text-chalk mb-6">Submit Evidence</h2>
              <TesterSubmissionForm missionId={mission.id} />
            </>
          )}
        </section>

      </div>
    </div>
  );
}