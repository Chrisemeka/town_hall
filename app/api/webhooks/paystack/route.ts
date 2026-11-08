import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { paystackKey } from "@/lib/paystack/config"
import { eventFields, handlePaystackEvent, type PaystackOutcome } from "@/lib/paystack/events"
import { verifyPaystackSignature } from "@/lib/paystack/signature"
import { checkRateLimit, clientIp, tooManyResponse } from "@/lib/rateLimitDb"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
 * Paystack's events. No middleware runs here and no session is read: the HMAC
 * is the only thing between a real notification and someone typing one. It is
 * checked against the raw body before anything is parsed, because re-serialised
 * JSON is different bytes.
 *
 * Configure at Paystack Dashboard → Settings → API Keys & Webhooks:
 *   https://<host>/api/webhooks/paystack
 */

export async function POST(req: Request) {
  // A 429 makes Paystack retry later; nothing is lost.
  const rate = await checkRateLimit(["webhook:ip", clientIp(req.headers)])
  if (!rate.ok) return tooManyResponse(rate.retryAfter)

  const secret = paystackKey()
  if (!secret) {
    console.error("[webhook/paystack] PAYSTACK_SECRET_KEY not configured")
    return NextResponse.json({ error: "Not configured" }, { status: 503 })
  }

  const raw = await req.text()
  if (!verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: unknown
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  let outcome: PaystackOutcome = "error"
  try {
    outcome = await handlePaystackEvent(event)
  } catch (e) {
    console.error("[webhook/paystack] handler failed:", e instanceof Error ? e.message : "unknown")
  }

  const { error } = await createAdminClient().from("paystack_events").insert({ ...eventFields(event), outcome })
  if (error) console.error("[webhook/paystack] event not recorded:", error.message)

  // A 500 is a redelivery, and every handler is safe to run twice. An unrecorded
  // event takes the same road: alerts read this table.
  if (outcome === "error" || error) return NextResponse.json({ error: "Try again" }, { status: 500 })
  return NextResponse.json({ ok: true, outcome })
}
