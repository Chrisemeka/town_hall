import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { PageHeader, Panel, Tag, Empty, formatDateTime } from "@/components/admin/ui"
import { acknowledgeAlert, resolveAlert, updateAlertRule } from "@/actions/admin/alerts"
import { RULE_LINKS, isRuleKey } from "@/lib/alerts/rules"
import { cn } from "@/lib/utils"

export const metadata = { title: "Alerts — Admin · Twnhall" }

const TABS = [
  ["open", "Open"],
  ["acknowledged", "Acknowledged"],
  ["history", "History"],
  ["rules", "Rules"],
] as const
type Tab = (typeof TABS)[number][0]

type AlertRow = {
  id: string
  rule_key: string
  status: string
  value: number | null
  detail: Record<string, unknown>
  first_seen_at: string
  last_seen_at: string
  notified_at: string | null
  acknowledged_at: string | null
  resolved_at: string | null
  alert_rules: { name: string; description: string; severity: string } | null
}

type RuleRow = {
  key: string
  name: string
  description: string
  severity: string
  threshold: number | null
  window_minutes: number | null
  cooldown_minutes: number
  email: boolean
  enabled: boolean
}

const sevTone = (s: string | undefined) => (s === "critical" ? "danger" : s === "warning" ? "accent" : "muted") as "danger" | "accent" | "muted"

/** Ids an alert carries become links to the thing itself. */
function detailLinks(detail: Record<string, unknown>): { href: string; label: string }[] {
  const ids = (k: string) => (Array.isArray(detail[k]) ? (detail[k] as string[]) : [])
  return [
    ...ids("mission_ids").map((id, i) => ({ href: `/admin/missions/${id}`, label: `Test case ${i + 1}` })),
    ...ids("profile_ids").map((id, i) => ({ href: `/admin/accounts/${id}`, label: `Account ${i + 1}` })),
  ].slice(0, 10)
}

export default async function AdminAlertsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { admin } = await requireAdmin()
  const { tab: raw } = await searchParams
  const tab: Tab = TABS.some(([t]) => t === raw) ? (raw as Tab) : "open"

  const [alertsRes, rulesRes] = await Promise.all([
    tab === "rules"
      ? Promise.resolve({ data: [] })
      : admin
          .from("alerts")
          .select("id, rule_key, status, value, detail, first_seen_at, last_seen_at, notified_at, acknowledged_at, resolved_at, alert_rules(name, description, severity)")
          .eq("status", tab === "history" ? "resolved" : tab)
          .order(tab === "history" ? "resolved_at" : "last_seen_at", { ascending: false })
          .limit(100),
    tab === "rules" ? admin.from("alert_rules").select("*").order("severity").order("name") : Promise.resolve({ data: [] }),
  ])
  const alerts = (alertsRes.data ?? []) as unknown as AlertRow[]
  const rules = (rulesRes.data ?? []) as RuleRow[]

  return (
    <div className="max-w-[1200px] mx-auto px-4 expanded:px-6 py-8">
      <PageHeader eyebrow="Alerts" title="Alerts" lede="Each rule is expected to read zero. When one fires, every admin is emailed and it stays here until the condition clears." />

      <nav aria-label="Alert views" className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={t === "open" ? "/admin/alerts" : `/admin/alerts?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={cn(
              "h-12 lg:h-10 px-4 flex items-center rounded-[8px] border font-mono text-[14px] whitespace-nowrap",
              tab === t ? "border-accent-ink text-accent-ink" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "rules" ? (
        <Panel>
          <ul>
            {rules.map((r) => (
              <li key={r.key} className="border-t border-line first:border-t-0 p-4">
                <form action={updateAlertRule} className="grid grid-cols-1 expanded:grid-cols-[1fr_auto] gap-4 items-start">
                  <input type="hidden" name="key" value={r.key} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Tag tone={sevTone(r.severity)}>{r.severity}</Tag>
                      <span className="font-mono text-[14px] text-ink">{r.name}</span>
                    </p>
                    <p className="font-mono text-[12px] text-ink-muted mt-1">{r.description}{r.window_minutes ? ` Window: ${r.window_minutes} min.` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <label className="font-mono text-[12px] text-ink-muted">
                      Threshold
                      <input name="threshold" type="number" step="any" min={0} defaultValue={r.threshold ?? 0} className="mt-1 block h-12 lg:h-10 w-[120px] rounded-[8px] border border-ink-muted bg-surface px-2 text-[14px] text-ink" />
                    </label>
                    <label className="font-mono text-[12px] text-ink-muted">
                      Cooldown (min)
                      <input name="cooldown_minutes" type="number" min={10} defaultValue={r.cooldown_minutes} className="mt-1 block h-12 lg:h-10 w-[120px] rounded-[8px] border border-ink-muted bg-surface px-2 text-[14px] text-ink" />
                    </label>
                    <label className="flex items-center gap-2 h-12 lg:h-10 font-mono text-[14px]">
                      <input type="checkbox" name="enabled" defaultChecked={r.enabled} className="h-4 w-4 accent-[var(--color-accent-ink)]" /> On
                    </label>
                    <label className="flex items-center gap-2 h-12 lg:h-10 font-mono text-[14px]">
                      <input type="checkbox" name="email" defaultChecked={r.email} className="h-4 w-4 accent-[var(--color-accent-ink)]" /> Email
                    </label>
                    <button type="submit" className="h-12 lg:h-10 px-4 rounded-[8px] border border-ink-muted font-mono text-[14px] hover:bg-ink/[0.06]">Save</button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel>
          {alerts.length === 0 ? (
            <Empty>{tab === "open" ? "Nothing open. Every rule reads zero." : tab === "acknowledged" ? "Nothing acknowledged." : "No resolved alerts yet."}</Empty>
          ) : (
            <ul>
              {alerts.map((a) => (
                <li key={a.id} className="border-t border-line first:border-t-0 p-4 flex flex-col expanded:flex-row expanded:items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Tag tone={sevTone(a.alert_rules?.severity)}>{a.alert_rules?.severity ?? "info"}</Tag>
                      <Link href={isRuleKey(a.rule_key) ? RULE_LINKS[a.rule_key] : "/admin"} className="font-mono text-[14px] text-ink underline-offset-4 hover:underline">
                        {a.alert_rules?.name ?? a.rule_key}
                        {a.value !== null ? `: ${Number(a.value)}` : ""}
                      </Link>
                    </p>
                    <p className="font-mono text-[12px] text-ink-muted mt-1">{a.alert_rules?.description}</p>
                    <p className="font-mono text-[12px] text-ink-muted mt-1">
                      First seen {formatDateTime(a.first_seen_at)} · last {formatDateTime(a.last_seen_at)}
                      {a.notified_at ? ` · emailed ${formatDateTime(a.notified_at)}` : ""}
                      {a.resolved_at ? ` · resolved ${formatDateTime(a.resolved_at)}` : ""}
                    </p>
                    {detailLinks(a.detail).length > 0 && (
                      <p className="flex flex-wrap gap-x-4 mt-1 font-mono text-[12px]">
                        {detailLinks(a.detail).map((l) => (
                          <Link key={l.href} href={l.href} className="text-accent-ink underline underline-offset-4">{l.label}</Link>
                        ))}
                      </p>
                    )}
                  </div>
                  {a.status !== "resolved" && (
                    <div className="flex gap-2 shrink-0">
                      {a.status === "open" && (
                        <form action={acknowledgeAlert.bind(null, a.id)}>
                          <button type="submit" className="h-12 lg:h-10 px-4 rounded-[8px] border border-ink-muted font-mono text-[14px] hover:bg-ink/[0.06]">Acknowledge</button>
                        </form>
                      )}
                      <form action={resolveAlert.bind(null, a.id)}>
                        <button type="submit" className="h-12 lg:h-10 px-4 rounded-[8px] border border-ink-muted font-mono text-[14px] hover:bg-ink/[0.06]">Resolve</button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  )
}
