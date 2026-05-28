import { createAdminClient } from "@/lib/supabase/admin"
import { MessageSquare, ShieldCheck, Smile, Frown } from "lucide-react"
import { SignupsChart, type SignupPoint } from "@/components/admin/SignupsChart"
import {
  SubmissionsList,
  normalizeSentiment,
  type SubmissionRow,
} from "@/components/admin/SubmissionsList"

export const metadata = { title: "Submissions — Admin · Twnhall" }

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const CARD_LIMIT = 100

export default async function AdminSubmissionsPage() {
  const admin = createAdminClient()

  const [resultsRes, missionsRes, projectsRes, profilesRes] = await Promise.all([
    admin
      .from("test_results")
      .select("id, mission_id, tester_id, screenshot_url, tester_comment, ai_summary, ai_sentiment, created_at")
      .order("created_at", { ascending: false }),
    admin.from("missions").select("id, title, project_id"),
    admin.from("projects").select("id, name"),
    admin.from("profiles").select("id, full_name, email, avatar_url"),
  ])

  const missionById = new Map(
    (missionsRes.data ?? []).map((m: any) => [m.id, { title: m.title as string, projectId: m.project_id as string }]),
  )
  const projectById = new Map(
    (projectsRes.data ?? []).map((p: any) => [p.id, { name: p.name as string }]),
  )
  const profileById = new Map(
    (profilesRes.data ?? []).map((p: any) => [
      p.id,
      {
        fullName: (p.full_name as string) ?? "",
        email: (p.email as string) ?? "",
        avatarUrl: (p.avatar_url as string | null) ?? null,
      },
    ]),
  )

  const allSubmissions: SubmissionRow[] = (resultsRes.data ?? []).map((r: any) => {
    const mission = missionById.get(r.mission_id)
    const project = mission ? projectById.get(mission.projectId) : undefined
    const tester = profileById.get(r.tester_id) ?? { fullName: "", email: "", avatarUrl: null }

    return {
      id: r.id,
      createdAt: r.created_at,
      testerComment: r.tester_comment ?? "",
      aiSummary: r.ai_summary ?? null,
      aiSentiment: normalizeSentiment(r.ai_sentiment),
      screenshotUrl: r.screenshot_url ?? null,
      mission: mission ? { id: r.mission_id, title: mission.title } : null,
      project: mission && project ? { id: mission.projectId, name: project.name } : null,
      tester,
    }
  })

  const submissions = allSubmissions.slice(0, CARD_LIMIT)

  const total = allSubmissions.length
  const now = Date.now()
  const sevenDaysAgo = now - 7 * ONE_DAY_MS
  const last7d = allSubmissions.filter((r) => +new Date(r.createdAt) >= sevenDaysAgo).length

  const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, FRUSTRATED: 0, UNKNOWN: 0 }
  for (const r of allSubmissions) sentimentCounts[r.aiSentiment] += 1

  const submissionsByDay: SignupPoint[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * ONE_DAY_MS)
    return { date: d.toISOString().slice(0, 10), count: 0 }
  })
  const dayIndex = new Map(submissionsByDay.map((p, i) => [p.date, i]))
  for (const r of allSubmissions) {
    const idx = dayIndex.get(r.createdAt.slice(0, 10))
    if (idx !== undefined) submissionsByDay[idx].count += 1
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-voltage" />
        <p className="font-mono text-[11px] font-medium text-voltage uppercase tracking-[1px]">
          Admin · Submissions
        </p>
      </div>
      <h1 className="font-syne font-bold text-[36px] leading-[40px] tracking-[-0.5px] text-chalk mb-1">
        Test Submissions
      </h1>
      <p className="font-mono text-[14px] text-ash mb-8">
        Every test result submitted by a tester, with their comment, AI summary, and screenshot proof.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={MessageSquare} label="Total Submissions" value={total} />
        <KpiCard icon={MessageSquare} label="Last 7 Days" value={last7d} accent="#E8FF47" />
        <KpiCard icon={Smile}  label="Positive"    value={sentimentCounts.POSITIVE}   accent="#7AE18A" />
        <KpiCard icon={Frown}  label="Frustrated"  value={sentimentCounts.FRUSTRATED} accent="#FF4F4F" />
      </div>

      {/* Chart */}
      <div className="mb-8">
        <SignupsChart
          data={submissionsByDay}
          title="Submissions"
          subtitle="Test results submitted per day, last 30 days."
        />
      </div>

      {/* Submissions list */}
      <div className="bg-graphite border border-iron rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-iron flex items-center justify-between">
          <h2 className="font-syne font-bold text-[16px] text-chalk">Recent Submissions</h2>
          <span className="font-mono text-[12px] text-ash">
            {submissions.length === total
              ? `${total} total`
              : `showing ${submissions.length} of ${total}`}
          </span>
        </div>

        <SubmissionsList submissions={submissions} />
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
