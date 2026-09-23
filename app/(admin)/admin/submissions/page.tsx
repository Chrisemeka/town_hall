import { createAdminClient } from "@/lib/supabase/admin"
import { MessageSquare, ShieldCheck, Smile, Frown } from "lucide-react"
import { SignupsChart, type SignupPoint } from "@/components/admin/SignupsChart"
import {
  SubmissionsList,
  normalizeSentiment,
  type SubmissionRow,
} from "@/components/admin/SubmissionsList"
import type { MissionRow, ProfileRow, ProjectRow, TestResultRow } from "@/lib/types/db"
import type { SubmissionEntry } from "@/components/submissions/SubmissionBody"
import { screenshotList } from "@/lib/utils/screenshots"

/** Exactly what the four selects below ask for. */
type ResultLite = Pick<
  TestResultRow,
  | "id" | "mission_id" | "tester_id" | "screenshot_url" | "screenshot_urls"
  | "tester_comment" | "ai_summary" | "ai_sentiment" | "created_at"
>
type MissionLite = Pick<MissionRow, "id" | "title" | "project_id">
type ProjectLite = Pick<ProjectRow, "id" | "name">
type ProfileLite = Pick<ProfileRow, "id" | "full_name" | "email" | "avatar_url">


export const metadata = { title: "Submissions — Admin · Twnhall" }

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const CARD_LIMIT = 100

export default async function AdminSubmissionsPage() {
  const admin = createAdminClient()

  const [resultsRes, missionsRes, projectsRes, profilesRes] = await Promise.all([
    admin
      .from("test_results")
      .select("id, mission_id, tester_id, screenshot_url, screenshot_urls, tester_comment, ai_summary, ai_sentiment, created_at")
      .order("created_at", { ascending: false }),
    admin.from("missions").select("id, title, project_id"),
    admin.from("projects").select("id, name"),
    admin.from("profiles").select("id, full_name, email, avatar_url"),
  ])

  const missionById = new Map(
    ((missionsRes.data ?? []) as MissionLite[]).map((m) => [m.id, { title: m.title, projectId: m.project_id }]),
  )
  const projectById = new Map(
    ((projectsRes.data ?? []) as ProjectLite[]).map((p) => [p.id, { name: p.name }]),
  )
  const profileById = new Map(
    ((profilesRes.data ?? []) as ProfileLite[]).map((p) => [
      p.id,
      {
        fullName: p.full_name ?? "",
        email: p.email ?? "",
        avatarUrl: p.avatar_url ?? null,
      },
    ]),
  )

  // Entries for the listed results. Same service-role read as the builder
  // surfaces; admins already see every submission, so this widens nothing.
  const resultIds = ((resultsRes.data ?? []) as ResultLite[]).map((r) => r.id)
  const { data: entryRows } = resultIds.length
    ? await admin
        .from("test_result_entries")
        .select("id, test_result_id, step_index, step_action, step_expected, status, issue_summary, steps_to_reproduce, actual_result, expected_result")
        .in("test_result_id", resultIds)
        .order("step_index", { ascending: true })
    : { data: [] }

  const entriesByResult = new Map<string, SubmissionEntry[]>()
  for (const row of (entryRows ?? []) as (SubmissionEntry & { test_result_id: string })[]) {
    const list = entriesByResult.get(row.test_result_id) ?? []
    list.push(row)
    entriesByResult.set(row.test_result_id, list)
  }

  const allSubmissions: SubmissionRow[] = ((resultsRes.data ?? []) as ResultLite[]).map((r) => {
    const mission = missionById.get(r.mission_id)
    const project = mission ? projectById.get(mission.projectId) : undefined
    const tester = profileById.get(r.tester_id) ?? { fullName: "", email: "", avatarUrl: null }

    return {
      id: r.id,
      createdAt: r.created_at,
      testerComment: r.tester_comment ?? "",
      aiSummary: r.ai_summary ?? null,
      aiSentiment: normalizeSentiment(r.ai_sentiment),
      screenshotUrls: screenshotList(r),
      mission: mission ? { id: r.mission_id, title: mission.title } : null,
      project: mission && project ? { id: mission.projectId, name: project.name } : null,
      tester,
      entries: entriesByResult.get(r.id) ?? null,
    }
  })

  const submissions = allSubmissions.slice(0, CARD_LIMIT)

  const total = allSubmissions.length
  // Async Server Component: this renders once per request on the server, so
  // reading the clock here is the intent, not a hazard. The rule guards client
  // re-render determinism, which cannot apply to a component that never
  // re-renders on the client.
  // eslint-disable-next-line react-hooks/purity
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
        <ShieldCheck className="w-4 h-4 text-accent-ink" />
        <p className="font-mono text-[11px] font-medium text-accent-ink uppercase tracking-[1px]">
          Admin · Submissions
        </p>
      </div>
      <h1 className="font-syne font-bold text-[36px] leading-[40px] tracking-[-0.5px] text-ink mb-1">
        Test Submissions
      </h1>
      <p className="font-mono text-[14px] text-ink-muted mb-8">
        Every test result submitted by a tester, with their comment, AI summary, and screenshot proof.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={MessageSquare} label="Total Submissions" value={total} />
        <KpiCard icon={MessageSquare} label="Last 7 Days" value={last7d} accent="var(--color-accent-ink)" />
        <KpiCard icon={Smile}  label="Positive"    value={sentimentCounts.POSITIVE}   accent="#7AE18A" />
        <KpiCard icon={Frown}  label="Frustrated"  value={sentimentCounts.FRUSTRATED} accent="var(--color-danger-ink)" />
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
      <div className="bg-surface-raised border border-line rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h2 className="font-syne font-bold text-[16px] text-ink">Recent Submissions</h2>
          <span className="font-mono text-[12px] text-ink-muted">
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
    <div className="bg-surface-raised border border-line rounded-[12px] p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "var(--color-accent-ink)" }} />
        <p className="font-mono text-[11px] uppercase tracking-[1px] text-ink-muted">{label}</p>
      </div>
      <p className="font-syne font-bold text-[28px] leading-none text-ink tabular-nums">{value}</p>
    </div>
  )
}
