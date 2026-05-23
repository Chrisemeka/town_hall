import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  Sparkles, ShieldCheck, Smile, Frown, AlertTriangle, Meh,
} from "lucide-react"
import { SignupsChart, type SignupPoint } from "@/components/admin/SignupsChart"

export const metadata = { title: "AI Reports — Admin · Townhall" }

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const REPORT_LIMIT = 60

type Sentiment = "POSITIVE" | "NEUTRAL" | "FRUSTRATED" | "UNKNOWN"

type ReportRow = {
  id: string
  createdAt: string
  aiSummary: string
  aiSentiment: Sentiment
  testerComment: string
  mission: { id: string; title: string } | null
  project: { id: string; name: string } | null
  tester: { fullName: string; email: string; avatarUrl: string | null }
}

type FailedRow = {
  id: string
  createdAt: string
  testerComment: string
  mission: { id: string; title: string } | null
  tester: { fullName: string; email: string }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function initials(name: string, email: string) {
  const source = name || email
  return source.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("")
}

function normalizeSentiment(s: string | null): Sentiment {
  if (!s) return "UNKNOWN"
  const u = s.toUpperCase()
  if (u === "POSITIVE" || u === "NEUTRAL" || u === "FRUSTRATED") return u
  return "UNKNOWN"
}

function sentimentStyle(s: Sentiment) {
  switch (s) {
    case "POSITIVE":   return { bg: "rgba(122,225,138,0.10)", color: "#7AE18A", border: "1px solid rgba(122,225,138,0.4)", Icon: Smile }
    case "NEUTRAL":    return { bg: "rgba(124,124,138,0.10)", color: "#A1A1AA", border: "1px solid rgba(124,124,138,0.4)", Icon: Meh }
    case "FRUSTRATED": return { bg: "rgba(255,79,79,0.10)",   color: "#FF4F4F", border: "1px solid rgba(255,79,79,0.4)",  Icon: Frown }
    case "UNKNOWN":    return { bg: "rgba(124,124,138,0.10)", color: "#7C7C8A", border: "1px solid rgba(124,124,138,0.4)", Icon: Meh }
  }
}

export default async function AdminAIReportsPage() {
  const admin = createAdminClient()

  const [resultsRes, missionsRes, projectsRes, profilesRes] = await Promise.all([
    admin
      .from("test_results")
      .select("id, mission_id, tester_id, tester_comment, ai_summary, ai_sentiment, created_at")
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

  const allResults = (resultsRes.data ?? []) as any[]
  const totalSubmissions = allResults.length

  const successful = allResults.filter((r) => r.ai_summary && r.ai_summary.trim() !== "")
  const failed = allResults.filter((r) => !r.ai_summary || r.ai_summary.trim() === "")

  const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, FRUSTRATED: 0, UNKNOWN: 0 }
  for (const r of successful) sentimentCounts[normalizeSentiment(r.ai_sentiment)] += 1

  const totalReports = successful.length
  const failedCount = failed.length
  const coverage = totalSubmissions > 0 ? Math.round((totalReports / totalSubmissions) * 100) : 0

  const reports: ReportRow[] = successful.slice(0, REPORT_LIMIT).map((r: any) => {
    const mission = missionById.get(r.mission_id)
    const project = mission ? projectById.get(mission.projectId) : undefined
    const tester = profileById.get(r.tester_id) ?? { fullName: "", email: "", avatarUrl: null }
    return {
      id: r.id,
      createdAt: r.created_at,
      aiSummary: r.ai_summary,
      aiSentiment: normalizeSentiment(r.ai_sentiment),
      testerComment: r.tester_comment ?? "",
      mission: mission ? { id: r.mission_id, title: mission.title } : null,
      project: mission && project ? { id: mission.projectId, name: project.name } : null,
      tester,
    }
  })

  const failedRows: FailedRow[] = failed.slice(0, 10).map((r: any) => {
    const mission = missionById.get(r.mission_id)
    const tester = profileById.get(r.tester_id) ?? { fullName: "", email: "", avatarUrl: null }
    return {
      id: r.id,
      createdAt: r.created_at,
      testerComment: r.tester_comment ?? "",
      mission: mission ? { id: r.mission_id, title: mission.title } : null,
      tester,
    }
  })

  // Reports per day for last 30 days
  const now = Date.now()
  const reportsByDay: SignupPoint[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * ONE_DAY_MS)
    return { date: d.toISOString().slice(0, 10), count: 0 }
  })
  const dayIndex = new Map(reportsByDay.map((p, i) => [p.date, i]))
  for (const r of successful) {
    const idx = dayIndex.get(r.created_at.slice(0, 10))
    if (idx !== undefined) reportsByDay[idx].count += 1
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-voltage" />
        <p className="font-mono text-[11px] font-medium text-voltage uppercase tracking-[1px]">
          Admin · AI Reports
        </p>
      </div>
      <h1 className="font-syne font-bold text-[36px] leading-[40px] tracking-[-0.5px] text-chalk mb-1">
        AI Reports
      </h1>
      <p className="font-mono text-[14px] text-ash mb-8">
        Monitor AI-generated summaries and sentiment classifications across every submission.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard icon={Sparkles}       label="Total Reports" value={totalReports} accent="#A78BFA" />
        <KpiCard icon={Sparkles}       label="Coverage"      value={`${coverage}%`} accent="#A78BFA" />
        <KpiCard icon={Smile}          label="Positive"      value={sentimentCounts.POSITIVE} accent="#7AE18A" />
        <KpiCard icon={Frown}          label="Frustrated"    value={sentimentCounts.FRUSTRATED} accent="#FF4F4F" />
        <KpiCard icon={AlertTriangle}  label="Failed"        value={failedCount} accent={failedCount > 0 ? "#FF8F47" : "#7C7C8A"} />
      </div>

      {/* Chart */}
      <div className="mb-8">
        <SignupsChart
          data={reportsByDay}
          title="AI Reports Generated"
          subtitle="Reports successfully generated per day, last 30 days."
        />
      </div>

      {/* Failed generations callout */}
      {failedCount > 0 && (
        <div
          className="rounded-[12px] p-5 mb-8"
          style={{ background: "rgba(255,143,71,0.05)", border: "1px solid rgba(255,143,71,0.3)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" style={{ color: "#FF8F47" }} />
            <h3 className="font-syne font-bold text-[15px]" style={{ color: "#FF8F47" }}>
              {failedCount} submission{failedCount === 1 ? "" : "s"} without an AI report
            </h3>
          </div>
          <p className="font-mono text-[13px] text-ash leading-5 mb-4">
            These submissions were saved but the AI summary failed to generate. Most recent {failedRows.length}:
          </p>
          <ul className="flex flex-col gap-2">
            {failedRows.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-3 py-2 rounded-[8px]" style={{ background: "rgba(0,0,0,0.25)" }}>
                <span className="font-mono text-[12px] text-ash whitespace-nowrap pt-0.5">
                  {formatDateTime(f.createdAt)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[12px] text-chalk truncate">
                    {f.tester.fullName || f.tester.email || "Unknown tester"}
                    {f.mission ? <> · <Link href={`/admin/missions/${f.mission.id}`} className="text-ash hover:text-voltage transition-colors duration-150">{f.mission.title}</Link></> : null}
                  </p>
                  {f.testerComment && (
                    <p className="font-mono text-[12px] text-ash leading-5 mt-1 line-clamp-2">{f.testerComment}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reports list */}
      <div className="bg-graphite border border-iron rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-iron flex items-center justify-between">
          <h2 className="font-syne font-bold text-[16px] text-chalk">Recent AI Reports</h2>
          <span className="font-mono text-[12px] text-ash">
            {reports.length === totalReports
              ? `${totalReports} total`
              : `showing ${reports.length} of ${totalReports}`}
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="px-5 py-16 text-center font-mono text-[13px] text-ash">
            No AI reports yet.
          </div>
        ) : (
          <ul className="divide-y divide-iron/60">
            {reports.map((r) => {
              const sentiment = sentimentStyle(r.aiSentiment)
              const SentimentIcon = sentiment.Icon
              return (
                <li key={r.id} className="p-5 hover:bg-obsidian/20 transition-colors duration-150">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-obsidian border border-iron flex items-center justify-center overflow-hidden shrink-0">
                      {r.tester.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.tester.avatarUrl} alt={r.tester.fullName || r.tester.email} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-mono text-[12px] text-ash">{initials(r.tester.fullName, r.tester.email)}</span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      {/* Header line */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                        <span className="font-mono text-[13px] text-chalk truncate">
                          {r.tester.fullName || r.tester.email || "Unknown tester"}
                        </span>
                        <span className="font-mono text-[12px] text-ash">·</span>
                        <span className="font-mono text-[12px] text-ash whitespace-nowrap">
                          {formatDateTime(r.createdAt)}
                        </span>
                      </div>

                      {/* Project › Mission + Sentiment */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 font-mono text-[12px] text-ash">
                        {r.project ? (
                          <span className="text-chalk truncate max-w-[200px]">{r.project.name}</span>
                        ) : (
                          <span className="text-ember">project missing</span>
                        )}
                        <span>›</span>
                        {r.mission ? (
                          <Link
                            href={`/admin/missions/${r.mission.id}`}
                            className="text-ash hover:text-voltage transition-colors duration-150 truncate max-w-[260px]"
                          >
                            {r.mission.title}
                          </Link>
                        ) : (
                          <span className="text-ember">mission missing</span>
                        )}
                        <span
                          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.5px] rounded px-2 py-0.5"
                          style={{ background: sentiment.bg, color: sentiment.color, border: sentiment.border }}
                        >
                          <SentimentIcon className="w-3 h-3" />
                          {r.aiSentiment.toLowerCase()}
                        </span>
                      </div>

                      {/* AI Summary — main content */}
                      <div
                        className="rounded-[8px] p-4 mb-3"
                        style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.25)" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
                          <p className="font-mono text-[11px] uppercase tracking-[1px]" style={{ color: "#A78BFA" }}>AI Summary</p>
                        </div>
                        <p className="font-mono text-[14px] text-chalk leading-5 whitespace-pre-wrap">{r.aiSummary}</p>
                      </div>

                      {/* Original tester comment as smaller context */}
                      {r.testerComment && (
                        <div className="pl-3" style={{ borderLeft: "2px solid #2C2C35" }}>
                          <p className="font-mono text-[11px] uppercase tracking-[1px] text-ash mb-1">Tester said</p>
                          <p className="font-mono text-[13px] text-ash leading-5 whitespace-pre-wrap line-clamp-3">{r.testerComment}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
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
  value: number | string
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
