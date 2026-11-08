// A builder's billing record: what they paid for and what was delivered, in
// date order. The evidence a Paystack dispute is answered with
// (docs/specs/SPEC-dispute-readiness.md).
//
// THIS FILE LEAVES TWNHALL. An admin downloads it and uploads it to Paystack,
// and the card issuer reads it, so the builder-export rule applies: a tester
// is "Tester N" (testerNumbers()) and nothing else. The inputs carry no tester
// id, and the admin's reason for a plan change is never an input — it's
// internal.
//
// Pure and import-light like lib/payouts.ts, so it's tested with fixtures.

import { formatNgn, lagosDate } from "@/lib/subscriptions"
import { testerLabel, testerNumbers } from "@/lib/testerNumbers"
import { planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"

export type BillingEvent = {
  /** ISO */
  at: string
  event:
    | "Payment"
    | "Refund"
    | "Plan change"
    | "Test case published"
    | "Reports returned"
    | "Reports carried"
    | "Report delivered"
  /** The builder's own title. */
  testCase: string | null
  detail: string
  slots: number | null
  amountNgn: number | null
  reference: string | null
}

export type BillingInput = {
  payments: {
    /** The plan of the subscription it paid for; null if that row is gone. */
    plan_id: string | null
    kind: string
    source: string
    period_start: string
    period_end: string | null
    amount_ngn: number
    reference: string
    created_at: string
  }[]
  /** Never carries `note` or `last_error`: both are internal. */
  refunds: {
    reason: string
    status: string
    amount_ngn: number
    original_payment_reference: string
    causing_payment_reference: string | null
    upgrade_on: string | null
    period_start_on: string | null
    period_end_on: string | null
    days_in_period: number | null
    refundable_days: number | null
    base_ngn: number | null
    created_at: string
  }[]
  planChanges: { from_value: string | null; to_value: string | null; created_at: string }[]
  ledger: { kind: string; bucket: string; slots: number; mission_id: string | null; created_at: string }[]
  reports: { id: string; mission_id: string; created_at: string; status: string }[]
  missions: { id: string; title: string }[]
}

const POOL: Record<string, string> = {
  monthly: "paid this month",
  carried: "carried",
  grant: "signup grant",
  earned: "earned",
}

const planName = (id: string | null) => planFor(planIdFor(id)).name

/** A refund's status in words. "Refunded" is not one of them: see processed. */
const REFUND_WORDS: Record<string, string> = {
  queued: "requested",
  sending: "requested",
  unknown: "requested",
  pending: "requested",
  processing: "processing",
  needs_attention: "processing",
  processed: "processed",
  failed: "failed",
  settled_outside: "paid back outside Paystack",
}

const REFUND_REASONS: Record<string, string> = {
  admin: "Refund of this payment.",
  stray_charge: "A charge after the plan ended.",
  duplicate_charge: "A second payment for a plan already paid for.",
}

/** "14 Nov", from a stored Lagos date. `back` days earlier, for an excluded end date. */
const dayOf = (date: string | null, back = 0) =>
  date
    ? new Date(Date.parse(`${date}T00:00:00Z`) - back * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : ""

/**
 * Read from the row's own columns, never recomputed: this is what was refunded.
 * ponytail: names Starter and Pro because proration-v1 only ever runs between
 * those two; a new tier gets a new rule version and a new sentence.
 */
function refundDetail(r: BillingInput["refunds"][number]): string {
  if (r.reason !== "upgrade") return REFUND_REASONS[r.reason] ?? "Refund."
  return (
    `Upgrade to Pro (ref ${r.causing_payment_reference}) on ${dayOf(r.upgrade_on)}. ` +
    `Starter paid ${dayOf(r.period_start_on)} (ref ${r.original_payment_reference}), ${formatNgn(r.base_ngn ?? 0)} for ${dayOf(r.period_start_on)} – ${dayOf(r.period_end_on, 1)}. ` +
    `${r.refundable_days} of ${r.days_in_period} days unused, Lagos time: ${formatNgn(r.amount_ngn)}.`
  )
}

/** A reference only the database generated, for a payment that came without one, means nothing to a card issuer. */
const shownReference = (reference: string) => (/^(manual|backfill)-[0-9a-f-]{36}$/.test(reference) ? null : reference)

export function billingRecord(input: BillingInput): BillingEvent[] {
  const title = new Map(input.missions.map((m) => [m.id, m.title]))
  const titleOf = (id: string | null) => (id ? (title.get(id) ?? null) : null)
  const base = { testCase: null, slots: null, amountNgn: null, reference: null }
  const out: BillingEvent[] = []

  // One per charge. Comped periods have no payment, and can't be disputed.
  for (const p of input.payments) {
    const period = `${lagosDate(p.period_start)} – ${p.period_end ? lagosDate(p.period_end) : "open-ended"}`
    const how = p.kind === p.source ? p.source : `${p.kind}, ${p.source}`
    out.push({
      ...base,
      at: p.created_at,
      event: "Payment",
      detail: `${p.plan_id ? planName(p.plan_id) : "Plan"}, ${period} (${how})`,
      amountNgn: p.amount_ngn,
      reference: shownReference(p.reference),
    })
  }

  for (const r of input.refunds) {
    out.push({
      ...base,
      at: r.created_at,
      event: "Refund",
      detail: `Refund ${REFUND_WORDS[r.status] ?? "requested"}. ${refundDetail(r)}`,
      amountNgn: r.amount_ngn,
      reference: shownReference(r.original_payment_reference),
    })
  }

  for (const c of input.planChanges) {
    out.push({ ...base, at: c.created_at, event: "Plan change", detail: `${planName(c.from_value)} → ${planName(c.to_value)}` })
  }

  for (const r of input.ledger) {
    const testCase = titleOf(r.mission_id)
    const slots = Math.abs(r.slots)
    if (r.kind === "reserved") {
      out.push({ ...base, at: r.created_at, event: "Test case published", testCase, slots, detail: `Reports from: ${POOL[r.bucket] ?? r.bucket}` })
    } else if (r.kind === "released") {
      out.push({ ...base, at: r.created_at, event: "Reports returned", testCase, slots, detail: "Unused when the test case closed" })
    } else if (r.kind === "carried") {
      out.push({ ...base, at: r.created_at, event: "Reports carried", testCase, slots, detail: "Came back after their month ended; do not expire" })
    }
  }

  const numbers = testerNumbers(input.reports)
  for (const r of input.reports) {
    out.push({
      ...base,
      at: r.created_at,
      event: "Report delivered",
      testCase: titleOf(r.mission_id),
      slots: 1,
      detail: `${testerLabel(numbers.get(r.id))}, ${r.status}`,
    })
  }

  // By instant, not by string: Postgres trims trailing zeros off fractional
  // seconds, so two ISO strings of one format don't always sort as times.
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
