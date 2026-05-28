import Link from "next/link"
import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  ChevronRight, ShieldCheck, CheckCircle2, PauseCircle, Flag, ExternalLink, User,
} from "lucide-react"
import {
  SubmissionsList,
  normalizeSentiment,
  type SubmissionRow,
} from "@/components/admin/SubmissionsList"

export const metadata = { title: "Mission — Admin · Twnhall" }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default async function AdminMissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: mission } = await admin
    .from("missions")
    .select("id, title, task_description, created_at, is_active, project_id")
    .eq("id", id)
    .maybeSingle()

  if (!mission) notFound()

  const { data: project } = await admin
    .from("projects")
    .select("id, name, description, app_url, owner_id, created_at, flagged_at, flag_reason")
    .eq("id", mission.project_id)
    .maybeSingle()

  const { data: ownerProfile } = project?.owner_id
    ? await admin
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", project.owner_id)
        .maybeSingle()
    : { data: null }

  const { data: testResults } = await admin
    .from("test_results")
    .select("id, mission_id, tester_id, screenshot_url, tester_comment, ai_summary, ai_sentiment, created_at")
    .eq("mission_id", mission.id)
    .order("created_at", { ascending: false })

  const testerIds = Array.from(new Set((testResults ?? []).map((r: any) => r.tester_id).filter(Boolean)))
  const { data: testers } = testerIds.length > 0
    ? await admin
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", testerIds)
    : { data: [] }

  const testerById = new Map(
    (testers ?? []).map((p: any) => [
      p.id,
      {
        fullName: (p.full_name as string) ?? "",
        email: (p.email as string) ?? "",
        avatarUrl: (p.avatar_url as string | null) ?? null,
      },
    ]),
  )

  const submissions: SubmissionRow[] = (testResults ?? []).map((r: any) => ({
    id: r.id,
    createdAt: r.created_at,
    testerComment: r.tester_comment ?? "",
    aiSummary: r.ai_summary ?? null,
    aiSentiment: normalizeSentiment(r.ai_sentiment),
    screenshotUrl: r.screenshot_url ?? null,
    mission: { id: mission.id, title: mission.title },
    project: project ? { id: project.id, name: project.name } : null,
    tester: testerById.get(r.tester_id) ?? { fullName: "", email: "", avatarUrl: null },
  }))

  const statusActive = !!mission.is_active && !project?.flagged_at
  const statusLabel = project?.flagged_at
    ? "project flagged"
    : mission.is_active
      ? "active"
      : "inactive"
  const statusStyle = project?.flagged_at
    ? { bg: "rgba(255,79,79,0.10)", color: "#FF4F4F", border: "1px solid rgba(255,79,79,0.4)", Icon: Flag }
    : statusActive
      ? { bg: "rgba(122,225,138,0.10)", color: "#7AE18A", border: "1px solid rgba(122,225,138,0.4)", Icon: CheckCircle2 }
      : { bg: "rgba(124,124,138,0.10)", color: "#7C7C8A", border: "1px solid rgba(124,124,138,0.4)", Icon: PauseCircle }
  const StatusIcon = statusStyle.Icon

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      {/* Header strip */}
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-voltage" />
        <p className="font-mono text-[11px] font-medium text-voltage uppercase tracking-[1px]">
          Admin · Mission
        </p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[13px] text-ash mb-6">
        <Link href="/admin/missions" className="hover:text-chalk transition-colors duration-150">
          Missions
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-iron shrink-0" />
        <span className="text-chalk truncate max-w-[480px]">{mission.title}</span>
      </div>

      {/* Title + status */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <h1 className="font-syne font-bold text-[32px] leading-[36px] tracking-[-0.5px] text-chalk break-words max-w-3xl">
          {mission.title}
        </h1>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.5px] rounded px-2.5 py-1 shrink-0"
          style={{ background: statusStyle.bg, color: statusStyle.color, border: statusStyle.border }}
        >
          <StatusIcon className="w-3 h-3" />
          {statusLabel}
        </span>
      </div>

      <p className="font-mono text-[13px] text-ash mb-8">
        Created {formatDate(mission.created_at)}
      </p>

      {/* Project flag warning */}
      {project?.flagged_at && (
        <div
          className="rounded-[12px] p-4 mb-6 flex items-start gap-3"
          style={{ background: "rgba(255,79,79,0.06)", border: "1px solid rgba(255,79,79,0.3)" }}
        >
          <Flag className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#FF4F4F" }} />
          <div className="min-w-0">
            <p className="font-syne font-bold text-[14px]" style={{ color: "#FF4F4F" }}>
              Parent project is flagged
            </p>
            {project.flag_reason && (
              <p className="font-mono text-[13px] text-ash leading-5 mt-1 whitespace-pre-wrap">
                {project.flag_reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Task description */}
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[1px] text-voltage mb-3">Task</p>
        <div
          className="rounded-[12px] p-5"
          style={{
            background: "rgba(232,255,71,0.04)",
            borderLeft: "3px solid #E8FF47",
            borderRadius: "0 12px 12px 0",
          }}
        >
          <p className="font-mono text-[15px] text-chalk leading-6 whitespace-pre-wrap">
            {mission.task_description || <span className="text-ash italic">No task description.</span>}
          </p>
        </div>
      </div>

      {/* Project context card */}
      <div className="bg-graphite border border-iron rounded-[12px] p-5 mb-10" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <p className="font-mono text-[11px] uppercase tracking-[1px] text-ash mb-3">Project</p>
        {project ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <Link
                href="/admin/projects"
                className="font-syne font-bold text-[18px] text-chalk hover:text-voltage transition-colors duration-150"
              >
                {project.name}
              </Link>
              {project.app_url && (
                <a
                  href={project.app_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[13px] text-sky hover:underline inline-flex items-center gap-1.5"
                >
                  {project.app_url.replace(/^https?:\/\//, "")}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {project.description && (
              <p className="font-mono text-[13px] text-ash leading-5">{project.description}</p>
            )}
            {ownerProfile && (
              <div className="flex items-center gap-2 pt-2 border-t border-iron/60">
                <User className="w-3.5 h-3.5 text-ash" />
                <span className="font-mono text-[13px] text-chalk">
                  {ownerProfile.full_name || ownerProfile.email}
                </span>
                {ownerProfile.full_name && (
                  <span className="font-mono text-[12px] text-ash">· {ownerProfile.email}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="font-mono text-[13px] text-ember">Project missing.</p>
        )}
      </div>

      {/* Submissions */}
      <div className="bg-graphite border border-iron rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-iron flex items-center justify-between">
          <h2 className="font-syne font-bold text-[16px] text-chalk">Submissions</h2>
          <span className="font-mono text-[12px] text-ash">{submissions.length} total</span>
        </div>
        <SubmissionsList
          submissions={submissions}
          showContext={false}
          emptyMessage="No test results for this mission yet."
        />
      </div>
    </div>
  )
}
