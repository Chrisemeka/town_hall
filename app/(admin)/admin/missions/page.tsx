import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import { Target, ShieldCheck, CheckCircle2, PauseCircle, MessageSquare } from "lucide-react"

export const metadata = { title: "Missions — Admin · Townhall" }

type MissionStatus = "active" | "inactive"

type AdminMissionRow = {
  id: string
  title: string
  taskDescription: string | null
  isActive: boolean
  status: MissionStatus
  createdAt: string
  projectId: string
  projectName: string
  projectFlagged: boolean
  owner: { fullName: string; email: string }
  feedbackCount: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function statusStyle(status: MissionStatus, projectFlagged: boolean) {
  if (projectFlagged) return { bg: "rgba(255,79,79,0.10)", color: "#FF4F4F", border: "1px solid rgba(255,79,79,0.4)" }
  return status === "active"
    ? { bg: "rgba(122,225,138,0.10)", color: "#7AE18A", border: "1px solid rgba(122,225,138,0.4)" }
    : { bg: "rgba(124,124,138,0.10)", color: "#7C7C8A", border: "1px solid rgba(124,124,138,0.4)" }
}

export default async function AdminMissionsPage() {
  const admin = createAdminClient()

  const [missionsRes, projectsRes, profilesRes, testResultsRes] = await Promise.all([
    admin.from("missions").select("id, title, task_description, created_at, is_active, project_id").order("created_at", { ascending: false }),
    admin.from("projects").select("id, name, owner_id, flagged_at"),
    admin.from("profiles").select("id, full_name, email"),
    admin.from("test_results").select("mission_id"),
  ])

  const projectById = new Map(
    (projectsRes.data ?? []).map((p: any) => [
      p.id,
      { name: p.name, ownerId: p.owner_id, flagged: !!p.flagged_at },
    ]),
  )
  const profileById = new Map(
    (profilesRes.data ?? []).map((p: any) => [p.id, { fullName: p.full_name ?? "", email: p.email ?? "" }]),
  )

  const feedbackByMission = new Map<string, number>()
  for (const r of (testResultsRes.data ?? []) as { mission_id: string }[]) {
    feedbackByMission.set(r.mission_id, (feedbackByMission.get(r.mission_id) ?? 0) + 1)
  }

  const missions: AdminMissionRow[] = (missionsRes.data ?? []).map((m: any) => {
    const project = projectById.get(m.project_id) ?? { name: "—", ownerId: "", flagged: false }
    const owner = profileById.get(project.ownerId) ?? { fullName: "", email: "" }
    return {
      id: m.id,
      title: m.title,
      taskDescription: m.task_description,
      isActive: !!m.is_active,
      status: m.is_active ? "active" : "inactive",
      createdAt: m.created_at,
      projectId: m.project_id,
      projectName: project.name,
      projectFlagged: project.flagged,
      owner,
      feedbackCount: feedbackByMission.get(m.id) ?? 0,
    }
  })

  const totalMissions = missions.length
  const activeCount = missions.filter((m) => m.isActive && !m.projectFlagged).length
  const inactiveCount = missions.filter((m) => !m.isActive).length
  const withFeedbackCount = missions.filter((m) => m.feedbackCount > 0).length

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-voltage" />
        <p className="font-mono text-[11px] font-medium text-voltage uppercase tracking-[1px]">
          Admin · Missions
        </p>
      </div>
      <h1 className="font-syne font-bold text-[36px] leading-[40px] tracking-[-0.5px] text-chalk mb-1">
        Mission Activity
      </h1>
      <p className="font-mono text-[14px] text-ash mb-8">
        Every mission across the platform — drafts, active testing, and finished.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={Target}        label="Total Missions" value={totalMissions} />
        <KpiCard icon={CheckCircle2}  label="Active"         value={activeCount}        accent="#7AE18A" />
        <KpiCard icon={PauseCircle}   label="Inactive"       value={inactiveCount}      accent="#7C7C8A" />
        <KpiCard icon={MessageSquare} label="With Feedback"  value={withFeedbackCount}  accent="#E8FF47" />
      </div>

      {/* Table */}
      <div className="bg-graphite border border-iron rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-iron flex items-center justify-between">
          <h2 className="font-syne font-bold text-[16px] text-chalk">All Missions</h2>
          <span className="font-mono text-[12px] text-ash">{totalMissions} total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-obsidian/40">
              <tr className="text-left font-mono text-[11px] uppercase tracking-[1px] text-ash">
                <th className="px-5 py-3 font-medium">Mission</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Feedback</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {missions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-mono text-[13px] text-ash">
                    No missions yet.
                  </td>
                </tr>
              )}
              {missions.map((m) => {
                const style = statusStyle(m.status, m.projectFlagged)
                const label = m.projectFlagged ? "project flagged" : m.status
                return (
                  <tr key={m.id} className="border-t border-iron/60 hover:bg-obsidian/30 transition-colors duration-150 align-top">
                    <td className="px-5 py-4 max-w-[280px]">
                      <div className="flex flex-col gap-1 min-w-0">
                        <Link
                          href={`/admin/missions/${m.id}`}
                          className="font-mono text-[13px] text-chalk hover:text-voltage transition-colors duration-150 truncate"
                          title={m.title}
                        >
                          {m.title}
                        </Link>
                        {m.taskDescription && (
                          <p className="font-mono text-[12px] text-ash line-clamp-2">{m.taskDescription}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/projects`}
                        className="font-mono text-[13px] text-chalk hover:text-voltage transition-colors duration-150 truncate"
                      >
                        {m.projectName}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-mono text-[13px] text-chalk truncate">
                          {m.owner.fullName || "—"}
                        </span>
                        <span className="font-mono text-[12px] text-ash truncate">
                          {m.owner.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center font-mono text-[11px] uppercase tracking-[0.5px] rounded px-2 py-0.5"
                        style={{ background: style.bg, color: style.color, border: style.border }}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[13px] text-chalk text-right tabular-nums">
                      {m.feedbackCount}
                    </td>
                    <td className="px-5 py-4 font-mono text-[13px] text-ash whitespace-nowrap">
                      {formatDate(m.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: number
  accent?: string
}) {
  return (
    <div className="bg-graphite border border-iron rounded-[12px] p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "#E8FF47" }} />
        <p className="font-mono text-[11px] uppercase tracking-[1px] text-ash">{label}</p>
      </div>
      <p className="font-syne font-bold text-[28px] leading-none text-chalk tabular-nums">{value}</p>
    </div>
  )
}
