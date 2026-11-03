import { requireAdmin } from "@/lib/auth"
import { billingRecord } from "@/lib/billingRecord"
import { loadBillingInput } from "@/lib/billingRecordDb"
import { CSV_BOM, toCsv } from "@/lib/csv"
import { MERCHANT } from "@/lib/merchant"
import { isUuid } from "@/lib/track"

/*
 * One builder's billing record, as the file a Paystack dispute is answered
 * with (docs/specs/SPEC-dispute-readiness.md).
 *
 * THIS ROUTE HAS NO MIDDLEWARE — app/api is outside the matcher — so
 * requireAdmin() below is the only gate, not a second opinion.
 *
 * Unlike the payout CSV, this file LEAVES Twnhall (Paystack, the card issuer),
 * so testers are "Tester N" only and no email is in it. Test case titles are
 * builder-written and go through toCsv(), which neutralises them.
 */

const HEADERS = ["Date (Lagos)", "Event", "Test case", "Detail", "Reports", "Amount (NGN)", "Reference"] as const

/** "2026-11-03 14:05", Lagos (UTC+1, no DST — the same fixed shift as monthOf()). */
const lagos = (iso: string) => new Date(Date.parse(iso) + 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ")

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch {
    return new Response(null, { status: 403 })
  }

  const { id } = await params
  if (!isUuid(id)) return new Response(null, { status: 404 })

  const { firstName, ...input } = await loadBillingInput(id)
  const today = lagos(new Date().toISOString()).slice(0, 10)

  const body =
    CSV_BOM +
    toCsv(HEADERS, [
      ...billingRecord(input).map((e) => [lagos(e.at), e.event, e.testCase, e.detail, e.slots, e.amountNgn, e.reference]),
      // CSV has no comment syntax, and a line above the headers would break
      // the header row in a spreadsheet: the note goes last.
      [],
      [`Prepared by ${MERCHANT.legalName} on ${today}. Testers are identified by number only.`],
    ])

  const name = firstName.toLowerCase().replace(/[^a-z0-9-]/g, "") || "builder"
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="twnhall-billing-${name}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
