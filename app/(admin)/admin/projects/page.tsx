import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  FolderOpen, ShieldCheck, CheckCircle2, AlertCircle, Flag, ExternalLink,
} from "lucide-react"
import { ProjectRowActions } from "@/components/admin/ProjectRowActions"

export const metadata = { title: "Projects — Admin · Townhall" }

type ProjectStatus = "active" | "needs-testers" | "draft" | "flagged"

type AdminProjectRow = {
  id: string
  name: string
  description: string | null
  app_url: string | null
  created_at: string
  flagged_at: string | null
  flag_reason: string | null
  owner: { id: string; fullName: string; email: string }
  missionCount: number
  feedbackCount: number
  status: ProjectStatus
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function statusStyle(status: ProjectStatus) {
  switch (status) {
    case "active":         return { bg: "rgba(122,225,138,0.10)", color: "#7AE18A", border: "1px solid rgba(122,225,138,0.4)" }
    case "needs-testers":  return { bg: "rgba(232,255,71,0.10)",  color: "#E8FF47", border: "1px solid rgba(232,255,71,0.4)" }
    case "draft":          return { bg: "rgba(124,124,138,0.10)", color: "#7C7C8A", border: "1px solid rgba(124,124,138,0.4)" }
    case "flagged":        return { bg: "rgba(255,79,79,0.10)",   color: "#FF4F4F", border: "1px solid rgba(255,79,79,0.4)" }
  }
}

function deriveStatus(missionCount: number, feedbackCount: number, flaggedAt: string | null): ProjectStatus {
  if (flaggedAt) return "flagged"
  if (missionCount === 0) return "draft"
  if (feedbackCount === 0) return "needs-testers"
  return "active"
}

export default async function AdminProjectsPage() {
  const admin = createAdminClient()

  const [projectsRes, missionsRes, testResultsRes, profilesRes] = await Promise.all([
    admin
      .from("projects")
      .select("id, name, description, app_url, created_at, owner_id, flagged_at, flag_reason")
      .order("created_at", { ascending: false }),
    admin.from("missions").select("id, project_id"),
    admin.from("test_results").select("mission_id"),
    admin.from("profiles").select("id, full_name, email"),
  ])

  const profileById = new Map(
    (profilesRes.data ?? []).map((p: any) => [p.id, { fullName: p.full_name ?? "", email: p.email ?? "" }]),
  )

  const missionsByProject = new Map<string, string[]>()
  for (const m of (missionsRes.data ?? []) as { id: string; project_id: string }[]) {
    const arr = missionsByProject.get(m.project_id) ?? []
    arr.push(m.id)
    missionsByProject.set(m.project_id, arr)
  }

  const feedbackByMission = new Map<string, number>()
  for (const r of (testResultsRes.data ?? []) as { mission_id: string }[]) {
    feedbackByMission.set(r.mission_id, (feedbackByMission.get(r.mission_id) ?? 0) + 1)
  }

  const projects: AdminProjectRow[] = (projectsRes.data ?? []).map((p: any) => {
    const missionIds = missionsByProject.get(p.id) ?? []
    const missionCount = missionIds.length
    const feedbackCount = missionIds.reduce((sum, mid) => sum + (feedbackByMission.get(mid) ?? 0), 0)
    const ownerInfo = profileById.get(p.owner_id) ?? { fullName: "", email: "" }

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      app_url: p.app_url,
      created_at: p.created_at,
      flagged_at: p.flagged_at,
      flag_reason: p.flag_reason ?? null,
      owner: { id: p.owner_id, fullName: ownerInfo.fullName, email: ownerInfo.email },
      missionCount,
      feedbackCount,
      status: deriveStatus(missionCount, feedbackCount, p.flagged_at),
    }
  })

  const totalProjects = projects.length
  const activeCount = projects.filter((p) => p.status === "active").length
  const needsTestersCount = projects.filter((p) => p.status === "needs-testers").length
  const flaggedCount = projects.filter((p) => p.status === "flagged").length

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-voltage" />
        <p className="font-mono text-[11px] font-medium text-voltage uppercase tracking-[1px]">
          Admin · Projects
        </p>
      </div>
      <h1 className="font-syne font-bold text-[36px] leading-[40px] tracking-[-0.5px] text-chalk mb-1">
        Project Management
      </h1>
      <p className="font-mono text-[14px] text-ash mb-8">
        Review every submitted project. Flag inappropriate content to hide it from the community, or remove it permanently.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={FolderOpen}    label="Total Projects" value={totalProjects} />
        <KpiCard icon={CheckCircle2}  label="Active"         value={activeCount}    accent="#7AE18A" />
        <KpiCard icon={AlertCircle}   label="Needs Testers"  value={needsTestersCount} accent="#E8FF47" />
        <KpiCard icon={Flag}          label="Flagged"        value={flaggedCount}   accent="#FF4F4F" />
      </div>

      {/* Table */}
      <div className="bg-graphite border border-iron rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-iron flex items-center justify-between">
          <h2 className="font-syne font-bold text-[16px] text-chalk">All Projects</h2>
          <span className="font-mono text-[12px] text-ash">{totalProjects} total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-obsidian/40">
              <tr className="text-left font-mono text-[11px] uppercase tracking-[1px] text-ash">
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Missions</th>
                <th className="px-5 py-3 font-medium text-right">Feedback</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center font-mono text-[13px] text-ash">
                    No projects yet.
                  </td>
                </tr>
              )}
              {projects.map((p) => {
                const style = statusStyle(p.status)
                return (
                  <tr key={p.id} className="border-t border-iron/60 hover:bg-obsidian/30 transition-colors duration-150 align-top">
                    <td className="px-5 py-4 max-w-[280px]">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[13px] text-chalk truncate">{p.name}</span>
                          {p.app_url && (
                            <Link
                              href={p.app_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-ash hover:text-voltage transition-colors duration-150 shrink-0"
                              aria-label="Open project site"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        {p.description && (
                          <p className="font-mono text-[12px] text-ash line-clamp-2">{p.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-mono text-[13px] text-chalk truncate">
                          {p.owner.fullName || "—"}
                        </span>
                        <span className="font-mono text-[12px] text-ash truncate">
                          {p.owner.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-[220px]">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <span
                          className="inline-flex items-center w-fit font-mono text-[11px] uppercase tracking-[0.5px] rounded px-2 py-0.5"
                          style={{ background: style.bg, color: style.color, border: style.border }}
                        >
                          {p.status === "needs-testers" ? "needs testers" : p.status}
                        </span>
                        {p.status === "flagged" && p.flag_reason && (
                          <p
                            className="font-mono text-[11px] text-ember/90 leading-4 line-clamp-2"
                            title={p.flag_reason}
                          >
                            {p.flag_reason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-[13px] text-chalk text-right tabular-nums">
                      {p.missionCount}
                    </td>
                    <td className="px-5 py-4 font-mono text-[13px] text-chalk text-right tabular-nums">
                      {p.feedbackCount}
                    </td>
                    <td className="px-5 py-4 font-mono text-[13px] text-ash whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <ProjectRowActions projectId={p.id} isFlagged={!!p.flagged_at} />
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
