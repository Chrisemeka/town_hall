import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/billing", () => ({ applySubscription: vi.fn(async () => "ok") }))
vi.mock("@/lib/paystack/notify", () => ({ emailBuilder: vi.fn(), later: vi.fn(), site: () => "https://twnhall.com" }))
vi.mock("@/lib/paystack/charges", () => ({ settleCharge: vi.fn(async () => "settled") }))
vi.mock("@/lib/paystack/actions", () => ({ runBillingActionsLater: vi.fn() }))
vi.mock("@/lib/paystack/client", async (original) => {
  const real = await original<typeof import("@/lib/paystack/client")>()
  return { ...real, fetchSubscription: vi.fn(), fetchRefund: vi.fn(), listRefunds: vi.fn() }
})

import { applySubscription } from "@/lib/billing"
import { settleCharge } from "@/lib/paystack/charges"
import { eventFields, handlePaystackEvent } from "@/lib/paystack/events"
import { emailBuilder } from "@/lib/paystack/notify"
import { fetchSubscription } from "@/lib/paystack/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { fakeDb } from "./fakeDb"

const ME = "11111111-1111-4111-8111-111111111111"
const row = (over: Record<string, unknown> = {}) => ({
  profile_id: ME,
  plan_id: "starter",
  status: "active",
  source: "paystack",
  period_end: "2026-12-04T09:00:00Z",
  provider_status: "active",
  provider_customer_id: "CUS_1",
  provider_subscription_id: "SUB_1",
  ...over,
})
const world = (subscriptions: Record<string, unknown>[] = []) => vi.mocked(createAdminClient).mockReturnValue(fakeDb({ subscriptions }) as never)
const applied = () => vi.mocked(applySubscription).mock.calls.map(([a]) => a)
const ROW_FOR_LATE = row({ profile_id: "p-late", provider_customer_id: "CUS_late" })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PAYSTACK_PLAN_STARTER", "PLN_s")
  vi.stubEnv("PAYSTACK_PLAN_PRO", "PLN_p")
  vi.mocked(applySubscription).mockResolvedValue("ok")
  vi.mocked(fetchSubscription).mockResolvedValue({ ok: false, message: "not found", permanent: true })
})

describe("charge.success", () => {
  it("goes to settleCharge, mapped, and answers with its outcome", async () => {
    vi.mocked(settleCharge).mockResolvedValue("duplicate")
    const outcome = await handlePaystackEvent({ event: "charge.success", data: { reference: "r", amount: 1_500_000 } })
    expect(outcome).toBe("duplicate")
    expect(vi.mocked(settleCharge).mock.calls[0][0]).toMatchObject({ reference: "r", amountNgn: 15000 })
  })
})

describe("subscription.create", () => {
  const event = (over: Record<string, unknown> = {}) => ({
    event: "subscription.create",
    data: {
      subscription_code: "SUB_1",
      email_token: "tok",
      status: "active",
      next_payment_date: "2026-12-04T09:00:00Z",
      plan: { plan_code: "PLN_s" },
      customer: { customer_code: "CUS_1" },
      authorization: { authorization_code: "AUTH_secret", last4: "4081", brand: "visa" },
      ...over,
    },
  })

  it("attaches a missing code and the real period end, with no authorization code", async () => {
    world([row({ provider_subscription_id: null })])
    expect(await handlePaystackEvent(event())).toBe("settled")
    expect(applied()[0]).toMatchObject({ action: "attach", userId: ME, providerSubscriptionId: "SUB_1", providerEmailToken: "tok", periodEnd: "2026-12-04T09:00:00Z" })
    expect(JSON.stringify(applied()[0])).not.toContain("AUTH_secret")
  })

  it("is safe to run twice", async () => {
    world([row()])
    expect(await handlePaystackEvent(event())).toBe("settled")
    expect(await handlePaystackEvent(event())).toBe("settled")
  })

  it("arriving before the charge is unmatched, and changes nothing", async () => {
    world()
    expect(await handlePaystackEvent(event())).toBe("unmatched")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("a late event for an older subscription never overwrites the row's code", async () => {
    world([row({ provider_subscription_id: "SUB_new" })])
    expect(await handlePaystackEvent(event({ subscription_code: "SUB_old" }))).toBe("unmatched")
    expect(applySubscription).not.toHaveBeenCalled()
  })
})

describe("invoice.payment_failed", () => {
  const event = { event: "invoice.payment_failed", data: { subscription: { subscription_code: "SUB_1" } } }

  it("marks attention, emails, and changes no plan", async () => {
    world([row()])
    expect(await handlePaystackEvent(event)).toBe("settled")
    expect(applied()).toEqual([expect.objectContaining({ action: "attach", providerStatus: "attention" })])
    expect(emailBuilder).toHaveBeenCalledWith(ME, "subscription-payment-failed", expect.objectContaining({ subject: "Your Starter payment didn't go through" }))
  })

  it("a redelivery sends no second email", async () => {
    world([row({ provider_status: "attention" })])
    expect(await handlePaystackEvent(event)).toBe("duplicate")
    expect(applySubscription).not.toHaveBeenCalled()
    expect(emailBuilder).not.toHaveBeenCalled()
  })

  it("an unknown subscription is unmatched", async () => {
    world()
    expect(await handlePaystackEvent(event)).toBe("unmatched")
  })
})

describe.each(["subscription.not_renew", "subscription.disable"])("%s", (name) => {
  const event = { event: name, data: { subscription_code: "SUB_1" } }

  it("cancelled on Paystack's page: schedules Community and emails", async () => {
    world([row()])
    expect(await handlePaystackEvent(event)).toBe("settled")
    expect(applied()).toEqual([expect.objectContaining({ action: "schedule", planId: "community", userId: ME })])
    expect(emailBuilder).toHaveBeenCalledWith(ME, "subscription-cancelled", expect.objectContaining({ subject: "Starter cancelled" }))
  })

  it("after our own Cancel is a no-op", async () => {
    world([row(), { profile_id: ME, status: "scheduled", plan_id: "community" }])
    expect(await handlePaystackEvent(event)).toBe("duplicate")
    expect(applySubscription).not.toHaveBeenCalled()
    expect(emailBuilder).not.toHaveBeenCalled()
  })

  it("for a subscription a newer one replaced ends nothing", async () => {
    world([row({ provider_subscription_id: "SUB_new" })])
    expect(await handlePaystackEvent(event)).toBe("duplicate")
    expect(applySubscription).not.toHaveBeenCalled()
  })
})

describe("everything else", () => {
  it.each(["invoice.create", "invoice.update", "transfer.success"])("%s is acknowledged", async (name) => {
    expect(await handlePaystackEvent({ event: name, data: {} })).toBe("ignored")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("survives a payload that isn't one", async () => {
    expect(await handlePaystackEvent(null)).toBe("ignored")
    expect(eventFields(null)).toEqual({ event: "unknown", reference: null, subscription_code: null })
  })
})

describe("a late subscription.create for an unwanted charge's own subscription", () => {
  it("is switched off once its own invoices show a charge we recorded as a duplicate", async () => {
    const db = fakeDb({
      subscriptions: [{ ...ROW_FOR_LATE, provider_subscription_id: "SUB_first" }],
      subscription_payments: [{ reference: "twnhall-sub-2", kind: "duplicate", profile_id: "p-late" }],
      billing_actions: [],
    })
    vi.mocked(createAdminClient).mockReturnValue(db as never)
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: { subscriptionCode: "SUB_dup", emailToken: "t", invoiceReferences: ["twnhall-sub-2"] } } as never)
    expect(await handlePaystackEvent({ event: "subscription.create", data: { subscription_code: "SUB_dup", email_token: "t", plan: { plan_code: "PLN_s" }, customer: { customer_code: "CUS_late" } } })).toBe("unmatched")
    expect(db.tables.billing_actions).toEqual([expect.objectContaining({ kind: "disable_subscription", subscription_code: "SUB_dup", idempotency_key: "disable:SUB_dup", profile_id: "p-late" })])
  })

  it("anything else is left alone", async () => {
    const db = fakeDb({ subscriptions: [{ ...ROW_FOR_LATE, provider_subscription_id: "SUB_first" }], subscription_payments: [], billing_actions: [] })
    vi.mocked(createAdminClient).mockReturnValue(db as never)
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: { subscriptionCode: "SUB_other", invoiceReferences: ["x"] } } as never)
    await handlePaystackEvent({ event: "subscription.create", data: { subscription_code: "SUB_other", plan: { plan_code: "PLN_s" }, customer: { customer_code: "CUS_late" } } })
    expect(db.tables.billing_actions).toEqual([])
  })
})
