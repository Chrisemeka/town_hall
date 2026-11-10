import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))
vi.mock("@/lib/auth", () => ({ requireAccount: vi.fn() }))
vi.mock("@/lib/alerts/run", () => ({ runAlertsLater: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/paystack/charges", () => ({ settleCharge: vi.fn(), BILLING_PROBLEMS: ["unmatched", "mismatch", "duplicate_charge"] }))
vi.mock("@/lib/paystack/client", () => ({ verifyTransaction: vi.fn() }))

import BillingReturnPage from "@/app/(developer)/settings/billing/return/page"
import { runAlertsLater } from "@/lib/alerts/run"
import { requireAccount } from "@/lib/auth"
import { settleCharge } from "@/lib/paystack/charges"
import { verifyTransaction } from "@/lib/paystack/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { fakeDb } from "@/lib/__tests__/fakeDb"

const ME = "11111111-1111-4111-8111-111111111111"
const REF = "twnhall-sub-1"
const go = (reference: string | undefined = REF) => BillingReturnPage({ searchParams: Promise.resolve({ reference }) })
const paid = (status = "success") => vi.mocked(verifyTransaction).mockResolvedValue({ ok: true, data: { reference: REF, status } } as never)

let db: ReturnType<typeof fakeDb>
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.mocked(requireAccount).mockResolvedValue({ userId: ME })
  db = fakeDb({ paystack_checkouts: [{ reference: REF, profile_id: ME }], paystack_events: [] })
  vi.mocked(createAdminClient).mockReturnValue(db as never)
  vi.mocked(settleCharge).mockResolvedValue("settled")
})

describe("/settings/billing/return", () => {
  it("answers another builder's reference with a 404, and never asks Paystack", async () => {
    vi.mocked(requireAccount).mockResolvedValue({ userId: "someone-else" })
    await expect(go()).rejects.toThrow("NOT_FOUND")
    expect(verifyTransaction).not.toHaveBeenCalled()
    expect(settleCharge).not.toHaveBeenCalled()
  })

  it("answers an unknown or missing reference with a 404", async () => {
    await expect(go("nope")).rejects.toThrow("NOT_FOUND")
    await expect(BillingReturnPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND")
    expect(verifyTransaction).not.toHaveBeenCalled()
  })

  it("settles what Paystack verifies, never the query string", async () => {
    paid()
    await expect(go()).rejects.toThrow("REDIRECT /settings?tab=plan&billing=started")
    expect(verifyTransaction).toHaveBeenCalledWith(REF)
    expect(vi.mocked(settleCharge).mock.calls[0][0]).toMatchObject({ reference: REF, status: "success" })
  })

  it("reads a duplicate as success: the webhook got there first", async () => {
    paid()
    vi.mocked(settleCharge).mockResolvedValue("duplicate")
    await expect(go()).rejects.toThrow("billing=started")
  })

  it.each(["abandoned", "failed", "reversed"])("grants nothing for %s, and raises no alarm", async (status) => {
    paid(status)
    await expect(go()).rejects.toThrow("billing=not_completed")
    expect(settleCharge).not.toHaveBeenCalled()
    expect(runAlertsLater).not.toHaveBeenCalled()
  })

  it("says 'confirming' while Paystack is still processing, or can't be asked", async () => {
    paid("ongoing")
    await expect(go()).rejects.toThrow("billing=pending")
    vi.mocked(verifyTransaction).mockResolvedValue({ ok: false, message: "down", permanent: false })
    await expect(go()).rejects.toThrow("billing=pending")
    expect(settleCharge).not.toHaveBeenCalled()
  })

  it("says 'confirming' if settling throws: the webhook will retry it", async () => {
    paid()
    vi.mocked(settleCharge).mockRejectedValue(new Error("db down"))
    await expect(go()).rejects.toThrow("billing=pending")
  })

  it("a second payment for a plan they have says it's being refunded, both ways round", async () => {
    paid()
    vi.mocked(settleCharge).mockResolvedValue("duplicate_charge")
    await expect(go()).rejects.toThrow("billing=refunding")
    expect(runAlertsLater).toHaveBeenCalledWith(["billing_mismatch"])
    // The webhook recorded it first: "duplicate" here, but never "started".
    vi.mocked(settleCharge).mockResolvedValue("duplicate")
    db.tables.subscription_payments = [{ reference: REF, kind: "duplicate" }]
    await expect(go()).rejects.toThrow("billing=refunding")
  })

  it("records a charge that granted nothing, and runs the alert at once", async () => {
    paid()
    vi.mocked(settleCharge).mockResolvedValue("mismatch")
    await expect(go()).rejects.toThrow("billing=review")
    expect(db.tables.paystack_events[0]).toMatchObject({ reference: REF, outcome: "mismatch" })
    expect(runAlertsLater).toHaveBeenCalledWith(["billing_mismatch"])
  })
})
