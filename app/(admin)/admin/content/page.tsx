import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { PageHeader, Panel, Tag, Empty, formatDate } from "@/components/admin/ui"
import { ProjectRowActions } from "@/components/admin/ProjectRowActions"
import { SubmissionsList, normalizeSentiment, type SubmissionRow } from "@/components/admin/SubmissionsList"
import type { SubmissionEntry } from "@/components/submissions/SubmissionBody"
import { screenshotList } from "@/lib/utils/screenshots"
import { cn } from "@/lib/utils"

export const metadata = { title: "Content — Admin · Twnhall" }

// Projects, test cases and reports: one page, one server-paginated table per
// tab, counted per row by PostgREST rather than by loading whole tables. The
// moderation actions and the mission detail page are the same as before.
// Admins see real names here, by decision (CLAUDE.md, Tester anonymity).

const PAGE = 50
const TABS = [["projects", "Projects"], ["cases", "Test cases"], ["reports", "Reports"]] as const
type Tab = (typeof TABS)[number][0]
type Search = { tab?: string; q?: string; page?: string; flagged?: string }

type ProjectRow = {
  id: string
  name: string
  app_url: string | null
  created_at: string
  flagged_at: string | null
  flag_reason: string | null
  owner_id: string | null
  missions: { id: string; test_results: { count: number }[] }[]
}
type CaseRow = {
  id: string
  title: string
  created_at: string
  is_active: boolean | null
  testers_needed: number | null
  projects: { id: string; name: string; owner_id: string | null } | null
  test_results: { count: number }[]
}

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { admin } = await requireAdmin()
  const sp = await searchParams
  const tab: Tab = TABS.some(([t]) => t === sp.tab) ? (sp.tab as Tab) : "projects"
  const q = sp.q?.trim().slice(0, 100) || undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const span = [(page - 1) * PAGE, page * PAGE - 1] as const
  // PostgREST's ilike pattern: escape the wildcards a search could carry.
  const like = q ? `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%` : undefined

  let total = 0
  let body: React.ReactNode

  const owners = async (ids: (string | null | undefined)[]) => {
    const unique = [...new Set(ids.filter(Boolean))] as string[]
    if (!unique.length) return new Map<string, string>()
    const { data } = await admin.from("profiles").select("id, full_name, email").in("id", unique)
    return new Map((data ?? []).map((p) => [p.id as string, (p.full_name || p.email || "—") as string]))
  }

  if (tab === "projects") {
    let query = admin
      .from("projects")
      .select("id, name, app_url, created_at, flagged_at, flag_reason, owner_id, missions(id, test_results(count))", { count: "exact" })
    if (like) query = query.ilike("name", like)
    if (sp.flagged === "1") query = query.not("flagged_at", "is", null)
    const { data, count } = await query.order("created_at", { ascending: false }).range(...span)
    total = count ?? 0
    const rows = (data ?? []) as unknown as ProjectRow[]
    const who = await owners(rows.map((r) => r.owner_id))
    body = rows.length === 0 ? <Empty>No projects match.</Empty> : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] font-mono text-[14px]">
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-[1px] text-ink-muted">
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Builder</th>
              <th className="px-4 py-3 font-medium text-right">Test cases</th>
              <th className="px-4 py-3 font-medium text-right">Reports</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Moderation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="px-4 py-3">
                  <span className="block">{p.name}</span>
                  {p.app_url && <a href={p.app_url} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-ink-muted underline underline-offset-4 truncate max-w-[280px]">{p.app_url}</a>}
                  {p.flagged_at && <span className="mt-1 flex flex-wrap items-center gap-2"><Tag tone="danger">Flagged</Tag><span className="text-[12px] text-ink-muted">{p.flag_reason}</span></span>}
                </td>
                <td className="px-4 py-3">{p.owner_id ? <Link href={`/admin/accounts/${p.owner_id}`} className="underline-offset-4 hover:underline">{who.get(p.owner_id) ?? "—"}</Link> : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.missions.length}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.missions.reduce((n, m) => n + (m.test_results[0]?.count ?? 0), 0)}</td>
                <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3"><div className="flex justify-end"><ProjectRowActions projectId={p.id} isFlagged={!!p.flagged_at} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  } else if (tab === "cases") {
    let query = admin
      .from("missions")
      .select("id, title, created_at, is_active, testers_needed, projects(id, name, owner_id), test_results(count)", { count: "exact" })
    if (like) query = query.ilike("title", like)
    const { data, count } = await query.order("created_at", { ascending: false }).range(...span)
    total = count ?? 0
    const rows = (data ?? []) as unknown as CaseRow[]
    const who = await owners(rows.map((r) => r.projects?.owner_id))
    body = rows.length === 0 ? <Empty>No test cases match.</Empty> : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] font-mono text-[14px]">
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-[1px] text-ink-muted">
              <th className="px-4 py-3 font-medium">Test case</th>
              <th className="px-4 py-3 font-medium">Project · builder</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Reports</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const received = m.test_results[0]?.count ?? 0
              return (
                <tr key={m.id} className="border-t border-line align-top">
                  <td className="px-4 py-3"><Link href={`/admin/missions/${m.id}`} className="underline-offset-4 hover:underline">{m.title}</Link></td>
                  <td className="px-4 py-3">
                    {m.projects?.name ?? "—"}
                    {m.projects?.owner_id && <span className="block text-[12px] text-ink-muted">{who.get(m.projects.owner_id)}</span>}
                  </td>
                  <td className="px-4 py-3">{m.is_active === false ? <Tag>Not live</Tag> : <Tag tone="info">Live</Tag>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.testers_needed ? `${received} / ${m.testers_needed}` : received}</td>
                  <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{formatDate(m.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  } else {
    const { data, count } = await admin
      .from("test_results")
      .select("id, mission_id, tester_id, screenshot_url, screenshot_urls, tester_comment, ai_summary, ai_sentiment, created_at, missions(id, title, projects(id, name))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(...span)
    total = count ?? 0
    type R = {
      id: string
      tester_id: string
      screenshot_url: string | null
      screenshot_urls: string[] | null
      tester_comment: string | null
      ai_summary: string | null
      ai_sentiment: string | null
      created_at: string
      missions: { id: string; title: string; projects: { id: string; name: string } | null } | null
    }
    const rows = (data ?? []) as unknown as R[]
    const ids = rows.map((r) => r.id)
    const [testers, entries] = await Promise.all([
      ids.length ? admin.from("profiles").select("id, full_name, email, avatar_url").in("id", [...new Set(rows.map((r) => r.tester_id))]) : Promise.resolve({ data: [] }),
      ids.length
        ? admin
            .from("test_result_entries")
            .select("id, test_result_id, step_index, step_action, step_expected, status, issue_summary, steps_to_reproduce, actual_result, expected_result")
            .in("test_result_id", ids)
            .order("step_index", { ascending: true })
        : Promise.resolve({ data: [] }),
    ])
    const tester = new Map((testers.data ?? []).map((p) => [p.id as string, { fullName: (p.full_name as string) ?? "", email: (p.email as string) ?? "", avatarUrl: (p.avatar_url as string | null) ?? null }]))
    const byResult = new Map<string, SubmissionEntry[]>()
    for (const e of (entries.data ?? []) as (SubmissionEntry & { test_result_id: string })[]) byResult.set(e.test_result_id, [...(byResult.get(e.test_result_id) ?? []), e])
    const submissions: SubmissionRow[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      testerComment: r.tester_comment ?? "",
      aiSummary: r.ai_summary ?? null,
      aiSentiment: normalizeSentiment(r.ai_sentiment),
      screenshotUrls: screenshotList(r),
      mission: r.missions ? { id: r.missions.id, title: r.missions.title } : null,
      project: r.missions?.projects ? { id: r.missions.projects.id, name: r.missions.projects.name } : null,
      tester: tester.get(r.tester_id) ?? { fullName: "", email: "", avatarUrl: null },
      entries: byResult.get(r.id) ?? null,
    }))
    body = <SubmissionsList submissions={submissions} emptyMessage="No reports yet." />
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const href = (over: Search) => {
    const params = new URLSearchParams(Object.entries({ tab, q, flagged: sp.flagged, page: String(page), ...over }).filter((e): e is [string, string] => !!e[1] && !(e[0] === "page" && e[1] === "1")))
    return `/admin/content?${params}`
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 expanded:px-6 py-8">
      <PageHeader eyebrow="Content" title="Content" lede="Every project, test case and report. Flag or remove a project from its row; open a test case for its reports." />

      <nav aria-label="Content type" className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={`/admin/content?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={cn("h-12 lg:h-10 px-4 flex items-center rounded-[8px] border font-mono text-[14px] whitespace-nowrap", tab === t ? "border-accent-ink text-accent-ink" : "border-line text-ink-muted hover:text-ink")}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab !== "reports" && (
        <form method="get" className="mb-4 flex flex-col medium:flex-row gap-2">
          <input type="hidden" name="tab" value={tab} />
          <label className="sr-only" htmlFor="content-q">Search</label>
          <input id="content-q" name="q" defaultValue={q} placeholder={tab === "projects" ? "Project name" : "Test case title"} className="h-12 lg:h-10 flex-1 rounded-[8px] border border-ink-muted bg-surface px-3 font-mono text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent-ink" />
          {tab === "projects" && (
            <label className="flex items-center gap-2 h-12 lg:h-10 font-mono text-[14px]">
              <input type="checkbox" name="flagged" value="1" defaultChecked={sp.flagged === "1"} className="h-4 w-4 accent-[var(--color-accent-ink)]" /> Flagged only
            </label>
          )}
          <button type="submit" className="h-12 lg:h-10 px-4 rounded-[8px] border border-ink-muted font-mono text-[14px] hover:bg-ink/[0.06]">Search</button>
        </form>
      )}

      <Panel title={`${total} ${TABS.find(([t]) => t === tab)![1].toLowerCase()}`} action={<span className="font-mono text-[12px] text-ink-muted">Page {page} of {pages}</span>}>
        {body}
        {pages > 1 && (
          <nav aria-label="Pages" className="flex justify-between border-t border-line px-4 py-3 font-mono text-[14px]">
            {page > 1 ? <Link className="text-accent-ink underline underline-offset-4" href={href({ page: String(page - 1) })}>Previous</Link> : <span />}
            {page < pages ? <Link className="text-accent-ink underline underline-offset-4" href={href({ page: String(page + 1) })}>Next</Link> : <span />}
          </nav>
        )}
      </Panel>
    </div>
  )
}
