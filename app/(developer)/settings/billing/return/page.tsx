import { notFound, redirect } from "next/navigation"
import { runAlertsLater } from "@/lib/alerts/run"
import { requireAccount } from "@/lib/auth"
import { BILLING_PROBLEMS, settleCharge } from "@/lib/paystack/charges"
import { verifyTransaction } from "@/lib/paystack/client"
import { createAdminClient } from "@/lib/supabase/admin"

// Where Paystack sends a builder back. Its query string proves nothing: the
// reference has to be this builder's own checkout, and the charge is verified
// with Paystack and handed to settleCharge(), the same function the webhook
// calls. Whichever lands second gets 'duplicate'.

const STILL_MOVING = ["ongoing", "pending", "processing", "queued"]

async function outcome(reference: string): Promise<string> {
  const verified = await verifyTransaction(reference)
  if (!verified.ok) return "pending"
  const { status } = verified.data
  if (status !== "success") return STILL_MOVING.includes(status ?? "") ? "pending" : "not_completed"

  try {
    const settled = await settleCharge(verified.data)
    if (BILLING_PROBLEMS.includes(settled)) {
      await createAdminClient().from("paystack_events").insert({ event: "return.verify", reference, outcome: settled })
      runAlertsLater(["billing_mismatch"])
      return "review"
    }
    return "started"
  } catch (err) {
    // The payment is real and the webhook will settle it.
    console.error("[billing/return] settle failed:", err instanceof Error ? err.message : "unknown")
    return "pending"
  }
}

export default async function BillingReturnPage({ searchParams }: { searchParams: Promise<{ reference?: string | string[]; trxref?: string | string[] }> }) {
  const { userId } = await requireAccount("builder")
  const sp = await searchParams
  const reference = [sp.reference, sp.trxref].flat().find((r) => typeof r === "string" && r)
  if (!reference) notFound()

  const { data: checkout } = await createAdminClient().from("paystack_checkouts").select("profile_id").eq("reference", reference).maybeSingle()
  // notFound, never a 403: "not yours" must look like "no such thing".
  if (!checkout || checkout.profile_id !== userId) notFound()

  redirect(`/settings?tab=plan&billing=${await outcome(reference)}`)
}
