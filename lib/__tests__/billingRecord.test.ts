import { describe, expect, it } from "vitest"
import { billingRecord, type BillingInput } from "@/lib/billingRecord"

// The billing record leaves Twnhall: it goes to Paystack and the card issuer.
// A tester is "Tester N" in it and nothing else, and the admin's reason for a
// plan change never appears.

const M1 = "11111111-1111-4111-8111-111111111111"
const TESTER_ID = "99999999-9999-4999-8999-999999999999"

const input = (over: Partial<BillingInput> = {}): BillingInput => ({
  subscriptions: [
    {
      plan_id: "starter",
      status: "active",
      source: "manual",
      period_start: "2026-10-20T09:00:00Z",
      period_end: "2026-11-20T09:00:00Z",
      amount_ngn: 30000,
      payment_reference: "PSK-123",
      created_at: "2026-10-20T09:00:00Z",
    },
  ],
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

  it("leaves a comped subscription out of the payments", () => {
    const comped = input().subscriptions.map((s) => ({ ...s, amount_ngn: null }))
    expect(billingRecord(input({ subscriptions: comped })).some((e) => e.event === "Payment")).toBe(false)
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
      subscriptions: input().subscriptions.map((s) => ({ ...s, reason: "Friend of the founder" })),
      planChanges: input().planChanges.map((c) => ({ ...c, changed_by: "admin-1", reason: "Comped by Amos" })),
    }
    const text = JSON.stringify(billingRecord(hostile))
    for (const secret of [TESTER_ID, "Ada Tester", "ada@tester.ng", "Friend of the founder", "Comped by Amos", "admin-1"]) {
      expect(text).not.toContain(secret)
    }
  })
})
