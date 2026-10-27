import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { PageHeader, Panel, Stat, Empty } from "@/components/admin/ui"
import { payableIn, payoutSheet } from "@/lib/cohortDb"
import { PAYOUT_RATES } from "@/lib/payouts"
import { monthOf } from "@/lib/allowance"
import { monthStart } from "@/lib/metrics"
import { planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"
import { formatNgn, monthlyAmount } from "@/lib/subscriptions"
import { CASH_ON_HAND, FX, INFRA_USD_MONTHLY, usdToNgn } from "@/lib/costs"

export const metadata = { title: "Money — Admin · Twnhall" }

// Admin Metrics §5, this Lagos month. Money in is subscriptions.amount_ngn —
// what builders actually paid — never list price. Money out is the cohort
// (the payout sheet), AI (ai_usage_events) and infra (lib/costs.ts).

type Sub = { profile_id: string; plan_id: string; amount_ngn: number | null; period_start: string; period_end: string | null }

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—")

export default async function AdminMoneyPage() {
  const { admin } = await requireAdmin()
  const now = new Date()
  const month = monthOf(now)
  const from = monthStart(now).toISOString()

  const [subsRes, aiRes, sheet, payable, deliveredRes] = await Promise.all([
    admin.from("subscriptions").select("profile_id, plan_id, amount_ngn, period_start, period_end").eq("status", "active"),
    admin.from("ai_usage_events").select("profile_id, estimated_cost_usd").gte("created_at", from),
    payoutSheet(month),
    payableIn(month),
    admin.from("test_results").select("id", { count: "exact", head: true }).gte("created_at", from),
  ])

  const subs = (subsRes.data ?? []) as Sub[]
  const ai = (aiRes.data ?? []) as { profile_id: string | null; estimated_cost_usd: number | string | null }[]
  const revenue = subs.reduce((n, s) => n + monthlyAmount(s), 0)
  const aiUsd = ai.reduce((n, r) => n + Number(r.estimated_cost_usd ?? 0), 0)
  const cohort = sheet.totalNgn
  const infra = usdToNgn(INFRA_USD_MONTHLY)
  const costs = cohort + usdToNgn(aiUsd) + infra
  const delivered = deliveredRes.count ?? 0
  const burn = costs - revenue
  const runway =
    CASH_ON_HAND === null ? "Not set" : burn <= 0 ? "Not burning" : `${(CASH_ON_HAND.ngn / burn).toFixed(1)} months`

  // ── Per paying builder ────────────────────────────────────────────────
  // Cohort cost is the per-report rate on payable reports their test cases
  // received. ponytail: the activity bonus is a per-tester payment and is not
  // split across builders; the total above includes it.
  const missionIds = [...new Set(payable.map((p) => p.missionId))]
  const { data: owners } = missionIds.length
    ? await admin.from("missions").select("id, projects(owner_id)").in("id", missionIds)
    : { data: [] }
  const ownerOf = new Map(((owners ?? []) as unknown as { id: string; projects: { owner_id: string | null } | null }[]).map((m) => [m.id, m.projects?.owner_id ?? null]))
  const cohortBy = new Map<string, number>()
  for (const p of payable) {
    const o = ownerOf.get(p.missionId)
    if (o) cohortBy.set(o, (cohortBy.get(o) ?? 0) + PAYOUT_RATES.perReportNgn)
  }
  const aiBy = new Map<string, number>()
  for (const r of ai) if (r.profile_id) aiBy.set(r.profile_id, (aiBy.get(r.profile_id) ?? 0) + usdToNgn(Number(r.estimated_cost_usd ?? 0)))

  const ids = [...new Set(subs.map((s) => s.profile_id))]
  const { data: people } = ids.length ? await admin.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] }
  const name = new Map((people ?? []).map((p) => [p.id as string, (p.full_name || p.email || "—") as string]))
  const infraShare = subs.length ? infra / subs.length : 0
  const rows = subs
    .map((s) => {
      const paid = monthlyAmount(s)
      const cost = (cohortBy.get(s.profile_id) ?? 0) + (aiBy.get(s.profile_id) ?? 0) + infraShare
      return { id: s.profile_id, plan: planFor(planIdFor(s.plan_id)).name, paid, cost, margin: paid - cost }
    })
    .sort((a, b) => a.plan.localeCompare(b.plan) || a.margin - b.margin)
  const tiers = [...new Set(rows.map((r) => r.plan))].map((plan) => {
    const t = rows.filter((r) => r.plan === plan)
    const paid = t.reduce((n, r) => n + r.paid, 0)
    return { plan, count: t.length, paid, margin: pct(paid - t.reduce((n, r) => n + r.cost, 0), paid) }
  })

  const fx = `₦${FX.ngnPerUsd.toLocaleString("en-NG")} = $1, checked ${FX.checked}`

  return (
    <div className="max-w-[1200px] mx-auto px-4 expanded:px-6 py-8">
      <PageHeader eyebrow="Money" title="Money" lede={`This month, Lagos time. Dollar costs converted at ${fx}.`}>
        <Link href="/admin/payouts" className="inline-flex h-12 lg:h-10 items-center px-4 rounded-[8px] border border-ink-muted font-mono text-[14px] hover:bg-ink/[0.06]">
          Payout sheet
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 expanded:grid-cols-4 gap-4 mb-4">
        <Stat label="MRR" value={formatNgn(revenue)} decision="What builders paid, spread over their periods." />
        <Stat label="Cohort cost" value={formatNgn(cohort)} decision="From the payout sheet, bonuses included." />
        <Stat label="AI spend" value={formatNgn(usdToNgn(aiUsd))} decision={`$${aiUsd.toFixed(2)}, estimated per analysis.`} />
        <Stat label="Infra" value={formatNgn(infra)} decision={`$${INFRA_USD_MONTHLY} fixed (compensation doc §11).`} />
      </div>
      <div className="grid grid-cols-2 expanded:grid-cols-4 gap-4 mb-8">
        <Stat label="Gross margin" value={pct(revenue - costs, revenue)} decision="The compensation doc predicts 57%. Check it." />
        <Stat
          label="Cost per report"
          value={delivered ? formatNgn(cohort / delivered) : "—"}
          decision={`Cohort cost ÷ ${delivered} reports delivered, reciprocity included — below the ₦${PAYOUT_RATES.perReportNgn.toLocaleString("en-NG")} rate when testing pays for itself.`}
        />
        <Stat label="Burn" value={burn > 0 ? formatNgn(burn) : "None"} decision="Costs minus MRR, this month." />
        <Stat
          label="Runway"
          value={runway}
          decision={CASH_ON_HAND ? `On ${formatNgn(CASH_ON_HAND.ngn)} cash, checked ${CASH_ON_HAND.checked}.` : "Set CASH_ON_HAND in lib/costs.ts to see it."}
        />
      </div>

      <Panel title="Gross margin per paying builder">
        {rows.length === 0 ? (
          <Empty>No active paid subscriptions.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-1 medium:grid-cols-2 gap-4 p-4">
              {tiers.map((t) => (
                <Stat key={t.plan} label={`${t.plan} · ${t.count}`} value={t.margin} decision={`${formatNgn(t.paid)} a month from this tier.`} />
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] font-mono text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-[1px] text-ink-muted">
                    <th className="px-4 py-3 font-medium">Builder</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium text-right">Paid / month</th>
                    <th className="px-4 py-3 font-medium text-right">Cost</th>
                    <th className="px-4 py-3 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="px-4 py-3"><Link href={`/admin/accounts/${r.id}`} className="underline-offset-4 hover:underline">{name.get(r.id) ?? "—"}</Link></td>
                      <td className="px-4 py-3">{r.plan}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNgn(r.paid)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNgn(r.cost)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${r.margin < 0 ? "text-danger-ink" : ""}`}>{pct(r.margin, r.paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 border-t border-line font-mono text-[12px] text-ink-muted">
              Cost is this month&apos;s payable cohort reports on their test cases at the per-report rate, AI on their projects, and an equal share of infra. The activity bonus is not split per builder.
            </p>
          </>
        )}
      </Panel>
    </div>
  )
}
