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

import { lagosDate } from "@/lib/subscriptions"
import { testerLabel, testerNumbers } from "@/lib/testerNumbers"
import { planFor } from "@/lib/plans"
import { planIdFor } from "@/lib/vocabulary"

export type BillingEvent = {
  /** ISO */
  at: string
  event:
    | "Payment"
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
  subscriptions: {
    plan_id: string
    status: string
    source: string
    period_start: string
    period_end: string | null
    amount_ngn: number | null
    payment_reference: string | null
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

export function billingRecord(input: BillingInput): BillingEvent[] {
  const title = new Map(input.missions.map((m) => [m.id, m.title]))
  const titleOf = (id: string | null) => (id ? (title.get(id) ?? null) : null)
  const base = { testCase: null, slots: null, amountNgn: null, reference: null }
  const out: BillingEvent[] = []

  for (const s of input.subscriptions) {
    // Comped (no amount) isn't a payment, and can't be disputed.
    if (s.amount_ngn === null) continue
    const period = `${lagosDate(s.period_start)} – ${s.period_end ? lagosDate(s.period_end) : "open-ended"}`
    out.push({
      ...base,
      at: s.created_at,
      event: "Payment",
      detail: `${planName(s.plan_id)}, ${period} (${s.status}, ${s.source})`,
      amountNgn: s.amount_ngn,
      reference: s.payment_reference,
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
