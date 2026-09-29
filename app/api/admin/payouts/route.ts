import { requireAdmin } from "@/lib/auth"
import { payoutSheet } from "@/lib/cohortDb"
import { monthOf } from "@/lib/allowance"
import { CSV_BOM, toCsv } from "@/lib/csv"

/*
 * The cohort payout sheet for one Lagos month, as the file an admin pays from.
 *
 * THIS ROUTE HAS NO MIDDLEWARE — app/api is outside the matcher — so
 * requireAdmin() below is the only gate, not a second opinion.
 *
 * Tester names are user-controlled and go through toCsv(), which neutralises
 * a leading = + - @ before quoting. Email is included on purpose: this file
 * stays with admins, who see emails in /admin/users already, and a name alone
 * does not identify a bank transfer. The builder-export rule against emails
 * is about files that leave to builders.
 */

const HEADERS = ["Tester", "Email", "Paid reports", "Unpaid reports", "Bonus", "Total (NGN)", "Rating to date", "Rating flagged"] as const

export async function GET(request: Request) {
  try {
    await requireAdmin()
  } catch {
    return new Response(null, { status: 403 })
  }

  const param = new URL(request.url).searchParams.get("month") ?? ""
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? `${param}-01` : monthOf(new Date())
  const { rows, totalNgn } = await payoutSheet(month)

  const body =
    CSV_BOM +
    toCsv(HEADERS, [
      ...rows.map((r) => [
        r.name,
        r.email,
        r.payable,
        r.unpaid,
        r.bonus ? "Yes" : "No",
        r.total,
        r.rating === null ? "" : r.rating.toFixed(2),
        r.flagged ? "Yes" : "No",
      ]),
      ["Month total", "", "", "", "", totalNgn, "", ""],
    ])

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="twnhall-payouts-${month.slice(0, 7)}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
