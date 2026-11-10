import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createRefund, fetchRefund, listRefunds, type PaystackRefund } from "@/lib/paystack/client"
import { emailBuilder, later, site } from "@/lib/paystack/notify"
import { refundNotice, refundPredecessors, refundStage, refundStatusFrom } from "@/lib/subscriptions"
import type { PaystackOutcome } from "@/lib/paystack/eventFields"

// Every refund is sent here, once (SPEC-paystack-plan-changes §3). A row is
// created only by settle_upgrade, queue_refund or record_unwanted_charge; this
// file moves it. The rules:
// - one sender at a time: a runner claims a lease before it calls Paystack;
// - a request whose answer we didn't see is 'unknown', never failed or done,
//   and the next run looks it up at Paystack before it sends anything again;
// - statuses only move forward, through a conditional update;
// - the stored amount is sent, never recomputed;
// - "refunded" is only processed or settled_outside, and the builder hears
//   once per stage (notified_status).

const LEASE_MS = 5 * 60 * 1000
const RESEND_AFTER_MS = 10 * 60 * 1000
const STALE_MS = 24 * 60 * 60 * 1000
const MAX_ATTEMPTS = 3
const BATCH = 50

type Row = {
  id: string
  profile_id: string
  reason: string
  original_payment_reference: string
  amount_ngn: number
  idempotency_key: string
  status: string
  paystack_refund_id: string | null
  attempts: number
  notified_status: string | null
  created_at: string
  updated_at: string
}

const COLUMNS =
  "id, profile_id, reason, original_payment_reference, amount_ngn, idempotency_key, status, paystack_refund_id, attempts, notified_status, created_at, updated_at"

const db = () => createAdminClient().from("subscription_refunds")

/**
 * Moves a refund forward, or not at all: the update only matches while the row
 * is in a status that may precede `to`, so a redelivered or out-of-order event
 * changes nothing. Emails the builder when the move earns it. True if it moved.
 */
export async function moveRefund(id: string, to: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const now = new Date().toISOString()
  const finished = ["processed", "failed", "settled_outside"].includes(to)
  const { data, error } = await db()
    .update({ ...extra, status: to, updated_at: now, claimed_until: null, ...(finished ? { finished_at: now } : {}) })
    .eq("id", id)
    .in("status", refundPredecessors(to))
    .select(COLUMNS)
  if (error) throw new Error(error.message)
  const row = (data as Row[] | null)?.[0]
  if (!row) return false
  await notify(row)
  return true
}

/** The email a refund that starts finished earns: one paid back outside Paystack. */
export async function announceRefund(id: string): Promise<void> {
  const { data } = await db().select(COLUMNS).eq("id", id).maybeSingle()
  if (data) await notify(data as Row)
}

/** One email per stage, claimed before it's sent: a redelivery sends nothing. */
async function notify(row: Row): Promise<void> {
  const stage = refundStage(row.status)
  if (!stage || row.notified_status === stage) return
  // A later stage never re-sends an earlier one's email.
  if (stage === "started" && row.notified_status) return
  const claim = db().update({ notified_status: stage }).eq("id", row.id)
  const { data } = await (row.notified_status ? claim.eq("notified_status", row.notified_status) : claim.is("notified_status", null)).select("id")
  if (!data?.length) return
  emailBuilder(row.profile_id, `refund-${stage}`, refundNotice(stage, row.amount_ngn, row.reason, site()))
}

/**
 * The refund at Paystack that is this row: our key in the merchant note, or,
 * where Paystack kept no note, the same amount, made after the row, and not
 * already another row's. Null when there is none; undefined when Paystack
 * couldn't be asked.
 */
async function lookup(row: Row): Promise<PaystackRefund | null | undefined> {
  const res = await listRefunds(row.original_payment_reference)
  if (!res.ok) return undefined
  const byNote = res.data.find((r) => r.merchantNote === row.idempotency_key)
  if (byNote) return byNote
  const candidates = res.data.filter(
    (r) => !r.merchantNote && r.amountNgn === row.amount_ngn && (!r.createdAt || Date.parse(r.createdAt) >= Date.parse(row.created_at)),
  )
  if (!candidates.length) return null
  const { data: taken } = await db().select("paystack_refund_id").in("paystack_refund_id", candidates.map((c) => c.id))
  const used = new Set((taken ?? []).map((t) => t.paystack_refund_id))
  return candidates.find((c) => !used.has(c.id)) ?? null
}

const adopt = (row: Row, found: PaystackRefund) =>
  moveRefund(row.id, refundStatusFrom(found.status) ?? "pending", { paystack_refund_id: found.id, last_error: null })

/** Sends one queued refund, if this runner wins its lease. */
async function send(row: Row): Promise<boolean> {
  const now = new Date()
  const { data: claimed } = await db()
    .update({ status: "sending", claimed_until: new Date(now.getTime() + LEASE_MS).toISOString(), attempts: row.attempts + 1, updated_at: now.toISOString() })
    .eq("id", row.id)
    .eq("status", "queued")
    .or(`claimed_until.is.null,claimed_until.lt.${now.toISOString()}`)
    .select("id")
  if (!claimed?.length) return false

  const res = await createRefund({ reference: row.original_payment_reference, amountNgn: row.amount_ngn, merchantNote: row.idempotency_key })
  if (res.ok) return adopt(row, res.data)

  // Never conclude anything about money from an answer we didn't see. A refusal
  // like "already refunded" may mean an earlier attempt succeeded: look first.
  await moveRefund(row.id, "unknown", { last_error: res.message.slice(0, 500) })
  if (!res.permanent) return false
  const found = await lookup({ ...row, status: "unknown" })
  if (found) return adopt(row, found)
  if (found === null) await moveRefund(row.id, "failed", { last_error: res.message.slice(0, 500) })
  return false
}

/** A refund sent with no answer seen: found at Paystack, sent once more, or left for a person. */
async function resolveUnknown(row: Row): Promise<void> {
  const now = new Date()
  const { data: claimed } = await db()
    .update({ claimed_until: new Date(now.getTime() + LEASE_MS).toISOString() })
    .eq("id", row.id)
    .eq("status", "unknown")
    .or(`claimed_until.is.null,claimed_until.lt.${now.toISOString()}`)
    .select("id")
  if (!claimed?.length) return

  const found = await lookup(row)
  if (found) {
    await adopt(row, found)
    return
  }
  const release = () => db().update({ claimed_until: null }).eq("id", row.id)
  // Paystack couldn't be asked, it's too soon to call it lost, or a person has
  // to decide (refund_stuck fires after an hour).
  if (found === undefined || now.getTime() - Date.parse(row.updated_at) < RESEND_AFTER_MS || row.attempts >= MAX_ATTEMPTS) {
    await release()
    return
  }
  await db().update({ status: "queued", claimed_until: null, updated_at: now.toISOString() }).eq("id", row.id).eq("status", "unknown")
}

/** A refund Paystack accepted and no webhook has moved for a day: ask. */
async function refresh(row: Row): Promise<void> {
  if (!row.paystack_refund_id) return
  const res = await fetchRefund(row.paystack_refund_id)
  const to = res.ok ? refundStatusFrom(res.data.status) : null
  if (to) await moveRefund(row.id, to)
}

/**
 * Looks up every 'unknown' refund before anything is sent, then sends what's
 * queued; with `stale` (the daily cron), refreshes accepted ones no webhook has
 * moved. Never throws. Returns how many were sent or adopted.
 */
export async function runRefunds(opts: { stale?: boolean } = {}): Promise<number> {
  let n = 0
  const each = async (rows: Row[] | null, fn: (r: Row) => Promise<unknown>) => {
    for (const row of rows ?? []) {
      try {
        if ((await fn(row)) === true) n++
      } catch (err) {
        console.error("[paystack/refunds]", row.id, err)
      }
    }
  }
  try {
    // A runner that stopped mid-send (a timeout, a crash) left 'sending' past its
    // lease. Paystack may have the refund, so it's unknown: looked up below, never resent blind.
    const lost = await db().select(COLUMNS).eq("status", "sending").lt("claimed_until", new Date().toISOString()).limit(BATCH)
    await each(lost.data as Row[] | null, async (r) => {
      await moveRefund(r.id, "unknown", { last_error: "The sender stopped before Paystack answered" })
    })
    const unknown = await db().select(COLUMNS).eq("status", "unknown").limit(BATCH)
    await each(unknown.data as Row[] | null, resolveUnknown)
    const queued = await db().select(COLUMNS).eq("status", "queued").limit(BATCH)
    await each(queued.data as Row[] | null, send)
    if (opts.stale) {
      const accepted = await db()
        .select(COLUMNS)
        .in("status", ["pending", "processing", "needs_attention"])
        .lt("updated_at", new Date(Date.now() - STALE_MS).toISOString())
        .limit(BATCH)
      await each(accepted.data as Row[] | null, refresh)
    }
  } catch (err) {
    console.error("[paystack/refunds] run failed:", err)
  }
  return n
}

export const runRefundsLater = (): void => later(() => runRefunds())

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {})

/**
 * refund.pending, .processing, .needs-attention, .processed and .failed. The row
 * is found by Paystack's id, or, before the id is known, through the charge and
 * the §3.3 match; it then moves forward only. A refund that's none of ours is
 * 'unmatched', for a person.
 */
export async function handleRefundEvent(event: string, data: unknown): Promise<PaystackOutcome> {
  const to = refundStatusFrom(event.slice("refund.".length))
  if (!to) return "ignored"
  const d = obj(data)
  const id = d.id != null ? String(d.id) : d.refund_id != null ? String(d.refund_id) : null
  const reference = (typeof d.transaction_reference === "string" && d.transaction_reference) || (obj(d.transaction).reference as string | undefined) || null

  let row: Row | null = null
  if (id) {
    const { data: byId, error } = await db().select(COLUMNS).eq("paystack_refund_id", id).maybeSingle()
    if (error) throw new Error(error.message)
    row = byId as Row | null
  }
  if (!row && id && reference) {
    const { data: open, error } = await db().select(COLUMNS).eq("original_payment_reference", reference).is("paystack_refund_id", null)
    if (error) throw new Error(error.message)
    const res = await fetchRefund(id)
    if (res.ok) {
      const candidates = (open ?? []) as Row[]
      row =
        candidates.find((r) => r.idempotency_key === res.data.merchantNote) ??
        (res.data.merchantNote ? null : (candidates.find((r) => r.amount_ngn === res.data.amountNgn) ?? null))
    }
  }
  if (!row) return "unmatched"
  return (await moveRefund(row.id, to, id ? { paystack_refund_id: id } : {})) ? "settled" : "duplicate"
}
