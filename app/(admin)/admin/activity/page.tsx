import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { PageHeader, Panel, Stat, Empty, formatDateTime } from "@/components/admin/ui"
import { RangeNav } from "@/components/admin/RangeNav"
import { EVENT_NAMES } from "@/lib/events"
import { formatDuration, ratio } from "@/lib/metrics"

export const metadata = { title: "Activity — Admin · Twnhall" }

// Admin Metrics §6–§8 and §10: the gate chain as a funnel, activation and
// time to first value, retention, quality, and every recorded event.

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const RANGES = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"]] as const
const PAGE = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Search = { range?: string; event?: string; user?: string; from?: string; to?: string; page?: string }

const n = (v: unknown) => Number(v ?? 0)
const first = <T,>(res: { data: unknown }): Partial<T> => ((res.data as T[] | null)?.[0] ?? {}) as Partial<T>

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { admin } = await requireAdmin()
  const sp = await searchParams
  const key = RANGES.some(([k]) => k === sp.range) ? sp.range! : "30"
  const to = new Date()
  const from = new Date(to.getTime() - Number(key) * DAY)
  const args = { p_from: from.toISOString(), p_to: to.toISOString() }

  const [funnelRes, activationRes, summaryRes, cohortsRes, qualityRes] = await Promise.all([
    admin.rpc("admin_funnel", args),
    admin.rpc("admin_activation", args),
    admin.rpc("admin_retention_summary"),
    admin.rpc("admin_retention_cohorts", { p_months: 6 }),
    admin.rpc("admin_quality", args),
  ])
  const f = first<Record<string, number>>(funnelRes)
  const a = first<Record<string, number | null>>(activationRes)
  const r = first<Record<string, number>>(summaryRes)
  const q = first<Record<string, number | string | null>>(qualityRes)
  const cohorts = (cohortsRes.data ?? []) as { month: string; signups: number; m1: number; m2: number; m3: number }[]

  const steps: [string, number][] = [
    ["Visited", n(f.visitors)],
    ["Signed up", n(f.signups)],
    ["Confirmed email", n(f.confirmed)],
    ["Accepted terms", n(f.terms)],
    ["Chose an account", n(f.account)],
    ["Verified", n(f.verified)],
    ["First action", n(f.first_action)],
  ]

  // ── Event explorer ────────────────────────────────────────────────────
  const event = (EVENT_NAMES as readonly string[]).includes(sp.event ?? "") ? sp.event : undefined
  const page = Math.max(1, Number(sp.page) || 1)
  let userId: string | null = null
  if (sp.user?.trim()) {
    const u = sp.user.trim()
    if (UUID.test(u)) userId = u
    else {
      const { data } = await admin.from("profiles").select("id").ilike("email", u).limit(1).maybeSingle()
      userId = (data?.id as string | undefined) ?? "00000000-0000-0000-0000-000000000000"
    }
  }
  let events = admin.from("app_events").select("id, name, occurred_at, profile_id, account_type, subject_type, subject_id, props", { count: "exact" })
  if (event) events = events.eq("name", event)
  if (userId) events = events.eq("profile_id", userId)
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) events = events.gte("occurred_at", `${sp.from}T00:00:00+01:00`)
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) events = events.lte("occurred_at", `${sp.to}T23:59:59+01:00`)
  const { data: rows, count } = await events.order("occurred_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
  const pageHref = (p: number) => {
    const params = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter((e): e is [string, string] => !!e[1]))
    return `/admin/activity?${params}#events`
  }

  const input = "h-12 lg:h-10 rounded-[8px] border border-ink-muted bg-surface px-3 font-mono text-[14px] text-ink focus:outline-none focus:border-accent-ink"
  const ratings = [n(q.r1), n(q.r2), n(q.r3), n(q.r4), n(q.r5)]
  const maxRating = Math.max(1, ...ratings)
  const entries = n(q.pass) + n(q.fail) + n(q.blocked)

  return (
    <div className="max-w-[1200px] mx-auto px-4 expanded:px-6 py-8">
      <PageHeader eyebrow="Activity" title="Activity" lede="Who gets through the gates, who comes back, and whether the reports are any good.">
        <RangeNav base="/admin/activity" current={key} options={RANGES} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Panel title="Signup funnel">
          <p className="px-4 pt-4 font-mono text-[12px] text-ink-muted">Everyone who signed up in the range, and how far each got. One step is losing more people than the rest.</p>
          <ol className="p-4 flex flex-col gap-2">
            {steps.map(([label, value], i) => {
              const prev = i > 0 ? steps[i - 1][1] : value
              return (
                <li key={label} className="font-mono text-[14px]">
                  <span className="flex justify-between gap-4">
                    <span>{label}</span>
                    <span className="tabular-nums">
                      {value}
                      {i > 0 && <span className="text-ink-muted"> · {ratio(value, prev)} of the step before</span>}
                    </span>
                  </span>
                  <span aria-hidden="true" className="mt-1 block h-2 rounded-full bg-ink/[0.06]">
                    <span className="block h-2 rounded-full bg-voltage" style={{ width: `${steps[0][1] ? Math.round((value / Math.max(1, steps[0][1])) * 100) : 0}%` }} />
                  </span>
                </li>
              )
            })}
          </ol>
        </Panel>

        <Panel title="Activation and time to first value">
          <div className="grid grid-cols-1 medium:grid-cols-2 gap-4 p-4">
            <div className="flex flex-col gap-2 font-mono text-[14px]">
              <p className="font-syne font-bold text-[16px]">Builders</p>
              <p>Signed up: {n(a.b_signups)}</p>
              <p>Created a project: {n(a.b_project)} ({ratio(n(a.b_project), n(a.b_signups))})</p>
              <p>Published a test case: {n(a.b_published)} ({ratio(n(a.b_published), n(a.b_signups))})</p>
              <p>Received a first report: {n(a.b_first_report)} ({ratio(n(a.b_first_report), n(a.b_signups))})</p>
              <p className="text-ink-muted">Median signup → first report: {formatDuration(a.b_median_hours == null ? null : Number(a.b_median_hours) * HOUR)}</p>
            </div>
            <div className="flex flex-col gap-2 font-mono text-[14px]">
              <p className="font-syne font-bold text-[16px]">Testers</p>
              <p>Signed up: {n(a.t_signups)}</p>
              <p>Verified: {n(a.t_verified)} ({ratio(n(a.t_verified), n(a.t_signups))})</p>
              <p>Filed a first report: {n(a.t_first_report)} ({ratio(n(a.t_first_report), n(a.t_signups))})</p>
              <p className="text-ink-muted">Median signup → first report: {formatDuration(a.t_median_hours == null ? null : Number(a.t_median_hours) * HOUR)}</p>
            </div>
          </div>
        </Panel>
      </div>

      <h2 className="font-syne font-bold text-[20px] leading-[28px] text-ink mb-4">Retention</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Second test case" value={ratio(n(r.builders_second_mission), n(r.builders_with_mission))} decision={`${n(r.builders_second_mission)} of ${n(r.builders_with_mission)} builders. Two is a habit.`} />
        <Stat label="Second report" value={ratio(n(r.testers_second_report), n(r.testers_with_report))} decision={`${n(r.testers_second_report)} of ${n(r.testers_with_report)} testers.`} />
        <Stat label="Monthly active" value={`${n(r.mau_builders)} · ${n(r.mau_testers)}`} decision="Builders · testers seen in 30 days. The number that can go down." />
        <Stat label="Cohort active · 30 days" value={`${n(r.cohort_active_30d)} / ${n(r.cohort_members)}`} decision="Paid testers who filed anything. Trained but idle is a supply illusion." />
      </div>
      <Panel title="Signup cohorts" className="mb-8">
        {cohorts.length === 0 ? (
          <Empty>No signups in the last six months.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] font-mono text-[14px]">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-[1px] text-ink-muted">
                  <th className="px-4 py-2 font-medium">Signed up</th>
                  <th className="px-4 py-2 font-medium text-right">People</th>
                  <th className="px-4 py-2 font-medium text-right">Month 1</th>
                  <th className="px-4 py-2 font-medium text-right">Month 2</th>
                  <th className="px-4 py-2 font-medium text-right">Month 3</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.month} className="border-t border-line">
                    <td className="px-4 py-2">{new Date(`${c.month}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{n(c.signups)}</td>
                    {[c.m1, c.m2, c.m3].map((m, i) => (
                      <td key={i} className="px-4 py-2 text-right tabular-nums">{ratio(n(m), n(c.signups))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <h2 className="font-syne font-bold text-[20px] leading-[28px] text-ink mb-4">Quality</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Panel title="Ratings">
          <p className="px-4 pt-4 font-mono text-[12px] text-ink-muted">Reports filed in the range. The shape sets the cut-off (compensation doc §10).</p>
          <ul className="p-4 flex flex-col gap-2">
            {ratings.map((count, i) => (
              <li key={i} className="flex items-center gap-2 font-mono text-[14px]">
                <span className="w-16 shrink-0">{i + 1} of 5</span>
                <span aria-hidden="true" className="h-2 flex-1 rounded-full bg-ink/[0.06]">
                  <span className="block h-2 rounded-full bg-voltage" style={{ width: `${Math.round((count / maxRating) * 100)}%` }} />
                </span>
                <span className="w-12 text-right tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <Stat label="Waiting on review" value={n(q.pending)} decision={`Median wait ${q.pending_median_days == null ? "—" : `${Number(q.pending_median_days).toFixed(1)} days`}, oldest ${formatDateTime(q.pending_oldest as string | null)}. Weeks means no quality gate.`} alarm={n(q.pending_median_days) > 14} />
          <Stat label="Approved" value={ratio(n(q.approved), n(q.filed))} decision={`${n(q.approved)} of ${n(q.filed)} filed in the range.`} />
          <Stat
            label="Pass · fail · blocked"
            value={`${ratio(n(q.pass), entries)} · ${ratio(n(q.fail), entries)} · ${ratio(n(q.blocked), entries)}`}
            decision="All-pass means test cases too easy to be worth anything."
          />
          <Stat
            label="Time per report"
            value={q.median_minutes == null ? "—" : `${Math.round(Number(q.median_minutes))} min`}
            decision={`Median of ${n(q.timed)} timed reports. The cost model assumes ~40.`}
          />
        </div>
      </div>

      <Panel title="Event explorer">
        <form id="events" method="get" className="grid grid-cols-1 medium:grid-cols-2 lg:grid-cols-5 gap-2 p-4">
          <input type="hidden" name="range" value={key} />
          <label className="sr-only" htmlFor="ev-name">Event</label>
          <select id="ev-name" name="event" defaultValue={event ?? ""} className={input}>
            <option value="">Every event</option>
            {EVENT_NAMES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <label className="sr-only" htmlFor="ev-user">Email or profile id</label>
          <input id="ev-user" name="user" defaultValue={sp.user} placeholder="Email or profile id" className={input} />
          <label className="sr-only" htmlFor="ev-from">From</label>
          <input id="ev-from" name="from" type="date" defaultValue={sp.from} className={input} />
          <label className="sr-only" htmlFor="ev-to">To</label>
          <input id="ev-to" name="to" type="date" defaultValue={sp.to} className={input} />
          <button type="submit" className="h-12 lg:h-10 rounded-[8px] border border-ink-muted font-mono text-[14px] hover:bg-ink/[0.06]">Filter</button>
        </form>
        {(rows ?? []).length === 0 ? (
          <Empty>No events match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] font-mono text-[14px]">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-[1px] text-ink-muted">
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Who</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((e) => (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="px-4 py-2 whitespace-nowrap text-ink-muted">{formatDateTime(e.occurred_at)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{e.name}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {e.profile_id ? <Link href={`/admin/accounts/${e.profile_id}`} className="text-accent-ink underline underline-offset-4">{e.account_type ?? "account"}</Link> : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="px-4 py-2 max-w-0 w-full truncate text-ink-muted" title={JSON.stringify(e.props)}>{JSON.stringify(e.props)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Event pages" className="flex justify-between border-t border-line px-4 py-3 font-mono text-[14px]">
            {page > 1 ? <Link className="text-accent-ink underline underline-offset-4" href={pageHref(page - 1)}>Previous</Link> : <span />}
            <span className="text-ink-muted">Page {page} of {pages}</span>
            {page < pages ? <Link className="text-accent-ink underline underline-offset-4" href={pageHref(page + 1)}>Next</Link> : <span />}
          </nav>
        )}
      </Panel>
    </div>
  )
}
