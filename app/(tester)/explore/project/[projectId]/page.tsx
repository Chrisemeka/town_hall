import { createClient } from "@/lib/supabase/server"
import { missionsForTester } from "@/lib/cohortDb"
import { notFound } from "next/navigation"
import type { MissionRow, ProjectRow } from "@/lib/types/db"

/** Exactly what the select below asks for. */
type ProjectWithMissions = Pick<
  ProjectRow,
  "id" | "name" | "description" | "app_url" | "flagged_at"
> & {
  missions: Pick<MissionRow, "id" | "title" | "is_active" | "created_at" | "category" | "device_target">[] | null
}
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { MissionChips } from "@/components/missions/TestCaseView"

export default async function ProjectMissionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, name, description, app_url, flagged_at,
      missions (id, title, is_active, created_at, category, device_target)
    `)
    .eq("id", projectId)
    .single()

  const row = project as ProjectWithMissions | null
  if (!row || row.flagged_at) notFound()

  const live = (row.missions ?? []).filter((m) => m.is_active !== false)
  // A paid cohort tester sees only missions the cohort may be paid for.
  const { data: { user } } = await supabase.auth.getUser()
  const shown = await missionsForTester(user?.id, live.map((m) => m.id))
  const missions = live.filter((m) => shown.has(m.id))
  const missionIds = missions.map((m) => m.id)
  const countByMission: Record<string, number> = {}
  if (missionIds.length > 0) {
    const { data: counts } = await supabase
      .from("mission_feedback_counts")
      .select("mission_id, count")
      .in("mission_id", missionIds)

    for (const c of counts ?? []) {
      countByMission[c.mission_id] = c.count
    }
  }

  return (
    <div className="max-w-[800px] mx-auto px-6 md:px-8 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-[13px] text-ink-muted mb-8">
        <Link href="/explore" className="hover:text-ink transition-colors duration-150">
          Explore
        </Link>
        <span>/</span>
        <span className="text-ink truncate">{row.name}</span>
      </div>

      {/* Project card */}
      <div
        id="tour-project-overview"
        className="bg-surface-raised border border-line rounded-[12px] p-6 mb-10"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
      >
        <h1 className="font-syne font-bold text-[28px] leading-[34px] text-ink mb-1">
          {row.name}
        </h1>
        {row.app_url && (
          <a
            href={row.app_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] text-info-ink hover:underline mb-3 block"
          >
            {row.app_url.replace(/^https?:\/\//, "")}
          </a>
        )}
        {row.description && (
          <p className="font-mono text-[14px] text-ink-muted leading-5 mt-2">
            {row.description}
          </p>
        )}
      </div>

      {/* Missions header */}
      <div id="tour-project-missions" className="mb-5">
        <h2 className="font-syne font-bold text-[20px] text-ink">Missions</h2>
        <p className="font-mono text-[13px] text-ink-muted mt-0.5">
          {missions.length} available to test
        </p>
      </div>

      {/* Mission list */}
      <div className="flex flex-col gap-4">
        {missions.map((mission, i) => {
          const num = (i + 1).toString().padStart(2, "0")
          const feedbackCount = countByMission[mission.id] ?? 0
          return (
            <div
              key={mission.id}
              className="relative overflow-hidden bg-surface-raised border border-line rounded-[12px] px-6 py-5 flex items-center justify-between gap-4 hover:border-accent-ink/30 transition-colors duration-150"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
            >
              <div className="flex-1 min-w-0 relative z-10">
                <span className="font-syne font-bold text-accent-ink text-[14px] leading-none">
                  {num}
                </span>
                <p className="font-syne font-bold text-[18px] text-ink leading-6 truncate mt-1">
                  {mission.title}
                </p>
                <MissionChips
                  category={mission.category}
                  deviceTarget={mission.device_target}
                  className="mt-2"
                />
                {feedbackCount > 0 && (
                  <p className="font-mono text-[12px] text-ink-muted mt-1">
                    {feedbackCount} feedback{feedbackCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              <Link
                href={`/mission/${mission.id}`}
                className="shrink-0 relative z-10 flex items-center gap-1.5 font-mono text-[13px] font-medium text-ink-muted hover:text-accent-ink transition-colors duration-150"
              >
                Start <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )
        })}
      </div>

    </div>
  )
}
