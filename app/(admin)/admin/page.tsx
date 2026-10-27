import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { PageHeader, Panel, Stat, Empty, formatDateTime } from "@/components/admin/ui"
import { Sparkline } from "@/components/admin/Sparkline"
import { payoutSheet } from "@/lib/cohortDb"
import { monthOf } from "@/lib/allowance"
import { planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"
import { formatNgn, mrr, type Subscription } from "@/lib/subscriptions"
import { FX, INFRA_USD_MONTHLY, usdToNgn } from "@/lib/costs"
import {
  BREAK_EVEN_REPORTS,
  capacityFor,
  change,
  fills,
  formatDuration,
  median,
  monthStart,
  monthsBack,
  paidReportsSold,
  percentile,
  previous,
  rangeFor,
  ratio,
} from "@/lib/metrics"
import { cn } from "@/lib/utils"

export const metadata = { title: "Overview — Admin · Twnhall" }

// Admin Metrics §3 and §9: the alarms first, then the five numbers that say
// whether this is working, each with the decision it informs. Everything
// below the alarm row follows the date range.

const RANGES = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["month", "This month"]] as const
const FEEDS = [["all", "All"], ["events", "Events"], ["reports", "Reports"], ["signups", "Signups"]] as const

const shortMonth = (m: string) => new Date(`${m}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short" })

type Feed = { at: string; kind: string; text: string; href?: string }

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ range?: string; feed?: string }> }) {
  const { admin } = await requireAdmin()
  const sp = await searchParams
  // Async Server Component, once per request: reading the clock is the intent.
  const now = new Date()
  const range = rangeFor(sp.range, now)
  const before = previous(range)
  const feed = FEEDS.some(([f]) => f === sp.feed) ? sp.feed! : "all"

  const months = monthsBack(now, 6)
  const sixStart = new Date(`${months[0]}T00:00:00+01:00`)
  const thisMonth = monthOf(now)
  const iso = (d: Date) => d.toISOString()

  const [alertsRes, missionsRes, reportsRes, subsRes, starterRes, proRes, aiRangeRes, aiMonthRes, trafficNow, trafficBefore, sheets, eventsRes] =
    await Promise.all([
      admin.from("alerts").select("rule_key, alert_rules(severity)").neq("status", "resolved"),
      admin.from("missions").select("id, title, created_at, testers_needed").gte("created_at", iso(sixStart)),
      admin.from("test_results").select("id, mission_id, created_at").gte("created_at", iso(sixStart)).order("created_at", { ascending: false }),
      admin.from("subscriptions").select("plan_id, status, period_start, period_end, amount_ngn, ended_at"),
      admin.from("accounts").select("id", { count: "exact", head: true }).eq("type", "builder").eq("plan_id", "starter"),
      admin.from("accounts").select("id", { count: "exact", head: true }).eq("type", "builder").eq("plan_id", "pro"),
      admin.from("ai_usage_events").select("estimated_cost_usd").gte("created_at", iso(range.from)),
      admin.from("ai_usage_events").select("estimated_cost_usd").gte("created_at", iso(monthStart(now))),
      admin.rpc("admin_traffic_totals", { p_from: iso(range.from), p_to: iso(range.to) }),
      admin.rpc("admin_traffic_totals", { p_from: iso(before.from), p_to: iso(before.to) }),
      Promise.all(months.map((m) => payoutSheet(m).catch(() => null))),
      admin.from("app_events").select("name, occurred_at, profile_id, props").order("occurred_at", { ascending: false }).limit(20),
    ])

  // ── Alarm row ─────────────────────────────────────────────────────────
  const live = (alertsRes.data ?? []) as unknown as { alert_rules: { severity: string } | null }[]
  const bySeverity = (s: string) => live.filter((a) => a.alert_rules?.severity === s).length

  // ── Reports, fills, cohort ────────────────────────────────────────────
  const reports = (reportsRes.data ?? []) as { id: string; mission_id: string; created_at: string }[]
  const missions = (missionsRes.data ?? []) as { id: string; title: string; created_at: string; testers_needed: number | null }[]
  const times = new Map<string, string[]>()
  for (const r of reports) times.set(r.mission_id, [...(times.get(r.mission_id) ?? []), r.created_at])
  const filled = fills(missions.map((m) => ({ id: m.id, createdAt: m.created_at, testersNeeded: m.testers_needed })), times)
  const inRange = (at: string) => at >= iso(range.from) && at < iso(range.to)
  const fillMs = filled.filter((f) => inRange(f.at)).map((f) => f.ms)
  const fillByMonth = months.map((m) => median(filled.filter((f) => monthOf(new Date(f.at)) === m).map((f) => f.ms)))

  const delivered = reports.filter((r) => inRange(r.created_at)).length
  const reportsByMonth = months.map((m) => reports.filter((r) => monthOf(new Date(r.created_at)) === m).length)
  const capacity = capacityFor(range.days)

  const cohortCost = months.map((_, i) => sheets[i]?.totalNgn ?? null)
  const payable = months.map((_, i) => (sheets[i] ? sheets[i]!.rows.reduce((n, r) => n + r.payable, 0) : null))
  const share = months.map((_, i) => (payable[i] !== null && reportsByMonth[i] > 0 ? Math.round((payable[i]! / reportsByMonth[i]) * 100) : null))
  const monthIdx = months.indexOf(thisMonth)

  // ── Paying builders ───────────────────────────────────────────────────
  const subs = (subsRes.data ?? []) as Pick<Subscription, "plan_id" | "status" | "period_start" | "period_end" | "amount_ngn" | "ended_at">[]
  const paidAt = (end: Date) =>
    paidReportsSold(
      subs
        .filter((s) => s.status !== "scheduled" && s.plan_id !== "community" && Date.parse(s.period_start) < end.getTime() && (!s.ended_at || Date.parse(s.ended_at) >= end.getTime()))
        .reduce<Record<string, number>>((c, s) => ({ ...c, [s.plan_id]: (c[s.plan_id] ?? 0) + 1 }), {}),
      (p) => planFor(planIdFor(p)).monthlyReports,
    )
  const paidByMonth = months.map((m, i) => paidAt(i === months.length - 1 ? now : new Date(`${months[i + 1]}T00:00:00+01:00`)))
  const starter = starterRes.count ?? 0
  const pro = proRes.count ?? 0
  const paidNow = paidReportsSold({ starter, pro }, (p) => planFor(planIdFor(p)).monthlyReports)

  // ── Money ─────────────────────────────────────────────────────────────
  const sum = (rows: { estimated_cost_usd: number | string | null }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0)
  const aiRangeUsd = sum(aiRangeRes.data)
  const aiMonthUsd = sum(aiMonthRes.data)
  const revenue = mrr(subs.filter((s) => s.status === "active"))
  const cohortThisMonth = cohortCost[monthIdx] ?? 0
  const costs = cohortThisMonth + usdToNgn(aiMonthUsd + INFRA_USD_MONTHLY)
  const margin = revenue > 0 ? `${Math.round(((revenue - costs) / revenue) * 100)}%` : "—"

  // ── Traffic ───────────────────────────────────────────────────────────
  type Totals = { visitors: number; sessions: number; views: number; signups: number }
  const t = ((trafficNow.data as Totals[] | null)?.[0] ?? { visitors: 0, sessions: 0, views: 0, signups: 0 }) as Totals
  const p = ((trafficBefore.data as Totals[] | null)?.[0] ?? { visitors: 0, sessions: 0, views: 0, signups: 0 }) as Totals
  const conv = (x: Totals) => (Number(x.visitors) > 0 ? Number(x.signups) / Number(x.visitors) : 0)

  // ── Live activity ─────────────────────────────────────────────────────
  const items: Feed[] = []
  if (feed === "all" || feed === "events") {
    for (const e of eventsRes.data ?? []) {
      items.push({ at: e.occurred_at, kind: "event", text: e.name, href: e.profile_id ? `/admin/accounts/${e.profile_id}` : undefined })
    }
  }
  if (feed === "all" || feed === "reports") {
    const title = new Map(missions.map((m) => [m.id, m.title]))
    for (const r of reports.slice(0, 20)) items.push({ at: r.created_at, kind: "report", text: `Report filed${title.get(r.mission_id) ? ` on ${title.get(r.mission_id)}` : ""}`, href: `/admin/missions/${r.mission_id}` })
  }
  if (feed === "all" || feed === "signups") {
    const { data } = await admin.rpc("admin_account_list", { p_limit: 20, p_offset: 0 })
    for (const u of (data ?? []) as { id: string; full_name: string | null; email: string | null; created_at: string }[]) {
      items.push({ at: u.created_at, kind: "signup", text: `${u.full_name || u.email || "Someone"} signed up`, href: `/admin/accounts/${u.id}` })
    }
  }
  const activity = items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20)

  const q = (over: Record<string, string>) => {
    const params = new URLSearchParams({ range: range.key, feed, ...over })
    if (params.get("range") === "30") params.delete("range")
    if (params.get("feed") === "all") params.delete("feed")
    const s = params.toString()
    return s ? `/admin?${s}` : "/admin"
  }
  const chip = (active: boolean) =>
    cn("h-12 lg:h-10 px-4 flex items-center rounded-[8px] border font-mono text-[14px] whitespace-nowrap", active ? "border-accent-ink text-accent-ink" : "border-line text-ink-muted hover:text-ink")
  const labels = months.map(shortMonth)

  return (
    <div className="max-w-[1200px] mx-auto px-4 expanded:px-6 py-8">
      <PageHeader eyebrow="Overview" title="Overview" lede="The alarms, then whether Twnhall is working. Times are Lagos time.">
        <nav aria-label="Date range" className="flex gap-2 overflow-x-auto">
          {RANGES.map(([k, label]) => (
            <Link key={k} href={q({ range: k })} aria-current={range.key === k ? "page" : undefined} className={chip(range.key === k)}>
              {label}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <h2 className="sr-only">Alarms</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Critical" value={bySeverity("critical")} alarm={bySeverity("critical") > 0} href="/admin/alerts" />
        <Stat label="Warning" value={bySeverity("warning")} alarm={bySeverity("warning") > 0} href="/admin/alerts" />
        <Stat label="Info" value={bySeverity("info")} href="/admin/alerts" />
      </div>

      <h2 className="font-syne font-bold text-[20px] leading-[28px] text-ink mb-4">Is it working · {range.label.toLowerCase()}</h2>
      <div className="grid grid-cols-1 medium:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Stat
          label="Time to fill"
          value={formatDuration(median(fillMs))}
          decision={`p95 ${formatDuration(percentile(fillMs, 0.95))}. If the median is in weeks, stop selling until supply catches up.`}
        >
          <Sparkline values={fillByMonth.map((v) => (v === null ? null : Math.round(v / 3_600_000)))} labels={labels} />
        </Stat>
        <Stat label="Reports vs capacity" value={`${delivered} / ${capacity}`} decision="Low: supply nobody is buying. Near full: stop selling before builders wait.">
          <Sparkline values={reportsByMonth} labels={labels} />
        </Stat>
        <Stat label="Cohort cost · this month" value={formatNgn(cohortThisMonth)} decision="The largest variable cost, paid from the bank. Compare to MRR.">
          <Sparkline values={cohortCost} labels={labels} />
        </Stat>
        <Stat label="Cohort-served share" value={share[monthIdx] === null ? "—" : `${share[monthIdx]}%`} decision="Of this month's reports, paid for. Trending to zero means the cohort can wind down.">
          <Sparkline values={share} labels={labels} />
        </Stat>
        <Stat
          label="Paid reports vs break-even"
          value={`${paidNow} / ${BREAK_EVEN_REPORTS}`}
          decision={`${starter} Starter · ${pro} Pro. Break-even is ${BREAK_EVEN_REPORTS} paid reports a month.`}
        >
          <Sparkline values={paidByMonth} labels={labels} />
        </Stat>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Panel title="Traffic" action={<Link href="/admin/traffic" className="font-mono text-[14px] text-accent-ink underline underline-offset-4">Traffic</Link>}>
          <div className="grid grid-cols-3 gap-4 p-4">
            <Stat label="Visitors" value={Number(t.visitors)} decision={`${change(Number(t.visitors), Number(p.visitors))} vs before`} />
            <Stat label="Signups" value={Number(t.signups)} decision={`${change(Number(t.signups), Number(p.signups))} vs before`} />
            <Stat label="Visitor → signup" value={ratio(Number(t.signups), Number(t.visitors))} decision={`was ${(conv(p) * 100).toFixed(0)}%`} />
          </div>
        </Panel>
        <Panel title="Money · this month">
          <div className="grid grid-cols-2 expanded:grid-cols-4 gap-4 p-4">
            <Stat label="MRR" value={formatNgn(revenue)} />
            <Stat label="AI spend" value={`$${aiMonthUsd.toFixed(2)}`} decision={`${range.label}: $${aiRangeUsd.toFixed(2)}`} />
            <Stat label="Cohort cost" value={formatNgn(cohortThisMonth)} />
            <Stat label="Gross margin" value={margin} decision={`After cohort, AI and $${INFRA_USD_MONTHLY} infra at ₦${FX.ngnPerUsd.toLocaleString("en-NG")} = $1 (${FX.checked}).`} />
          </div>
        </Panel>
      </div>

      <Panel
        title="Live activity"
        action={
          <nav aria-label="Activity filter" className="flex gap-2 overflow-x-auto">
            {FEEDS.map(([k, label]) => (
              <Link key={k} href={q({ feed: k })} aria-current={feed === k ? "page" : undefined} className={chip(feed === k)}>
                {label}
              </Link>
            ))}
          </nav>
        }
      >
        {activity.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <ul>
            {activity.map((a, i) => (
              <li key={i} className="flex gap-4 border-t border-line first:border-t-0 px-4 py-3 font-mono text-[14px]">
                <span className="w-[120px] shrink-0 text-ink-muted tabular-nums">{formatDateTime(a.at)}</span>
                <span className="w-[72px] shrink-0 text-ink-muted">{a.kind}</span>
                {a.href ? <Link href={a.href} className="min-w-0 truncate text-ink underline-offset-4 hover:underline">{a.text}</Link> : <span className="min-w-0 truncate">{a.text}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
