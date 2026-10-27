import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/auth"
import { Avatar } from "@/components/ui/Avatar"
import { PageHeader, Panel, Stat, Tag, Empty, formatDate, formatDateTime } from "@/components/admin/ui"
import { PlanDialog } from "@/components/admin/PlanDialog"
import { CohortControl } from "@/components/admin/CohortControl"
import { UserRowActions, type ModerationStatus } from "@/components/admin/UserRowActions"
import { balance, type LedgerRow } from "@/lib/allowance"
import { planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"
import { formatNgn, type Subscription } from "@/lib/subscriptions"

export const metadata = { title: "Account — Admin · Twnhall" }

type Account = {
  id: string
  type: string
  created_at: string
  verification_completed_at: string | null
  plan_id: string | null
  cohort_member_at: string | null
  cohort_left_at: string | null
}

type TimelineItem = { at: string; text: string; href?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const [authRes, profileRes, accountsRes, subsRes, ledgerRes, changesRes, eventsRes, projectsRes, reportsRes] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, moderation_status, ban_reason, banned_at, accepted_terms_at")
      .eq("id", id)
      .maybeSingle(),
    admin.from("accounts").select("id, type, created_at, verification_completed_at, plan_id, cohort_member_at, cohort_left_at").eq("user_id", id),
    admin
      .from("subscriptions")
      .select("id, plan_id, status, source, period_start, period_end, amount_ngn, payment_reference, reason, created_by, created_at, ended_at")
      .eq("profile_id", id)
      .order("created_at", { ascending: false }),
    admin.from("report_ledger").select("kind, bucket, period, slots").eq("profile_id", id),
    admin
      .from("admin_account_changes")
      .select("id, field, from_value, to_value, changed_by, created_at")
      .eq("profile_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("app_events").select("name, occurred_at, props").eq("profile_id", id).order("occurred_at", { ascending: false }).limit(30),
    admin.from("projects").select("id, name, created_at").eq("owner_id", id).order("created_at", { ascending: false }).limit(30),
    admin
      .from("test_results")
      .select("id, created_at, rating, reviewed_at, missions(id, title)")
      .eq("tester_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ])

  const profile = profileRes.data
  if (!profile) notFound()
  const authUser = authRes.data?.user as
    | (NonNullable<typeof authRes.data>["user"] & { banned_until?: string | null })
    | undefined

  const accounts = (accountsRes.data ?? []) as Account[]
  const builder = accounts.find((a) => a.type === "builder")
  const tester = accounts.find((a) => a.type === "tester")
  const plan = planIdFor(builder?.plan_id)
  const subs = (subsRes.data ?? []) as Subscription[]
  const active = subs.find((s) => s.status === "active") ?? null
  const scheduled = subs.find((s) => s.status === "scheduled") ?? null
  const pools = balance(planFor(plan).monthlyReports, (ledgerRes.data ?? []) as LedgerRow[], new Date())
  const inCohort = !!tester?.cohort_member_at && !tester.cohort_left_at

  // Who made each change: admins, by name.
  const adminIds = [...new Set([...subs.map((s) => s.created_by), ...(changesRes.data ?? []).map((c) => c.changed_by)].filter(Boolean))] as string[]
  const { data: adminNames } = adminIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", adminIds)
    : { data: [] }
  const byName = new Map((adminNames ?? []).map((p) => [p.id, p.full_name || p.email || p.id]))
  const who = (pid: string | null) => (pid ? (byName.get(pid) ?? "an admin") : "the system")

  // Missions on their projects, for the timeline.
  const projects = (projectsRes.data ?? []) as { id: string; name: string; created_at: string }[]
  const { data: missions } = projects.length
    ? await admin
        .from("missions")
        .select("id, title, created_at, project_id")
        .in("project_id", projects.map((p) => p.id))
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] }

  const timeline: TimelineItem[] = [
    ...(eventsRes.data ?? []).map((e) => ({ at: e.occurred_at as string, text: eventText(e.name as string, e.props as Record<string, unknown>) })),
    ...projects.map((p) => ({ at: p.created_at, text: `Created project ${p.name}` })),
    ...(missions ?? []).map((m) => ({ at: m.created_at as string, text: `Created test case ${m.title}`, href: `/admin/missions/${m.id}` })),
    ...((reportsRes.data ?? []) as unknown as { id: string; created_at: string; reviewed_at: string | null; rating: number | null; missions: { id: string; title: string } | null }[]).flatMap((r) => [
      { at: r.created_at, text: `Filed a report on ${r.missions?.title ?? "a test case"}`, href: r.missions ? `/admin/missions/${r.missions.id}` : undefined },
      ...(r.reviewed_at ? [{ at: r.reviewed_at, text: `Report on ${r.missions?.title ?? "a test case"} approved${r.rating ? `, rated ${r.rating}` : ""}` }] : []),
    ]),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 40)

  const name = profile.full_name || profile.email || "Unnamed"

  return (
    <div className="max-w-[1200px] mx-auto px-4 expanded:px-6 py-8">
      <Link href="/admin/accounts" className="inline-flex h-12 lg:h-10 items-center font-mono text-[14px] text-ink-muted hover:text-ink">← Accounts</Link>
      <PageHeader eyebrow="Account" title={name} lede={profile.full_name ? (profile.email ?? undefined) : undefined}>
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatar_url} name={profile.full_name ?? ""} email={profile.email ?? ""} size={12} />
          <UserRowActions userId={id} status={(profile.moderation_status as ModerationStatus) || "active"} role={profile.role ?? ""} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Panel title="Identity and gates">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 font-mono text-[14px]">
            <dt className="text-ink-muted">Signed up</dt>
            <dd>{formatDate(authUser?.created_at)}</dd>
            <dt className="text-ink-muted">Email confirmed</dt>
            <dd>{formatDate(authUser?.email_confirmed_at)}</dd>
            <dt className="text-ink-muted">Terms accepted</dt>
            <dd>{formatDate(profile.accepted_terms_at)}</dd>
            <dt className="text-ink-muted">Last sign-in</dt>
            <dd>{formatDate(authUser?.last_sign_in_at)}</dd>
            <dt className="text-ink-muted">Status</dt>
            <dd>{profile.moderation_status || "active"}{authUser?.banned_until ? ` until ${formatDate(authUser.banned_until)}` : ""}</dd>
            {profile.ban_reason && (
              <>
                <dt className="text-ink-muted">Reason</dt>
                <dd>{profile.ban_reason}</dd>
              </>
            )}
          </dl>
        </Panel>

        <Panel title="Accounts">
          <ul className="p-4 flex flex-col gap-4 font-mono text-[14px]">
            {accounts.length === 0 && <li className="text-ink-muted">No account chosen yet.</li>}
            {accounts.map((a) => (
              <li key={a.id}>
                <span className="flex items-center gap-2">
                  <Tag tone={a.type === "builder" ? "info" : "muted"}>{a.type}</Tag>
                  {a.verification_completed_at ? <span className="text-success-ink">Verified</span> : <span className="text-ink-muted">Not verified</span>}
                </span>
                <span className="block text-ink-muted mt-1">
                  Created {formatDate(a.created_at)}
                  {a.verification_completed_at ? ` · verified ${formatDate(a.verification_completed_at)}` : ""}
                </span>
              </li>
            ))}
            {tester && (
              <li className="flex items-center justify-between gap-4 border-t border-line pt-4">
                <span>{inCohort ? `In the paid cohort since ${formatDate(tester.cohort_member_at)}` : "Not in the paid cohort"}</span>
                <CohortControl userId={id} member={inCohort} hasTesterAccount />
              </li>
            )}
          </ul>
        </Panel>

        <Panel title="Report balance">
          <div className="grid grid-cols-2 gap-4 p-4">
            <Stat label="Monthly" value={pools.monthly} />
            <Stat label="Grant" value={pools.grant} />
            <Stat label="Earned" value={pools.earned} />
            <Stat label="Total" value={pools.total} />
          </div>
        </Panel>
      </div>

      {builder && (
        <Panel
          className="mb-4"
          title={`Plan · ${planFor(plan).name}`}
          action={<PlanDialog userId={id} current={plan} activeEnd={active?.period_end ?? null} hasActive={!!active} />}
        >
          {scheduled && (
            <p className="px-4 pt-4 font-mono text-[14px] text-ink">
              Scheduled: moves to {planFor(planIdFor(scheduled.plan_id)).name} on {formatDate(scheduled.period_start)}.
            </p>
          )}
          {subs.length === 0 ? (
            <Empty>No subscriptions recorded.{plan !== "community" ? " This plan predates the subscription record — choose it again in the dialog to record it." : ""}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] font-mono text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-[1px] text-ink-muted">
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Paid</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-t border-line align-top">
                      <td className="px-4 py-3">{planFor(planIdFor(s.plan_id)).name}</td>
                      <td className="px-4 py-3"><Tag tone={s.status === "active" ? "success" : s.status === "scheduled" ? "info" : "muted"}>{s.status}</Tag></td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.period_start)} → {s.period_end ? formatDate(s.period_end) : "open"}</td>
                      <td className="px-4 py-3">{s.amount_ngn != null ? formatNgn(s.amount_ngn) : "—"}{s.payment_reference ? <span className="block text-ink-muted">{s.payment_reference}</span> : null}</td>
                      <td className="px-4 py-3">{s.reason}</td>
                      <td className="px-4 py-3 text-ink-muted">{s.source === "manual" ? who(s.created_by) : s.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Activity">
          {timeline.length === 0 ? (
            <Empty>Nothing recorded yet.</Empty>
          ) : (
            <ul>
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-4 border-t border-line px-4 py-3 font-mono text-[14px] first:border-t-0">
                  <span className="w-[120px] shrink-0 text-ink-muted tabular-nums">{formatDateTime(t.at)}</span>
                  {t.href ? <Link href={t.href} className="text-ink underline-offset-4 hover:underline">{t.text}</Link> : <span>{t.text}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Plan and cohort changes">
          {(changesRes.data ?? []).length === 0 ? (
            <Empty>No changes recorded.</Empty>
          ) : (
            <ul>
              {(changesRes.data ?? []).map((c) => {
                const label = (v: string | null) =>
                  c.field === "plan_id" ? planFor(planIdFor(v)).name : v === "member" ? "in cohort" : "not in cohort"
                return (
                  <li key={c.id} className="border-t border-line px-4 py-3 font-mono text-[14px] first:border-t-0">
                    {c.field === "plan_id" ? "Plan" : "Cohort"}: {label(c.from_value)} → {label(c.to_value)}
                    <span className="block text-ink-muted">by {who(c.changed_by)} · {formatDateTime(c.created_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

/** One line per event, in words. Never the props wholesale — they are for counting. */
function eventText(name: string, props: Record<string, unknown>): string {
  switch (name) {
    case "auth.login": return "Signed in"
    case "auth.logout": return "Signed out"
    case "account.switched": return "Switched account"
    case "allowance.capped": return `Published a test case with fewer testers than asked (${props.slots} of ${props.requested})`
    case "allowance.refused": return props.reason === "active_limit" ? "Could not publish: active test case limit" : "Could not publish: no reports left"
    case "allowance.missed_credit": return "A credit failed to land"
    case "export.csv": return `Exported reports (${props.format ?? "csv"})`
    case "export.pdf": return "Downloaded a PDF report"
    case "plan.changed": return `Plan changed to ${planFor(planIdFor(String(props.to ?? ""))).name}`
    default: return name
  }
}
