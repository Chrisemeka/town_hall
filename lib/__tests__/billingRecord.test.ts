import { describe, expect, it } from "vitest"
import { billingRecord, type BillingInput } from "@/lib/billingRecord"

// The billing record leaves Twnhall: it goes to Paystack and the card issuer.
// A tester is "Tester N" in it and nothing else, and the admin's reason for a
// plan change never appears.

const M1 = "11111111-1111-4111-8111-111111111111"
const TESTER_ID = "99999999-9999-4999-8999-999999999999"

const input = (over: Partial<BillingInput> = {}): BillingInput => ({
  payments: [
    {
      plan_id: "starter",
      kind: "manual",
      source: "manual",
      period_start: "2026-10-20T09:00:00Z",
      period_end: "2026-11-20T09:00:00Z",
      amount_ngn: 30000,
      reference: "PSK-123",
      created_at: "2026-10-20T09:00:00Z",
    },
  ],
  refunds: [],
  planChanges: [{ from_value: null, to_value: "starter", created_at: "2026-10-20T09:00:01Z" }],
  ledger: [
    { kind: "reserved", bucket: "monthly", slots: -5, mission_id: M1, created_at: "2026-10-25T10:00:00Z" },
    { kind: "released", bucket: "monthly", slots: 2, mission_id: M1, created_at: "2026-11-02T10:00:00Z" },
    { kind: "carried", bucket: "carried", slots: 2, mission_id: M1, created_at: "2026-11-02T10:00:00Z" },
    { kind: "grant", bucket: "grant", slots: 3, mission_id: null, created_at: "2026-10-01T10:00:00Z" },
  ],
  reports: [
    { id: "r2", mission_id: M1, created_at: "2026-10-27T10:00:00Z", status: "approved" },
    { id: "r1", mission_id: M1, created_at: "2026-10-26T10:00:00Z", status: "pending" },
  ],
  missions: [{ id: M1, title: "Sign-up walkthrough" }],
  ...over,
})

describe("billingRecord", () => {
  it("lists every kind of event, oldest first", () => {
    const events = billingRecord(input())
    expect(events.map((e) => e.event)).toEqual([
      "Payment",
      "Plan change",
      "Test case published",
      "Report delivered",
      "Report delivered",
      "Reports returned",
      "Reports carried",
    ])
    const at = events.map((e) => Date.parse(e.at))
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it("records the payment with its amount, reference and period", () => {
    const [payment] = billingRecord(input())
    expect(payment).toMatchObject({ amountNgn: 30000, reference: "PSK-123" })
    expect(payment.detail).toContain("Starter")
  })

  it("lists a comped period as no payment at all", () => {
    expect(billingRecord(input({ payments: [] })).some((e) => e.event === "Payment")).toBe(false)
  })

  it("gives two payments two rows", () => {
    const [first] = input().payments
    const renewal = { ...first, kind: "renewal", source: "paystack", reference: "PSK-124", created_at: "2026-11-20T09:00:00Z" }
    const rows = billingRecord(input({ payments: [first, renewal] })).filter((e) => e.event === "Payment")
    expect(rows.map((e) => e.reference)).toEqual(["PSK-123", "PSK-124"])
    expect(rows[1].detail).toContain("renewal, paystack")
  })

  it("doesn't show a reference only the database generated", () => {
    const [first] = input().payments
    const made = { ...first, reference: "backfill-11111111-1111-4111-8111-111111111111" }
    expect(billingRecord(input({ payments: [made] })).find((e) => e.event === "Payment")?.reference).toBeNull()
  })

  describe("refunds", () => {
    const refund: BillingInput["refunds"][number] = {
      reason: "admin",
      status: "pending",
      amount_ngn: 5000,
      original_payment_reference: "PSK-123",
      causing_payment_reference: null,
      upgrade_on: null,
      period_start_on: null,
      period_end_on: null,
      days_in_period: null,
      refundable_days: null,
      base_ngn: null,
      created_at: "2026-10-28T09:00:00Z",
    }
    const row = (over: Partial<typeof refund>) => billingRecord(input({ refunds: [{ ...refund, ...over }] })).find((e) => e.event === "Refund")!

    it("says what each status means, and 'refunded' for none of them", () => {
      const words: Record<string, string> = {
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
      for (const [status, word] of Object.entries(words)) {
        const { detail, amountNgn } = row({ status })
        expect(detail).toContain(`Refund ${word}.`)
        expect(detail).not.toMatch(/refunded/i)
        expect(amountNgn).toBe(5000)
      }
    })

    it("explains an upgrade refund from its stored columns", () => {
      const { detail, reference } = row({
        reason: "upgrade",
        status: "processing",
        amount_ngn: 9500,
        causing_payment_reference: "twnhall-sub-pro",
        upgrade_on: "2026-11-14",
        period_start_on: "2026-11-04",
        period_end_on: "2026-12-04",
        days_in_period: 30,
        refundable_days: 19,
        base_ngn: 15000,
      })
      expect(detail).toBe(
        "Refund processing. Upgrade to Pro (ref twnhall-sub-pro) on 14 Nov. Starter paid 4 Nov (ref PSK-123), ₦15,000 for 4 Nov – 3 Dec. 19 of 30 days unused, Lagos time: ₦9,500.",
      )
      expect(reference).toBe("PSK-123")
    })
  })

  it("names a delivered report Tester N, numbered within its test case", () => {
    const delivered = billingRecord(input()).filter((e) => e.event === "Report delivered")
    expect(delivered.map((e) => e.detail)).toEqual(["Tester 1, pending", "Tester 2, approved"])
    expect(delivered[0].testCase).toBe("Sign-up walkthrough")
  })

  it("reads a carried row as Reports carried, and the pool in words", () => {
    const events = billingRecord(input())
    expect(events.find((e) => e.event === "Reports carried")).toMatchObject({ slots: 2 })
    expect(events.find((e) => e.event === "Test case published")?.detail).toBe("Reports from: paid this month")
  })

  it("never carries a tester's id, name or email, or the admin's reason", () => {
    // A hostile fixture: the fields the reads never select, smuggled in anyway.
    const hostile = {
      ...input(),
      reports: input().reports.map((r) => ({ ...r, tester_id: TESTER_ID, full_name: "Ada Tester", email: "ada@tester.ng" })),
      payments: input().payments.map((p) => ({ ...p, reason: "Friend of the founder" })),
      refunds: [
        {
          reason: "admin",
          status: "processed",
          amount_ngn: 100,
          original_payment_reference: "PSK-123",
          causing_payment_reference: null,
          upgrade_on: null,
          period_start_on: null,
          period_end_on: null,
          days_in_period: null,
          refundable_days: null,
          base_ngn: null,
          created_at: "2026-10-28T09:00:00Z",
          note: "Refund note for Amos",
          last_error: "bank said no",
        },
      ],
      planChanges: input().planChanges.map((c) => ({ ...c, changed_by: "admin-1", reason: "Comped by Amos" })),
    }
    const text = JSON.stringify(billingRecord(hostile))
    for (const secret of [TESTER_ID, "Ada Tester", "ada@tester.ng", "Friend of the founder", "Comped by Amos", "admin-1", "Refund note for Amos", "bank said no"]) {
      expect(text).not.toContain(secret)
    }
  })
})
