import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { Avatar } from "@/components/ui/Avatar"
import { PageHeader, Panel, Stat, Tag, Empty, formatDate } from "@/components/admin/ui"
import { planFor } from "@/lib/plans"
import { planIdFor, PLAN_IDS } from "@/lib/vocabulary"
import { formatNgn, mrr } from "@/lib/subscriptions"

export const metadata = { title: "Accounts — Admin · Twnhall" }

const PAGE = 50

type Row = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  role: string | null
  moderation_status: string
  banned_until: string | null
  created_at: string
  last_sign_in_at: string | null
  has_builder: boolean
  has_tester: boolean
  plan_id: string | null
  cohort_member: boolean
  projects: number
  reports_filed: number
  total: number
}

type Search = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined
const int = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : undefined)

const FILTERS = {
  role: [["", "Any role"], ["builder", "Builder"], ["tester", "Tester"], ["admin", "Admin"]],
  plan: [["", "Any plan"], ...PLAN_IDS.map((id) => [id, planFor(id).name])],
  cohort: [["", "Cohort: any"], ["yes", "In cohort"], ["no", "Not in cohort"]],
  moderation: [["", "Any status"], ["active", "Active"], ["suspended", "Suspended"], ["banned", "Banned"]],
  joined: [["", "Joined: any time"], ["7", "Joined · 7 days"], ["30", "Joined · 30 days"], ["90", "Joined · 90 days"]],
  active: [["", "Signed in: any time"], ["7", "Signed in · 7 days"], ["30", "Signed in · 30 days"]],
} as const

export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { admin } = await requireAdmin()
  const sp = await searchParams
  const q = one(sp.q)?.trim().slice(0, 100)
  const f = {
    role: one(sp.role),
    plan: one(sp.plan),
    cohort: one(sp.cohort),
    moderation: one(sp.moderation),
    joined: one(sp.joined),
    active: one(sp.active),
  }
  const page = Math.max(1, int(one(sp.page)) ?? 1)

  // Async Server Component, once per request: reading the clock is the intent.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const weekAhead = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [list, community, starter, pro, activeSubs, expiring] = await Promise.all([
    admin.rpc("admin_account_list", {
      p_q: q || null,
      p_role: f.role ?? null,
      p_plan: f.plan ?? null,
      p_cohort: f.cohort === "yes" ? true : f.cohort === "no" ? false : null,
      p_moderation: f.moderation ?? null,
      p_signed_up_days: int(f.joined) ?? null,
      p_active_days: int(f.active) ?? null,
      p_limit: PAGE,
      p_offset: (page - 1) * PAGE,
    }),
    admin.from("accounts").select("id", { count: "exact", head: true }).eq("type", "builder").is("plan_id", null),
    admin.from("accounts").select("id", { count: "exact", head: true }).eq("type", "builder").eq("plan_id", "starter"),
    admin.from("accounts").select("id", { count: "exact", head: true }).eq("type", "builder").eq("plan_id", "pro"),
    admin.from("subscriptions").select("amount_ngn, period_start, period_end").eq("status", "active"),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("period_end", weekAhead),
  ])

  const rows = (list.data ?? []) as Row[]
  const total = rows[0]?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const monthly = mrr((activeSubs.data ?? []) as { amount_ngn: number | null; period_start: string; period_end: string | null }[])

  const href = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, ...f, page, ...over })) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v))
    const s = params.toString()
    return s ? `/admin/accounts?${s}` : "/admin/accounts"
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 expanded:px-6 py-8">
      <PageHeader eyebrow="Accounts" title="Accounts" lede="Everyone on Twnhall, their plan and their standing. Open an account to change its plan, cohort or status." />

      <div className="grid grid-cols-2 expanded:grid-cols-5 gap-4 mb-8">
        <Stat label="Community" value={community.count ?? "—"} href={href({ plan: "community", page: 1 })} />
        <Stat label="Starter" value={starter.count ?? "—"} href={href({ plan: "starter", page: 1 })} />
        <Stat label="Pro" value={pro.count ?? "—"} href={href({ plan: "pro", page: 1 })} />
        <Stat label="MRR" value={formatNgn(monthly)} decision="What builders actually paid, per month — not list price." />
        <Stat label="Expiring · 7 days" value={expiring.count ?? "—"} decision="Renew or let lapse before the cron does it." />
      </div>

      <form method="get" className="mb-4 grid grid-cols-1 medium:grid-cols-2 expanded:grid-cols-4 lg:grid-cols-8 gap-2">
        <label className="sr-only" htmlFor="q">Search by name or email</label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Name or email"
          className="h-12 lg:h-10 rounded-[8px] border border-ink-muted bg-surface px-3 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent-ink lg:col-span-2"
        />
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((key) => (
          <select
            key={key}
            name={key}
            aria-label={FILTERS[key][0][1]}
            defaultValue={f[key] ?? ""}
            className="h-12 lg:h-10 rounded-[8px] border border-ink-muted bg-surface px-2 font-mono text-[14px] text-ink focus:outline-none focus:border-accent-ink"
          >
            {FILTERS[key].map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        ))}
        <button type="submit" className="h-12 lg:h-10 rounded-[8px] border border-ink-muted font-mono text-[14px] text-ink hover:bg-ink/[0.06]">
          Filter
        </button>
      </form>

      <Panel title={`${total} account${total === 1 ? "" : "s"}`} action={<span className="font-mono text-[12px] text-ink-muted">Page {page} of {pages}</span>}>
        {list.error ? (
          <Empty>Could not load accounts: {list.error.message}</Empty>
        ) : rows.length === 0 ? (
          <Empty>No accounts match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="text-left font-mono text-[12px] uppercase tracking-[1px] text-ink-muted">
                  <th className="px-4 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">Accounts</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Last sign-in</th>
                  <th className="px-4 py-3 font-medium text-right">Projects</th>
                  <th className="px-4 py-3 font-medium text-right">Reports filed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-line hover:bg-ink/[0.06] transition-colors duration-150">
                    <td className="px-4 py-3">
                      <Link href={`/admin/accounts/${u.id}`} className="flex items-center gap-3 min-w-0">
                        <Avatar src={u.avatar_url} name={u.full_name ?? ""} email={u.email ?? ""} size={8} />
                        <span className="min-w-0">
                          <span className="block font-mono text-[14px] text-ink truncate underline-offset-4 hover:underline">{u.full_name || u.email || "—"}</span>
                          {u.full_name && <span className="block font-mono text-[12px] text-ink-muted truncate">{u.email}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-1">
                        {u.role === "admin" && <Tag tone="accent">Admin</Tag>}
                        {u.has_builder && <Tag tone="info">Builder</Tag>}
                        {u.has_tester && <Tag>Tester</Tag>}
                        {u.cohort_member && <Tag tone="success">Cohort</Tag>}
                        {!u.has_builder && !u.has_tester && u.role !== "admin" && <span className="font-mono text-[12px] text-ink-muted">None yet</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[14px] text-ink">{u.has_builder ? planFor(planIdFor(u.plan_id)).name : "—"}</td>
                    <td className="px-4 py-3">
                      {u.moderation_status === "active" ? (
                        <span className="font-mono text-[14px] text-ink-muted">Active</span>
                      ) : (
                        <Tag tone="danger">{u.moderation_status}</Tag>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[14px] text-ink-muted whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-[14px] text-ink-muted whitespace-nowrap">{formatDate(u.last_sign_in_at)}</td>
                    <td className="px-4 py-3 font-mono text-[14px] text-ink text-right tabular-nums">{u.projects}</td>
                    <td className="px-4 py-3 font-mono text-[14px] text-ink text-right tabular-nums">{u.reports_filed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="flex justify-between border-t border-line px-4 py-3 font-mono text-[14px]">
            {page > 1 ? <Link className="text-accent-ink underline underline-offset-4" href={href({ page: page - 1 })}>Previous</Link> : <span />}
            {page < pages ? <Link className="text-accent-ink underline underline-offset-4" href={href({ page: page + 1 })}>Next</Link> : <span />}
          </nav>
        )}
      </Panel>
    </div>
  )
}
