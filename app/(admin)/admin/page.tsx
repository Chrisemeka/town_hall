import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  Users, FolderOpen, Target, MessageSquare, Sparkles,
  ArrowRight, ShieldCheck, UserPlus, Flag, Activity, AlertTriangle,
} from "lucide-react"
import { LiveClock } from "@/components/admin/LiveClock"

type ActivityKind = "signup" | "submission" | "flag"
type ActivityItem = {
  kind: ActivityKind
  timestamp: string
  text: React.ReactNode
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default async function AdminHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    "Admin"

  // ── Counts (head queries, no row data fetched) ──────────────
  const [
    usersCountRes,
    projectsCountRes,
    missionsCountRes,
    submissionsCountRes,
    flaggedCountRes,
    aiReportsCountRes,
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("projects").select("*", { count: "exact", head: true }),
    admin.from("missions").select("*", { count: "exact", head: true }),
    admin.from("test_results").select("*", { count: "exact", head: true }),
    admin.from("projects").select("*", { count: "exact", head: true }).not("flagged_at", "is", null),
    admin.from("test_results").select("*", { count: "exact", head: true }).not("ai_summary", "is", null).neq("ai_summary", ""),
  ])

  const usersCount       = usersCountRes.count ?? 0
  const projectsCount    = projectsCountRes.count ?? 0
  const missionsCount    = missionsCountRes.count ?? 0
  const submissionsCount = submissionsCountRes.count ?? 0
  const flaggedCount     = flaggedCountRes.count ?? 0
  const aiReportsCount   = aiReportsCountRes.count ?? 0

  // ── Recent activity sources ────────────────────────────────
  const [recentUsersRes, recentSubmissionsRes, recentFlaggedRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 5 }),
    admin
      .from("test_results")
      .select("id, tester_id, mission_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("projects")
      .select("id, name, flagged_at, flag_reason")
      .not("flagged_at", "is", null)
      .order("flagged_at", { ascending: false })
      .limit(5),
  ])

  // Lookups for submission feed
  const subTesterIds  = Array.from(new Set((recentSubmissionsRes.data ?? []).map((r: any) => r.tester_id).filter(Boolean)))
  const subMissionIds = Array.from(new Set((recentSubmissionsRes.data ?? []).map((r: any) => r.mission_id).filter(Boolean)))

  const [subTestersRes, subMissionsRes] = await Promise.all([
    subTesterIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", subTesterIds)
      : Promise.resolve({ data: [] }),
    subMissionIds.length
      ? admin.from("missions").select("id, title").in("id", subMissionIds)
      : Promise.resolve({ data: [] }),
  ])

  const testerById  = new Map((subTestersRes.data ?? []).map((p: any) => [p.id, { fullName: p.full_name ?? "", email: p.email ?? "" }]))
  const missionById = new Map((subMissionsRes.data ?? []).map((m: any) => [m.id, m.title as string]))

  // Build combined activity feed
  const activity: ActivityItem[] = []

  for (const u of recentUsersRes.data?.users ?? []) {
    activity.push({
      kind: "signup",
      timestamp: u.created_at,
      text: (
        <>
          <span className="text-chalk">{(u.user_metadata?.full_name as string | undefined) || u.email || "Someone"}</span>{" "}
          joined the community
        </>
      ),
    })
  }

  for (const r of (recentSubmissionsRes.data ?? []) as any[]) {
    const tester = testerById.get(r.tester_id)
    const missionTitle = missionById.get(r.mission_id)
    activity.push({
      kind: "submission",
      timestamp: r.created_at,
      text: (
        <>
          <span className="text-chalk">{tester?.fullName || tester?.email || "A tester"}</span>{" "}
          submitted feedback{missionTitle ? <> on <span className="text-chalk">{missionTitle}</span></> : null}
        </>
      ),
    })
  }

  for (const p of (recentFlaggedRes.data ?? []) as any[]) {
    activity.push({
      kind: "flag",
      timestamp: p.flagged_at,
      text: (
        <>
          Flagged <span className="text-chalk">{p.name}</span>
          {p.flag_reason ? <span className="text-ash"> — {p.flag_reason}</span> : null}
        </>
      ),
    })
  }

  activity.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
  const recentActivity = activity.slice(0, 10)

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">

      {/* ── Header row: welcome (left) + live clock (right) ─── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-voltage" />
            <p className="font-mono text-[12px] font-medium text-voltage uppercase tracking-[1px]">
              Admin Console
            </p>
          </div>
          <h1 className="font-syne font-bold text-[40px] leading-[44px] tracking-[-0.5px] text-chalk mb-2">
            Welcome, {displayName}.
          </h1>
          <p className="font-mono text-[14px] text-ash max-w-xl">
            Manage the Townhall community from here.
          </p>
        </div>
        <LiveClock />
      </div>

      {/* ── KPI strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <KpiTile icon={Users}         label="Users"        value={usersCount} />
        <KpiTile icon={FolderOpen}    label="Projects"     value={projectsCount} />
        <KpiTile icon={Target}        label="Missions"     value={missionsCount} />
        <KpiTile icon={MessageSquare} label="Submissions"  value={submissionsCount} />
        <KpiTile icon={Sparkles}      label="AI Reports"   value={aiReportsCount}   accent="#A78BFA" />
        <KpiTile icon={Flag}          label="Flagged"      value={flaggedCount}     accent={flaggedCount > 0 ? "#FF4F4F" : "#7C7C8A"} />
      </div>

      {/* ── Nav cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <NavCard href="/admin/users"       icon={Users}         title="Users"       desc="Browse every account, signup dates, projects submitted, and missions completed." />
        <NavCard href="/admin/projects"    icon={FolderOpen}    title="Projects"    desc="Review every submitted project, flag inappropriate content, or remove it." />
        <NavCard href="/admin/missions"    icon={Target}        title="Missions"    desc="Every mission across the platform with status, owner, and feedback counts." />
        <NavCard href="/admin/submissions" icon={MessageSquare} title="Submissions" desc="Every test result by a tester with comments, AI summaries, and screenshots." />
        <NavCard href="/admin/ai-reports"  icon={Sparkles}      title="AI Reports"  desc="Monitor AI-generated summaries and sentiment, with coverage and failure tracking." />
      </div>

      {/* ── Recent activity ──────────────────────────────────── */}
      <div className="bg-graphite border border-iron rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-iron flex items-center gap-2">
          <Activity className="w-4 h-4 text-voltage" />
          <h2 className="font-syne font-bold text-[16px] text-chalk">Recent Activity</h2>
        </div>
        {recentActivity.length === 0 ? (
          <div className="px-5 py-12 text-center font-mono text-[13px] text-ash">
            Nothing here yet.
          </div>
        ) : (
          <ul className="divide-y divide-iron/60">
            {recentActivity.map((item, i) => (
              <li key={`${item.kind}-${i}`} className="px-5 py-3 flex items-center gap-3">
                <ActivityIcon kind={item.kind} />
                <p className="font-mono text-[13px] text-ash flex-1 leading-5 min-w-0">
                  {item.text}
                </p>
                <span className="font-mono text-[12px] text-ash/70 whitespace-nowrap tabular-nums">
                  {relativeTime(item.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function KpiTile({
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

function NavCard({
  href, icon: Icon, title, desc,
}: {
  href: string
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="group bg-graphite border border-iron rounded-[12px] p-6 hover:border-voltage/40 transition-colors duration-150 flex flex-col"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="w-10 h-10 rounded-[8px] bg-obsidian border border-iron flex items-center justify-center">
          <Icon className="w-5 h-5 text-voltage" />
        </div>
        <ArrowRight className="w-4 h-4 text-ash group-hover:text-voltage transition-colors duration-150" />
      </div>
      <h3 className="font-syne font-bold text-[18px] text-chalk mb-1">{title}</h3>
      <p className="font-mono text-[13px] text-ash leading-5">{desc}</p>
    </Link>
  )
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  if (kind === "signup") {
    return (
      <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: "rgba(122,184,255,0.10)", border: "1px solid rgba(122,184,255,0.3)" }}>
        <UserPlus className="w-3.5 h-3.5" style={{ color: "#7AB8FF" }} />
      </div>
    )
  }
  if (kind === "submission") {
    return (
      <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: "rgba(232,255,71,0.08)", border: "1px solid rgba(232,255,71,0.3)" }}>
        <MessageSquare className="w-3.5 h-3.5" style={{ color: "#E8FF47" }} />
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,79,79,0.10)", border: "1px solid rgba(255,79,79,0.3)" }}>
      <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#FF4F4F" }} />
    </div>
  )
}
