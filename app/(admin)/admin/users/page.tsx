import { createAdminClient } from "@/lib/supabase/admin"
import {
  Users, UserPlus, FolderOpen, MessageSquare, ShieldCheck, PauseCircle, Ban,
} from "lucide-react"
import { SignupsChart, type SignupPoint } from "@/components/admin/SignupsChart"
import { RoleDistributionChart, type RoleSlice } from "@/components/admin/RoleDistributionChart"
import { UserRowActions, type ModerationStatus } from "@/components/admin/UserRowActions"

export const metadata = { title: "Users — Admin · Townhall" }

type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
  role: string | null
  moderation_status: string | null
  ban_reason: string | null
  banned_at: string | null
}

type AdminUserRow = {
  id: string
  fullName: string
  email: string
  role: string
  avatarUrl: string | null
  createdAt: string
  projectsSubmitted: number
  missionsCompleted: number
  moderationStatus: ModerationStatus
  banReason: string | null
  bannedAt: string | null
  bannedUntil: string | null
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function initials(name: string, email: string) {
  const source = name || email
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("")
}

function roleBadgeStyle(role: string) {
  switch (role) {
    case "admin":     return { background: "rgba(232,255,71,0.12)", color: "#E8FF47", border: "1px solid rgba(232,255,71,0.4)" }
    case "developer": return { background: "rgba(122,184,255,0.12)", color: "#7AB8FF", border: "1px solid rgba(122,184,255,0.4)" }
    case "tester":    return { background: "rgba(255,143,163,0.12)", color: "#FF8FA3", border: "1px solid rgba(255,143,163,0.4)" }
    default:          return { background: "rgba(124,124,138,0.12)", color: "#7C7C8A", border: "1px solid rgba(124,124,138,0.4)" }
  }
}

function normalizeStatus(s: string | null): ModerationStatus {
  if (s === "suspended" || s === "banned") return s
  return "active"
}

async function fetchAllAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  const all: {
    id: string
    email: string | undefined
    created_at: string
    banned_until: string | null
  }[] = []
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const batch = data.users.map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      banned_until: u.banned_until ?? null,
    }))
    all.push(...batch)
    if (batch.length < perPage) break
    page += 1
    if (page > 50) break
  }
  return all
}

export default async function AdminUsersPage() {
  const admin = createAdminClient()

  const [authUsers, profilesRes, projectsRes, testResultsRes] = await Promise.all([
    fetchAllAuthUsers(admin),
    admin.from("profiles").select("id, full_name, avatar_url, email, role, moderation_status, ban_reason, banned_at"),
    admin.from("projects").select("owner_id"),
    admin.from("test_results").select("tester_id"),
  ])

  const profiles = (profilesRes.data ?? []) as ProfileRow[]
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  const projectCounts = new Map<string, number>()
  for (const row of projectsRes.data ?? []) {
    const id = (row as any).owner_id as string | null
    if (!id) continue
    projectCounts.set(id, (projectCounts.get(id) ?? 0) + 1)
  }

  const missionCounts = new Map<string, number>()
  for (const row of testResultsRes.data ?? []) {
    const id = (row as any).tester_id as string | null
    if (!id) continue
    missionCounts.set(id, (missionCounts.get(id) ?? 0) + 1)
  }

  const users: AdminUserRow[] = authUsers
    .map((u) => {
      const profile = profileById.get(u.id)
      return {
        id: u.id,
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? u.email ?? "",
        role: profile?.role ?? "unknown",
        avatarUrl: profile?.avatar_url ?? null,
        createdAt: u.created_at,
        projectsSubmitted: projectCounts.get(u.id) ?? 0,
        missionsCompleted: missionCounts.get(u.id) ?? 0,
        moderationStatus: normalizeStatus(profile?.moderation_status ?? null),
        banReason: profile?.ban_reason ?? null,
        bannedAt: profile?.banned_at ?? null,
        bannedUntil: u.banned_until,
      }
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

  const now = Date.now()
  const thirtyDaysAgo = now - 30 * ONE_DAY_MS
  const newUsers30d = users.filter((u) => +new Date(u.createdAt) >= thirtyDaysAgo).length
  const suspendedCount = users.filter((u) => u.moderationStatus === "suspended").length
  const bannedCount = users.filter((u) => u.moderationStatus === "banned").length
  const totalProjects = projectsRes.data?.length ?? 0
  const totalMissionsCompleted = testResultsRes.data?.length ?? 0

  const signupsByDay: SignupPoint[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * ONE_DAY_MS)
    return { date: d.toISOString().slice(0, 10), count: 0 }
  })
  const dayIndex = new Map(signupsByDay.map((p, i) => [p.date, i]))
  for (const u of users) {
    const key = u.createdAt.slice(0, 10)
    const idx = dayIndex.get(key)
    if (idx !== undefined) signupsByDay[idx].count += 1
  }

  const roleCount = new Map<string, number>()
  for (const u of users) roleCount.set(u.role, (roleCount.get(u.role) ?? 0) + 1)
  const roleDistribution: RoleSlice[] = Array.from(roleCount.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-voltage" />
        <p className="font-mono text-[11px] font-medium text-voltage uppercase tracking-[1px]">
          Admin · Users
        </p>
      </div>
      <h1 className="font-syne font-bold text-[36px] leading-[40px] tracking-[-0.5px] text-chalk mb-1">
        User Management
      </h1>
      <p className="font-mono text-[14px] text-ash mb-8">
        Every account, with signups, projects submitted, and missions completed. Suspend or ban users who violate policies.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <KpiCard icon={Users}         label="Total Users"     value={users.length} />
        <KpiCard icon={UserPlus}      label="New · 30 days"   value={newUsers30d} />
        <KpiCard icon={PauseCircle}   label="Suspended"       value={suspendedCount} accent={suspendedCount > 0 ? "#FF8F47" : "#7C7C8A"} />
        <KpiCard icon={Ban}           label="Banned"          value={bannedCount}    accent={bannedCount > 0 ? "#FF4F4F" : "#7C7C8A"} />
        <KpiCard icon={FolderOpen}    label="Total Projects"  value={totalProjects} />
        <KpiCard icon={MessageSquare} label="Missions Done"   value={totalMissionsCompleted} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <SignupsChart data={signupsByDay} />
        <RoleDistributionChart data={roleDistribution} />
      </div>

      {/* Users table */}
      <div className="bg-graphite border border-iron rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-iron flex items-center justify-between">
          <h2 className="font-syne font-bold text-[16px] text-chalk">All Users</h2>
          <span className="font-mono text-[12px] text-ash">{users.length} total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-obsidian/40">
              <tr className="text-left font-mono text-[11px] uppercase tracking-[1px] text-ash">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Role / Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium text-right">Projects</th>
                <th className="px-5 py-3 font-medium text-right">Missions</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-mono text-[13px] text-ash">
                    No users yet.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-iron/60 hover:bg-obsidian/30 transition-colors duration-150 align-top">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-obsidian border border-iron flex items-center justify-center overflow-hidden shrink-0">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt={u.fullName || u.email} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-mono text-[12px] text-ash">{initials(u.fullName, u.email)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-[13px] text-chalk truncate">
                          {u.fullName || u.email || "—"}
                        </p>
                        {u.fullName && (
                          <p className="font-mono text-[12px] text-ash truncate">{u.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span
                        className="inline-flex items-center font-mono text-[11px] uppercase tracking-[0.5px] rounded px-2 py-0.5"
                        style={roleBadgeStyle(u.role)}
                      >
                        {u.role}
                      </span>
                      {u.moderationStatus !== "active" && (
                        <ModerationBadge
                          status={u.moderationStatus}
                          bannedUntil={u.bannedUntil}
                          reason={u.banReason}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-[13px] text-ash whitespace-nowrap">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-5 py-4 font-mono text-[13px] text-chalk text-right tabular-nums">
                    {u.projectsSubmitted}
                  </td>
                  <td className="px-5 py-4 font-mono text-[13px] text-chalk text-right tabular-nums">
                    {u.missionsCompleted}
                  </td>
                  <td className="px-5 py-4">
                    <UserRowActions userId={u.id} status={u.moderationStatus} role={u.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ModerationBadge({
  status,
  bannedUntil,
  reason,
}: {
  status: ModerationStatus
  bannedUntil: string | null
  reason: string | null
}) {
  const style =
    status === "banned"
      ? { background: "rgba(255,79,79,0.10)", color: "#FF4F4F", border: "1px solid rgba(255,79,79,0.4)" }
      : { background: "rgba(255,143,71,0.10)", color: "#FF8F47", border: "1px solid rgba(255,143,71,0.4)" }

  const label =
    status === "suspended" && bannedUntil
      ? `suspended · until ${formatDate(bannedUntil)}`
      : status

  return (
    <span
      className="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.5px] rounded px-2 py-0.5 max-w-[220px] truncate"
      style={style}
      title={reason ?? undefined}
    >
      {label}
    </span>
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
    <div className="bg-graphite border border-iron rounded-[10px] p-3" style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.3)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3" style={{ color: accent ?? "#E8FF47" }} />
        <p className="font-mono text-[10px] uppercase tracking-[1px] text-ash">{label}</p>
      </div>
      <p className="font-syne font-bold text-[22px] leading-none text-chalk tabular-nums">{value}</p>
    </div>
  )
}
