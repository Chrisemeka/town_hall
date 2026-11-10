import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/billing", () => ({ applySubscription: vi.fn(async () => "ok") }))
vi.mock("@/lib/events", () => ({ recordEventLater: vi.fn() }))
vi.mock("@/lib/paystack/actions", () => ({ runBillingActionsLater: vi.fn() }))
vi.mock("@/lib/paystack/refunds", () => ({ runRefundsLater: vi.fn(), announceRefund: vi.fn() }))

import { markPaidOutside, refundPayment, retryRefund } from "@/actions/admin/billing"
import { requireAdmin } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { recordEventLater } from "@/lib/events"
import { runBillingActionsLater } from "@/lib/paystack/actions"
import { announceRefund, runRefundsLater } from "@/lib/paystack/refunds"
import { fakeDb } from "@/lib/__tests__/fakeDb"

const ADMIN = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const PAY = "33333333-3333-4333-8333-333333333333"
const KEY = "44444444-4444-4444-8444-444444444444"
const FAILED = "55555555-5555-4555-8555-555555555555"

function world(tables: Record<string, Record<string, unknown>[]> = {}, queued: Record<string, unknown> = { result: "ok", id: "r-new", amount_ngn: 15000 }) {
  const db = fakeDb(
    {
      subscription_payments: [{ id: PAY, profile_id: USER, source: "paystack" }],
      subscription_refunds: [],
      subscriptions: [],
      ...tables,
    },
    { rpc: { queue_refund: () => queued } },
  )
  vi.mocked(requireAdmin).mockResolvedValue({ admin: { ...db, from: db.from, rpc: db.rpc }, adminUserId: ADMIN } as never)
  return db
}

const refund = { paymentId: PAY, amountNgn: 15000, reason: "Asked for it back", refundKey: KEY, endPlan: false }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("refundPayment", () => {
  it("a non-admin is refused before anything is read", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Not authorized"))
    await expect(refundPayment(refund)).rejects.toThrow("Not authorized")
  })

  it("queues a Paystack refund under the dialog's own key, and sends it", async () => {
    const db = world()
    expect(await refundPayment(refund)).toEqual({ ok: true })
    expect(db.rpcCalls[0]).toEqual({
      name: "queue_refund",
      args: { p_payment_id: PAY, p_amount_ngn: 15000, p_reason: "admin", p_key: `admin:${KEY}`, p_note: "Asked for it back", p_status: "queued" },
    })
    expect(runRefundsLater).toHaveBeenCalled()
    expect(announceRefund).not.toHaveBeenCalled()
    expect(recordEventLater).toHaveBeenCalledWith(expect.objectContaining({ name: "billing.refunded", props: { by: ADMIN, amount_ngn: 15000 } }))
  })

  it("a double-submitted dialog carries the same key both times: one refund", async () => {
    const db = world()
    await refundPayment(refund)
    await refundPayment(refund)
    expect(new Set(db.rpcCalls.map((c) => c.args.p_key))).toEqual(new Set([`admin:${KEY}`]))
  })

  it("a manual payment is recorded as paid back by transfer, which it needs the reference of", async () => {
    const db = world({ subscription_payments: [{ id: PAY, profile_id: USER, source: "manual" }] })
    expect(await refundPayment(refund)).toMatchObject({ ok: false, error: expect.stringContaining("transfer") })
    expect(await refundPayment({ ...refund, transferReference: "TRF-9" })).toEqual({ ok: true })
    expect(db.rpcCalls.at(-1)?.args).toMatchObject({ p_status: "settled_outside", p_note: "Asked for it back · transfer TRF-9" })
    expect(announceRefund).toHaveBeenCalledWith("r-new")
    expect(runRefundsLater).not.toHaveBeenCalled()
  })

  it("nothing left on the payment says so", async () => {
    world({}, { result: "nothing_refundable" })
    expect(await refundPayment(refund)).toEqual({ ok: false, error: "Nothing is left to refund on that payment." })
  })

  it("'end the plan now' ends it and switches off the active and the scheduled subscription", async () => {
    world({
      subscriptions: [
        { profile_id: USER, status: "active", provider_subscription_id: "SUB_pro", provider_email_token: "t1" },
        { profile_id: USER, status: "scheduled", provider_subscription_id: "SUB_starter", provider_email_token: "t2" },
      ],
    })
    await refundPayment({ ...refund, endPlan: true })
    expect(applySubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "end",
        userId: USER,
        changedBy: ADMIN,
        actions: [
          expect.objectContaining({ subscription_code: "SUB_pro", idempotency_key: "disable:SUB_pro" }),
          expect.objectContaining({ subscription_code: "SUB_starter", idempotency_key: "disable:SUB_starter" }),
        ],
      }),
    )
    expect(runBillingActionsLater).toHaveBeenCalled()
  })

  it("without the box, the plan is left alone", async () => {
    world()
    await refundPayment(refund)
    expect(applySubscription).not.toHaveBeenCalled()
  })
})

describe("a failed refund", () => {
  const failed = { id: FAILED, profile_id: USER, payment_id: PAY, reason: "upgrade", idempotency_key: "upgrade:twnhall-sub-pro", status: "failed" }

  it("Try again makes a new row through the clamp, copying the calculation", async () => {
    const db = world({ subscription_refunds: [failed] })
    expect(await retryRefund({ refundId: FAILED })).toEqual({ ok: true })
    expect(db.rpcCalls[0].args).toMatchObject({ p_payment_id: PAY, p_reason: "upgrade", p_key: "upgrade:twnhall-sub-pro:retry-1", p_status: "queued", p_copy_from: FAILED })
    expect(runRefundsLater).toHaveBeenCalled()
  })

  it("only a failed one", async () => {
    world({ subscription_refunds: [{ ...failed, status: "pending" }] })
    expect(await retryRefund({ refundId: FAILED })).toMatchObject({ ok: false })
  })

  it("Mark paid outside Paystack records the transfer and tells the builder", async () => {
    const db = world({ subscription_refunds: [failed] })
    expect(await markPaidOutside({ refundId: FAILED, transferReference: "TRF-1", note: "sent Friday" })).toEqual({ ok: true })
    expect(db.rpcCalls[0].args).toMatchObject({ p_key: "upgrade:twnhall-sub-pro:outside", p_status: "settled_outside", p_note: "transfer TRF-1 · sent Friday", p_copy_from: FAILED })
    expect(announceRefund).toHaveBeenCalledWith("r-new")
  })
})
