import Link from "next/link"
import { Wallet } from "lucide-react"
import { requireAdmin } from "@/lib/auth"
import { payoutSheet } from "@/lib/cohortDb"
import { monthOf } from "@/lib/allowance"
import { PAYOUT_RATES, RATING_FLAG_BELOW, shiftMonth } from "@/lib/payouts"
import { formatRating } from "@/lib/reciprocity"

export const metadata = { title: "Payouts — Admin · Twnhall" }

const ngn = (n: number) => `₦${n.toLocaleString("en-NG")}`

/** "2026-10" from the query, or this Lagos month. Anything else is ignored. */
function monthFrom(param: string | undefined): string {
  return param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? `${param}-01` : monthOf(new Date())
}

function monthLabel(month: string): string {
  return new Date(`${month}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
}

/**
 * What the paid tester cohort is owed for one calendar month, Africa/Lagos
 * time. An admin pays from the CSV by bank transfer; nothing here moves money.
 *
 * Paid on submission. A low rating raises a flag and changes no total —
 * compensation doc §6.
 */
export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  // The layout checks too; this is the second layer, per CLAUDE.md.
  await requireAdmin()
  const month = monthFrom((await searchParams).month)
  const { rows, totalNgn } = await payoutSheet(month)
  const key = month.slice(0, 7)

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-2">
        <Wallet className="w-4 h-4 text-accent-ink" aria-hidden="true" />
        <p className="font-mono text-[11px] font-medium text-accent-ink uppercase tracking-[1px]">
          Admin · Payouts
        </p>
      </div>
      <h1 className="font-syne font-bold text-[32px] leading-[40px] tracking-[-0.5px] text-ink mb-1">
        Cohort payouts
      </h1>
      <p className="font-mono text-[14px] text-ink-muted mb-8 max-w-3xl">
        {ngn(PAYOUT_RATES.perReportNgn)} per paid report, plus {ngn(PAYOUT_RATES.bonusNgn)} at{" "}
        {PAYOUT_RATES.bonusAtReports} or more in the month. Months run on Lagos time. The CSV you
        download is the record of what was paid — a submission deleted later would change this page,
        not that file.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href={`/admin/payouts?month=${shiftMonth(month, -1).slice(0, 7)}`}
          className="h-8 px-3 inline-flex items-center border border-ink-muted rounded-[6px] font-mono text-[13px] text-ink hover:bg-ink/[0.06]"
        >
          ← Previous
        </Link>
        <h2 className="font-syne font-bold text-[20px] text-ink">{monthLabel(month)}</h2>
        <Link
          href={`/admin/payouts?month=${shiftMonth(month, 1).slice(0, 7)}`}
          className="h-8 px-3 inline-flex items-center border border-ink-muted rounded-[6px] font-mono text-[13px] text-ink hover:bg-ink/[0.06]"
        >
          Next →
        </Link>
        <a
          href={`/api/admin/payouts?month=${key}`}
          className="ml-auto h-8 px-3 inline-flex items-center border border-ink-muted rounded-[6px] font-mono text-[13px] text-ink hover:bg-ink/[0.06]"
        >
          Download CSV
        </a>
      </div>

      <div className="bg-surface-raised border border-line rounded-[12px] overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <caption className="sr-only">Cohort payouts for {monthLabel(month)}</caption>
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-[1px] text-ink-muted">
              <th scope="col" className="px-5 py-3 font-medium">Tester</th>
              <th scope="col" className="px-5 py-3 font-medium text-right">Paid reports</th>
              <th scope="col" className="px-5 py-3 font-medium text-right">Unpaid</th>
              <th scope="col" className="px-5 py-3 font-medium">Bonus</th>
              <th scope="col" className="px-5 py-3 font-medium">Rating (to date)</th>
              <th scope="col" className="px-5 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center font-mono text-[13px] text-ink-muted">
                  No cohort testers were members this month.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.testerId} className="border-t border-line/60 font-mono text-[13px] text-ink">
                <td className="px-5 py-3">
                  <p>{r.name || "—"}</p>
                  <p className="text-[12px] text-ink-muted">{r.email}</p>
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{r.payable}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink-muted">{r.unpaid}</td>
                <td className="px-5 py-3">{r.bonus ? "Yes" : "No"}</td>
                <td className="px-5 py-3">
                  {formatRating(r.rating)}
                  {r.flagged && (
                    <span className="ml-2 text-danger-ink">Below {RATING_FLAG_BELOW}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{ngn(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-mono text-[13px] text-ink">
              <th scope="row" colSpan={5} className="px-5 py-3 text-left font-medium">
                Month total
              </th>
              <td className="px-5 py-3 text-right tabular-nums font-medium">{ngn(totalNgn)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="font-mono text-[12px] text-ink-muted mt-3 max-w-3xl">
        Unpaid counts a cohort tester&apos;s reports on missions the cohort may not serve — slots
        from earned credit, or beyond the mission&apos;s paid slots. They earned a report instead.
      </p>
    </div>
  )
}
