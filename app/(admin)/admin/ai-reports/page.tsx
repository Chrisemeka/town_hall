import Link from "next/link"
import { Avatar } from "@/components/ui/Avatar"
import { requireAdmin } from "@/lib/auth"
import {
  Sparkles, ShieldCheck, Smile, Frown, AlertTriangle, Meh, CircleDollarSign, Gauge, Activity,
} from "lucide-react"
import { SignupsChart, type SignupPoint } from "@/components/admin/SignupsChart"
import type { AiUsageEventRow, ProfileRow, TestResultRow } from "@/lib/types/db"

/** Exactly what the listing selects below ask for. */
type ResultLite = Pick<
  TestResultRow,
  "id" | "mission_id" | "tester_id" | "tester_comment" | "ai_summary" | "ai_sentiment" | "created_at"
>
type ProfileLite = Pick<ProfileRow, "id" | "full_name" | "email" | "avatar_url">
type UsageLite = Pick<AiUsageEventRow, "status" | "estimated_cost_usd">

export const metadata = { title: "AI Reports — Admin · Twnhall" }

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


/** Nearest-rank percentile of an ascending array; null when empty. */
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]
}

function usd(n: number | null) {
  return n === null ? "—" : `$${n.toFixed(4)}`
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
    case "FRUSTRATED": return { bg: "rgba(255,79,79,0.10)",   color: "var(--color-danger-ink)", border: "1px solid rgba(255,79,79,0.4)",  Icon: Frown }
    case "UNKNOWN":    return { bg: "rgba(124,124,138,0.10)", color: "#7C7C8A", border: "1px solid rgba(124,124,138,0.4)", Icon: Meh }
  }
}

export default async function AdminAIReportsPage() {
  // The layout checks too; a page re-checks so a layout change cannot open it.
  const { admin } = await requireAdmin()

  // Async Server Component: renders once per request on the server, so
  // reading the clock here is the intent.
  const now = Date.now()
  const today = new Date(now)
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString()

  // Counts in SQL (admin_ai_summary); the lists are the latest few, joined.
  // This page used to load every report, mission, project and profile.
  const listed = "id, mission_id, tester_id, tester_comment, ai_summary, ai_sentiment, created_at, missions(id, title, projects(id, name))"
  const [summaryRes, okRes, failedRes, usageRes] = await Promise.all([
    admin.rpc("admin_ai_summary", { p_days: 30 }),
    admin.from("test_results").select(listed).not("ai_summary", "is", null).neq("ai_summary", "").order("created_at", { ascending: false }).limit(REPORT_LIMIT),
    admin.from("test_results").select(listed).or("ai_summary.is.null,ai_summary.eq.").order("created_at", { ascending: false }).limit(10),
    // Cost record, not a quota ledger — read here only to be looked at.
    admin.from("ai_usage_events").select("status, estimated_cost_usd").gte("created_at", monthStart),
  ])

  const usage = (usageRes.data ?? []) as UsageLite[]
  // numeric can arrive as a string from PostgREST; Number() covers both.
  const costs = usage
    .filter((u) => u.status === "succeeded" && u.estimated_cost_usd !== null)
    .map((u) => Number(u.estimated_cost_usd))
    .sort((a, b) => a - b)
  const monthSpend = costs.reduce((sum, c) => sum + c, 0)
  const monthAnalyses = usage.length
  const monthFailed = usage.filter((u) => u.status === "failed").length
  const failureRate = monthAnalyses > 0 ? `${Math.round((monthFailed / monthAnalyses) * 100)}%` : "—"

  type Listed = ResultLite & { missions: { id: string; title: string; projects: { id: string; name: string } | null } | null }
  const okRows = (okRes.data ?? []) as unknown as (Listed & { ai_summary: string })[]
  const failed = (failedRes.data ?? []) as unknown as Listed[]
  const testerIds = [...new Set([...okRows, ...failed].map((r) => r.tester_id))]
  const { data: profiles } = testerIds.length
    ? await admin.from("profiles").select("id, full_name, email, avatar_url").in("id", testerIds)
    : { data: [] }
  const profileById = new Map(
    ((profiles ?? []) as ProfileLite[]).map((p) => [p.id, { fullName: p.full_name ?? "", email: p.email ?? "", avatarUrl: p.avatar_url ?? null }]),
  )

  const summary = ((summaryRes.data as Record<string, unknown>[] | null)?.[0] ?? {}) as Record<string, unknown>
  const num = (k: string) => Number(summary[k] ?? 0)
  const totalSubmissions = num("total")
  const totalReports = num("generated")
  const failedCount = num("failed")
  const sentimentCounts = { POSITIVE: num("positive"), NEUTRAL: num("neutral"), FRUSTRATED: num("frustrated"), UNKNOWN: num("unknown") }
  const coverage = totalSubmissions > 0 ? Math.round((totalReports / totalSubmissions) * 100) : 0

  const reports: ReportRow[] = okRows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    aiSummary: r.ai_summary,
    aiSentiment: normalizeSentiment(r.ai_sentiment),
    testerComment: r.tester_comment ?? "",
    mission: r.missions ? { id: r.missions.id, title: r.missions.title } : null,
    project: r.missions?.projects ? { id: r.missions.projects.id, name: r.missions.projects.name } : null,
    tester: profileById.get(r.tester_id) ?? { fullName: "", email: "", avatarUrl: null },
  }))

  const failedRows: FailedRow[] = failed.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    testerComment: r.tester_comment ?? "",
    mission: r.missions ? { id: r.missions.id, title: r.missions.title } : null,
    tester: profileById.get(r.tester_id) ?? { fullName: "", email: "" },
  }))

  // Reports per day for last 30 days
  const daily = (summary.daily ?? {}) as Record<string, number>
  const reportsByDay: SignupPoint[] = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now - (29 - i) * ONE_DAY_MS).toISOString().slice(0, 10)
    return { date, count: Number(daily[date] ?? 0) }
  })

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-accent-ink" />
        <p className="font-mono text-[11px] font-medium text-accent-ink uppercase tracking-[1px]">
          Admin · AI Reports
        </p>
      </div>
      <h1 className="font-syne font-bold text-[36px] leading-[40px] tracking-[-0.5px] text-ink mb-1">
        AI Reports
      </h1>
      <p className="font-mono text-[14px] text-ink-muted mb-8">
        Monitor AI-generated summaries and sentiment classifications across every submission.
      </p>

      {/* AI cost, this month (UTC). Shadow metering: recorded, never enforced. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard icon={CircleDollarSign} label="Spend this month" value={costs.length ? usd(monthSpend) : "—"} />
        <KpiCard icon={Gauge}            label="Median / p95"     value={`${usd(percentile(costs, 0.5))} / ${usd(percentile(costs, 0.95))}`} />
        <KpiCard icon={Activity}         label="Analyses this month" value={monthAnalyses} />
        <KpiCard icon={AlertTriangle}    label="Failure rate"     value={failureRate} />
      </div>
      <p className="font-mono text-[12px] text-ink-muted mb-8">
        Estimated from token counts at the rate on the day each analysis ran. Recorded since 29 Sep 2026 — earlier analyses have no cost data.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard icon={Sparkles}       label="Total Reports" value={totalReports} accent="#A78BFA" />
        <KpiCard icon={Sparkles}       label="Coverage"      value={`${coverage}%`} accent="#A78BFA" />
        <KpiCard icon={Smile}          label="Positive"      value={sentimentCounts.POSITIVE} accent="#7AE18A" />
        <KpiCard icon={Frown}          label="Frustrated"    value={sentimentCounts.FRUSTRATED} accent="var(--color-danger-ink)" />
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
          <p className="font-mono text-[13px] text-ink-muted leading-5 mb-4">
            These submissions were saved but the AI summary failed to generate. Most recent {failedRows.length}:
          </p>
          <ul className="flex flex-col gap-2">
            {failedRows.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-3 py-2 rounded-[8px]" style={{ background: "rgba(0,0,0,0.25)" }}>
                <span className="font-mono text-[12px] text-ink-muted whitespace-nowrap pt-0.5">
                  {formatDateTime(f.createdAt)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[12px] text-ink truncate">
                    {f.tester.fullName || f.tester.email || "Unknown tester"}
                    {f.mission ? <> · <Link href={`/admin/missions/${f.mission.id}`} className="text-ink-muted hover:text-accent-ink transition-colors duration-150">{f.mission.title}</Link></> : null}
                  </p>
                  {f.testerComment && (
                    <p className="font-mono text-[12px] text-ink-muted leading-5 mt-1 line-clamp-2">{f.testerComment}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reports list */}
      <div className="bg-surface-raised border border-line rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h2 className="font-syne font-bold text-[16px] text-ink">Recent AI Reports</h2>
          <span className="font-mono text-[12px] text-ink-muted">
            {reports.length === totalReports
              ? `${totalReports} total`
              : `showing ${reports.length} of ${totalReports}`}
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="px-5 py-16 text-center font-mono text-[13px] text-ink-muted">
            No AI reports yet.
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            {reports.map((r) => {
              const sentiment = sentimentStyle(r.aiSentiment)
              const SentimentIcon = sentiment.Icon
              return (
                <li key={r.id} className="p-5 hover:bg-ink/[0.06] transition-colors duration-150">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar
                      src={r.tester.avatarUrl}
                      name={r.tester.fullName}
                      email={r.tester.email}
                      size={10}
                    />

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      {/* Header line */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                        <span className="font-mono text-[13px] text-ink truncate">
                          {r.tester.fullName || r.tester.email || "Unknown tester"}
                        </span>
                        <span className="font-mono text-[12px] text-ink-muted">·</span>
                        <span className="font-mono text-[12px] text-ink-muted whitespace-nowrap">
                          {formatDateTime(r.createdAt)}
                        </span>
                      </div>

                      {/* Project › Mission + Sentiment */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 font-mono text-[12px] text-ink-muted">
                        {r.project ? (
                          <span className="text-ink truncate max-w-[200px]">{r.project.name}</span>
                        ) : (
                          <span className="text-danger-ink">project missing</span>
                        )}
                        <span>›</span>
                        {r.mission ? (
                          <Link
                            href={`/admin/missions/${r.mission.id}`}
                            className="text-ink-muted hover:text-accent-ink transition-colors duration-150 truncate max-w-[260px]"
                          >
                            {r.mission.title}
                          </Link>
                        ) : (
                          <span className="text-danger-ink">test case missing</span>
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
                        <p className="font-mono text-[14px] text-ink leading-5 whitespace-pre-wrap">{r.aiSummary}</p>
                      </div>

                      {/* Original tester comment as smaller context */}
                      {r.testerComment && (
                        <div className="pl-3" style={{ borderLeft: "2px solid var(--color-line)" }}>
                          <p className="font-mono text-[11px] uppercase tracking-[1px] text-ink-muted mb-1">Tester said</p>
                          <p className="font-mono text-[13px] text-ink-muted leading-5 whitespace-pre-wrap line-clamp-3">{r.testerComment}</p>
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
    <div className="bg-surface-raised border border-line rounded-[12px] p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "var(--color-accent-ink)" }} />
        <p className="font-mono text-[11px] uppercase tracking-[1px] text-ink-muted">{label}</p>
      </div>
      <p className="font-syne font-bold text-[28px] leading-none text-ink tabular-nums">{value}</p>
    </div>
  )
}
