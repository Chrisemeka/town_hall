import { requireAdmin } from "@/lib/auth"
import { PageHeader, Panel, Stat } from "@/components/admin/ui"
import { RangeNav, CountTable } from "@/components/admin/RangeNav"
import { SignupsChart } from "@/components/admin/SignupsChart"
import { change, previous, ratio } from "@/lib/metrics"

export const metadata = { title: "Traffic — Admin · Twnhall" }

// First-party page views (Phase 0's page_views, then traffic_daily beyond 90
// days). Bots, /admin and admin profiles are never counted.

const DAY = 24 * 60 * 60 * 1000
const RANGES = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"]] as const

type Day = { day: string; visitors: number; views: number; sessions: number; signups: number }
type Row = { key: string; visitors: number; views: number }
type Source = { source: string; visitors: number; signups: number }

export default async function AdminTrafficPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { admin } = await requireAdmin()
  const { range: raw } = await searchParams
  const key = RANGES.some(([k]) => k === raw) ? raw! : "30"
  const days = Number(key)
  const to = new Date()
  const from = new Date(to.getTime() - days * DAY)
  const before = previous({ key, label: "", from, to, days })
  const iso = (d: Date) => d.toISOString()

  const dims = ["path", "referrer", "utm", "country", "device"] as const
  const [dailyRes, nowRes, beforeRes, sourcesRes, ...breakdowns] = await Promise.all([
    admin.rpc("admin_traffic_daily", { p_from: iso(from), p_to: iso(to) }),
    admin.rpc("admin_traffic_totals", { p_from: iso(from), p_to: iso(to) }),
    admin.rpc("admin_traffic_totals", { p_from: iso(before.from), p_to: iso(before.to) }),
    admin.rpc("admin_conversion_by_source", { p_from: iso(from), p_to: iso(to) }),
    ...dims.map((d) => admin.rpc("admin_traffic_breakdown", { p_from: iso(from), p_to: iso(to), p_dim: d, p_limit: 10 })),
  ])

  const daily = ((dailyRes.data ?? []) as Day[]).map((d) => ({ ...d, visitors: Number(d.visitors), views: Number(d.views), sessions: Number(d.sessions), signups: Number(d.signups) }))
  type Totals = { visitors: number; sessions: number; views: number; signups: number }
  const zero: Totals = { visitors: 0, sessions: 0, views: 0, signups: 0 }
  const exact = (res: { data: unknown }) => {
    const t = (res.data as Totals[] | null)?.[0] ?? zero
    return { visitors: Number(t.visitors), sessions: Number(t.sessions), views: Number(t.views), signups: Number(t.signups) }
  }
  // Exact distinct counts while the raw views exist; past 90 days, the sum of
  // daily totals, which counts a returning visitor once per day.
  const total =
    days <= 90
      ? exact(nowRes)
      : daily.reduce((t, d) => ({ visitors: t.visitors + d.visitors, views: t.views + d.views, sessions: t.sessions + d.sessions, signups: t.signups + d.signups }), zero)
  const prev = exact(beforeRes)
  const table = (i: number) => ((breakdowns[i].data ?? []) as Row[]).map((r) => ({ key: r.key, a: Number(r.visitors), b: Number(r.views) }))
  const sources = ((sourcesRes.data ?? []) as Source[]).map((s) => ({ key: s.source, a: Number(s.visitors), b: Number(s.signups) }))

  return (
    <div className="max-w-[1200px] mx-auto px-4 expanded:px-6 py-8">
      <PageHeader eyebrow="Traffic" title="Traffic" lede="First-party page views — no third-party script. Bots, the console and admins are not counted.">
        <RangeNav base="/admin/traffic" current={key} options={RANGES} />
      </PageHeader>

      <div className="grid grid-cols-2 expanded:grid-cols-4 gap-4 mb-8">
        <Stat label="Visitors" value={total.visitors} decision={`${change(total.visitors, Number(prev.visitors))} vs the period before`} />
        <Stat label="Sessions" value={total.sessions} decision={`${change(total.sessions, Number(prev.sessions))} vs before`} />
        <Stat label="Page views" value={total.views} decision={`${change(total.views, Number(prev.views))} vs before`} />
        <Stat label="Visitor → signup" value={ratio(total.signups, total.visitors)} decision={`${total.signups} signups. Falling: look at the signup path before buying traffic.`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <SignupsChart data={daily.map((d) => ({ date: d.day, count: d.visitors }))} title="Visitors" subtitle="Per day, Lagos time." />
        <SignupsChart data={daily.map((d) => ({ date: d.day, count: d.signups }))} title="Signups" subtitle="New accounts per day." />
      </div>

      {days > 90 && (
        <p className="mb-4 font-mono text-[14px] text-ink-muted">
          Past 90 days only daily totals per page are kept: the visitor total counts a returning visitor once per day, and the tables below cover the last 90 days.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Signups by source"><CountTable rows={sources} head={["Source", "Visitors", "Signups"]} /></Panel>
        <Panel title="Top pages"><CountTable rows={table(0)} head={["Page", "Visitors", "Views"]} /></Panel>
        <Panel title="Referrers"><CountTable rows={table(1)} head={["Site", "Visitors", "Views"]} /></Panel>
        <Panel title="Campaigns (UTM)"><CountTable rows={table(2)} head={["Source / medium / campaign", "Visitors", "Views"]} empty="No tagged links yet." /></Panel>
        <Panel title="Countries"><CountTable rows={table(3)} head={["Country", "Visitors", "Views"]} /></Panel>
        <Panel title="Devices"><CountTable rows={table(4)} head={["Device", "Visitors", "Views"]} /></Panel>
      </div>
    </div>
  )
}
