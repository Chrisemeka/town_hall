import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { FeedbackListPaged, type FeedbackEntry } from "@/components/FeedbackListPaged";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Feedback Received — Townhall" };

export default async function FeedbackReceivedPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/explore");

  /* 1 — user's projects */
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("owner_id", user.id);

  const projectIds = (projects ?? []).map((p) => p.id);
  const projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]));

  /* 2 — missions belonging to those projects */
  const { data: missions } =
    projectIds.length > 0
      ? await supabase
          .from("missions")
          .select("id, title, project_id")
          .in("project_id", projectIds)
      : { data: [] as any[] };

  const missionIds = (missions ?? []).map((m: any) => m.id);
  const missionMeta: Record<string, { title: string; projectId: string; projectName: string }> =
    Object.fromEntries(
      (missions ?? []).map((m: any) => [
        m.id,
        {
          title:       m.title,
          projectId:   m.project_id,
          projectName: projectMap[m.project_id] ?? "Unknown Project",
        },
      ]),
    );

  /* 3 — all test_results, flat list ordered asc (so Developer #01 = first tester) */
  const { data: rawResults } =
    missionIds.length > 0
      ? await supabase
          .from("test_results")
          .select("id, tester_comment, screenshot_url, created_at, mission_id")
          .in("mission_id", missionIds)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

  /* flatten into FeedbackEntry[] with mission context attached */
  const items: FeedbackEntry[] = (rawResults ?? [])
    .filter((r: any) => missionMeta[r.mission_id])
    .map((r: any) => ({
      id:            r.id,
      missionId:     r.mission_id,
      missionTitle:  missionMeta[r.mission_id].title,
      projectId:     missionMeta[r.mission_id].projectId,
      projectName:   missionMeta[r.mission_id].projectName,
      tester_comment: r.tester_comment,
      screenshot_url: r.screenshot_url,
      created_at:    r.created_at,
    }));

  /* sort by most recent first for display (newest feedback first) */
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="max-w-[800px] mx-auto px-8 py-10">

      <div className="mb-8">
        <h1 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-chalk">
          Feedback Received
        </h1>
        <p className="font-mono text-[14px] text-ash mt-1">
          All feedback from your active missions.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-iron rounded-[12px] text-center px-6">
          <MessageSquare className="w-12 h-12 text-ash mb-4 opacity-40" />
          <h3 className="font-syne font-bold text-[24px] text-chalk mb-2">No feedback yet.</h3>
          <p className="font-mono text-[14px] text-ash mb-6 max-w-[340px]">
            Share your project in the community to start receiving feedback.
          </p>
          <Button variant="ghost" asChild>
            <Link href="/explore">Explore Community</Link>
          </Button>
        </div>
      ) : (
        <FeedbackListPaged items={sorted} />
      )}

    </div>
  );
}
