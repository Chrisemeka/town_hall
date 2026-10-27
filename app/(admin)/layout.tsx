import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAccount } from "@/lib/auth"
import { CHOOSE_ACCOUNT_PATH, homeFor } from "@/lib/access"
import { AdminTopNav, type BellAlert } from "@/components/admin/AdminTopNav"
import { RULE_LINKS, isRuleKey } from "@/lib/alerts/rules"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") {
    // Bounce a non-admin to their own account's home — /explore is tester-only
    // now, so sending a Builder there would just bounce again.
    const resolved = await getActiveAccount()
    redirect(resolved?.active ? homeFor(resolved.active) : CHOOSE_ACCOUNT_PATH)
  }

  // The bell, on every admin page: open alerts (acknowledged ones have been
  // seen), critical first.
  const { data: open, count } = await admin
    .from("alerts")
    .select("id, rule_key, value, last_seen_at, alert_rules(name, severity)", { count: "exact" })
    .eq("status", "open")
    .order("last_seen_at", { ascending: false })
  const rows = ((open ?? []) as unknown as {
    id: string
    rule_key: string
    value: number | null
    alert_rules: { name: string; severity: string } | null
  }[]).map(
    (a): BellAlert => ({
      id: a.id,
      name: a.alert_rules?.name ?? a.rule_key,
      severity: a.alert_rules?.severity ?? "info",
      value: a.value === null ? null : Number(a.value),
      href: isRuleKey(a.rule_key) ? RULE_LINKS[a.rule_key] : "/admin/alerts",
    }),
  )
  const rank = { critical: 0, warning: 1, info: 2 } as Record<string, number>
  const latest = [...rows].sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3)).slice(0, 5)

  return (
    <div className="min-h-screen bg-surface text-ink">
      <AdminTopNav openCount={count ?? rows.length} critical={rows.some((a) => a.severity === "critical")} latest={latest} />
      <main className="pt-[56px] lg:pl-[240px] min-h-screen w-full min-w-0 overflow-x-hidden">{children}</main>
    </div>
  )
}
