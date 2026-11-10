import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/paystack/notify", () => ({ emailBuilder: vi.fn(), later: vi.fn(), site: () => "https://twnhall.com" }))
vi.mock("@/lib/paystack/client", () => ({ createRefund: vi.fn(), fetchRefund: vi.fn(), listRefunds: vi.fn() }))

import { createAdminClient } from "@/lib/supabase/admin"
import { createRefund, fetchRefund, listRefunds, type PaystackRefund } from "@/lib/paystack/client"
import { emailBuilder } from "@/lib/paystack/notify"
import { handleRefundEvent, runRefunds } from "@/lib/paystack/refunds"
import { canMoveRefund, refundLine, refundNotice } from "@/lib/subscriptions"
import { fakeDb } from "./fakeDb"

const MIN = 60 * 1000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

const refund = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  profile_id: "p1",
  reason: "upgrade",
  original_payment_reference: "twnhall-sub-starter",
  amount_ngn: 9500,
  idempotency_key: "upgrade:twnhall-sub-pro",
  status: "queued",
  paystack_refund_id: null,
  attempts: 0,
  notified_status: null,
  claimed_until: null,
  created_at: ago(60 * MIN),
  updated_at: ago(60 * MIN),
  ...over,
})

const paystack = (over: Partial<PaystackRefund> = {}): PaystackRefund => ({
  id: "190",
  status: "pending",
  amountNgn: 9500,
  merchantNote: "upgrade:twnhall-sub-pro",
  createdAt: new Date().toISOString(),
  ...over,
})

function world(rows: Record<string, unknown>[]) {
  const db = fakeDb({ subscription_refunds: rows })
  vi.mocked(createAdminClient).mockReturnValue(db as never)
  return db
}
const row = (db: ReturnType<typeof world>, id = "r1") => db.tables.subscription_refunds.find((r) => r.id === id)!
const emails = () => vi.mocked(emailBuilder).mock.calls.map((c) => c[1])

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("sending", () => {
  it("sends the stored amount with our key as the note, and adopts Paystack's id and status", async () => {
    const db = world([refund()])
    vi.mocked(createRefund).mockResolvedValue({ ok: true, data: paystack() })
    expect(await runRefunds()).toBe(1)
    expect(createRefund).toHaveBeenCalledWith({ reference: "twnhall-sub-starter", amountNgn: 9500, merchantNote: "upgrade:twnhall-sub-pro" })
    expect(row(db)).toMatchObject({ status: "pending", paystack_refund_id: "190", attempts: 1, notified_status: "started" })
    expect(emails()).toEqual(["refund-started"])
  })

  it("two runners at once send once: the lease", async () => {
    world([refund()])
    vi.mocked(createRefund).mockResolvedValue({ ok: true, data: paystack() })
    await Promise.all([runRefunds(), runRefunds()])
    expect(createRefund).toHaveBeenCalledTimes(1)
  })

  it("a timeout is unknown: nothing assumed, nothing resent in the same run", async () => {
    const db = world([refund()])
    vi.mocked(createRefund).mockResolvedValue({ ok: false, message: "timeout", permanent: false })
    await runRefunds()
    expect(row(db).status).toBe("unknown")
    expect(createRefund).toHaveBeenCalledTimes(1)
    expect(listRefunds).not.toHaveBeenCalled()
    expect(emails()).toEqual([])
  })

  it("a refusal found at Paystack is adopted, not failed", async () => {
    const db = world([refund()])
    vi.mocked(createRefund).mockResolvedValue({ ok: false, message: "Transaction has been fully reversed", permanent: true })
    vi.mocked(listRefunds).mockResolvedValue({ ok: true, data: [paystack({ status: "processed" })] })
    await runRefunds()
    expect(row(db)).toMatchObject({ status: "processed", paystack_refund_id: "190" })
  })

  it("a refusal with nothing at Paystack fails, keeps the message, and tells the builder", async () => {
    const db = world([refund()])
    vi.mocked(createRefund).mockResolvedValue({ ok: false, message: "Refund amount exceeds", permanent: true })
    vi.mocked(listRefunds).mockResolvedValue({ ok: true, data: [] })
    await runRefunds()
    expect(row(db)).toMatchObject({ status: "failed", last_error: "Refund amount exceeds" })
    expect(emails()).toEqual(["refund-failed"])
  })

  it("never retries a failed refund by itself", async () => {
    world([refund({ status: "failed" })])
    await runRefunds({ stale: true })
    expect(createRefund).not.toHaveBeenCalled()
  })
})

describe("look up before resending", () => {
  it("an unknown refund found by its note is adopted, without sending again", async () => {
    const db = world([refund({ status: "unknown", attempts: 1 })])
    vi.mocked(listRefunds).mockResolvedValue({ ok: true, data: [paystack({ id: "other", merchantNote: "admin:x", amountNgn: 9500 }), paystack()] })
    await runRefunds()
    expect(row(db)).toMatchObject({ status: "pending", paystack_refund_id: "190" })
    expect(createRefund).not.toHaveBeenCalled()
  })

  it("without a note, the same amount made after the row and not already ours", async () => {
    const db = world([refund({ status: "unknown", attempts: 1 }), refund({ id: "r2", status: "processed", paystack_refund_id: "taken", idempotency_key: "k2" })])
    vi.mocked(listRefunds).mockResolvedValue({
      ok: true,
      data: [paystack({ id: "taken", merchantNote: null }), paystack({ id: "old", merchantNote: null, createdAt: ago(120 * MIN) }), paystack({ id: "190", merchantNote: null })],
    })
    await runRefunds()
    expect(row(db).paystack_refund_id).toBe("190")
  })

  it("nothing found after 10 minutes: sent once more, the stored amount", async () => {
    const db = world([refund({ status: "unknown", attempts: 1, updated_at: ago(11 * MIN) })])
    vi.mocked(listRefunds).mockResolvedValue({ ok: true, data: [] })
    vi.mocked(createRefund).mockResolvedValue({ ok: true, data: paystack() })
    await runRefunds()
    expect(createRefund).toHaveBeenCalledTimes(1)
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ amountNgn: 9500 }))
    expect(row(db)).toMatchObject({ status: "pending", attempts: 2 })
  })

  it("a sender that stopped mid-send is unknown once its lease ends, and looked up, not resent", async () => {
    const db = world([refund({ status: "sending", attempts: 1, claimed_until: ago(1 * MIN) }), refund({ id: "r2", status: "sending", attempts: 1, claimed_until: ago(-4 * MIN), idempotency_key: "k2" })])
    vi.mocked(listRefunds).mockResolvedValue({ ok: true, data: [paystack()] })
    await runRefunds()
    expect(row(db)).toMatchObject({ status: "pending", paystack_refund_id: "190" })
    expect(row(db, "r2").status).toBe("sending")
    expect(createRefund).not.toHaveBeenCalled()
  })

  it("nothing found under 10 minutes: wait", async () => {
    const db = world([refund({ status: "unknown", attempts: 1, updated_at: ago(2 * MIN) })])
    vi.mocked(listRefunds).mockResolvedValue({ ok: true, data: [] })
    await runRefunds()
    expect(createRefund).not.toHaveBeenCalled()
    expect(row(db).status).toBe("unknown")
  })

  it("after 3 attempts with nothing found it stops, for a person", async () => {
    const db = world([refund({ status: "unknown", attempts: 3, updated_at: ago(30 * MIN) })])
    vi.mocked(listRefunds).mockResolvedValue({ ok: true, data: [] })
    await runRefunds()
    expect(createRefund).not.toHaveBeenCalled()
    expect(row(db).status).toBe("unknown")
  })

  it("Paystack unreachable for the lookup: nothing resent", async () => {
    const db = world([refund({ status: "unknown", attempts: 1, updated_at: ago(30 * MIN) })])
    vi.mocked(listRefunds).mockResolvedValue({ ok: false, message: "down", permanent: false })
    await runRefunds()
    expect(createRefund).not.toHaveBeenCalled()
    expect(row(db).status).toBe("unknown")
  })

  it("the cron asks about accepted refunds no webhook moved for a day", async () => {
    const db = world([refund({ status: "pending", paystack_refund_id: "190", notified_status: "started", updated_at: ago(25 * 60 * MIN) })])
    vi.mocked(fetchRefund).mockResolvedValue({ ok: true, data: paystack({ status: "processed" }) })
    await runRefunds({ stale: true })
    expect(row(db).status).toBe("processed")
    expect(emails()).toEqual(["refund-processed"])
  })
})

describe("webhooks", () => {
  const evt = (name: string, data: Record<string, unknown> = { id: 190, transaction_reference: "twnhall-sub-starter" }) => handleRefundEvent(name, data)

  it("move forward, by Paystack's id, and email once per stage", async () => {
    const db = world([refund({ status: "pending", paystack_refund_id: "190", notified_status: "started" })])
    expect(await evt("refund.processing")).toBe("settled")
    expect(await evt("refund.processed")).toBe("settled")
    expect(row(db).status).toBe("processed")
    expect(row(db).finished_at).toBeTruthy()
    expect(emails()).toEqual(["refund-processed"])
  })

  it("a redelivery changes nothing and sends nothing", async () => {
    world([refund({ status: "processed", paystack_refund_id: "190", notified_status: "processed" })])
    expect(await evt("refund.processed")).toBe("duplicate")
    expect(emails()).toEqual([])
  })

  it("processing arriving after processed does nothing", async () => {
    const db = world([refund({ status: "processed", paystack_refund_id: "190", notified_status: "processed" })])
    expect(await evt("refund.processing")).toBe("duplicate")
    expect(row(db).status).toBe("processed")
  })

  it("an id we don't know yet is matched through the charge and its note", async () => {
    const db = world([refund({ status: "sending" })])
    vi.mocked(fetchRefund).mockResolvedValue({ ok: true, data: paystack() })
    expect(await evt("refund.pending")).toBe("settled")
    expect(row(db)).toMatchObject({ status: "pending", paystack_refund_id: "190" })
  })

  it("a refund that is none of ours is unmatched, for a person", async () => {
    world([])
    vi.mocked(fetchRefund).mockResolvedValue({ ok: true, data: paystack({ merchantNote: "someone else" }) })
    expect(await evt("refund.processed")).toBe("unmatched")
  })

  it("needs-attention is ours to fix: no builder email", async () => {
    const db = world([refund({ status: "pending", paystack_refund_id: "190", notified_status: "started" })])
    await evt("refund.needs-attention")
    expect(row(db).status).toBe("needs_attention")
    expect(emails()).toEqual([])
  })
})

describe("the rules, pure", () => {
  it("statuses only move forward", () => {
    expect(canMoveRefund("queued", "sending")).toBe(true)
    expect(canMoveRefund("unknown", "processed")).toBe(true)
    expect(canMoveRefund("processing", "needs_attention")).toBe(true)
    expect(canMoveRefund("needs_attention", "processing")).toBe(true)
    expect(canMoveRefund("processed", "processing")).toBe(false)
    expect(canMoveRefund("failed", "processed")).toBe(false)
    expect(canMoveRefund("processing", "pending")).toBe(false)
    expect(canMoveRefund("settled_outside", "processed")).toBe(false)
  })

  it("says refunded only when it is", () => {
    expect(refundNotice("started", 9500, "upgrade", "https://x").body).not.toMatch(/refunded|has been processed/)
    expect(refundNotice("started", 9500, "upgrade", "https://x").subject).toBe("Your refund of ₦9,500 has started")
    expect(refundNotice("failed", 9500, "upgrade", "https://x").body).toContain("within two business days")
    expect(refundLine({ amount_ngn: 9500, status: "queued", created_at: "2026-11-14T10:00:00Z", reason: "upgrade" })).toBe("Refund of ₦9,500 for Starter: on its way (started 14 Nov 2026).")
    expect(refundLine({ amount_ngn: 9500, status: "failed", created_at: "2026-11-14T10:00:00Z", reason: "upgrade" })).toContain("sorting this out")
  })
})
