import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/billing", () => ({ applySubscription: vi.fn(async () => "ok") }))
vi.mock("@/lib/events", () => ({ recordEvent: vi.fn() }))
vi.mock("@/lib/paystack/notify", () => ({ emailBuilder: vi.fn(), later: vi.fn(), site: () => "https://twnhall.com" }))
vi.mock("@/lib/paystack/actions", () => ({ runBillingActions: vi.fn() }))
vi.mock("@/lib/paystack/refunds", () => ({ runRefunds: vi.fn() }))
vi.mock("@/lib/paystack/client", async (original) => {
  const real = await original<typeof import("@/lib/paystack/client")>()
  return { ...real, fetchSubscription: vi.fn(), listSubscriptions: vi.fn() }
})

import { applySubscription } from "@/lib/billing"
import { settleCharge } from "@/lib/paystack/charges"
import { fetchSubscription, listSubscriptions, mapTransaction, type PaystackSubscription } from "@/lib/paystack/client"
import { emailBuilder, later } from "@/lib/paystack/notify"
import { createAdminClient } from "@/lib/supabase/admin"
import { fakeDb } from "./fakeDb"

const ME = "11111111-1111-4111-8111-111111111111"
const NEXT = "2026-12-04T09:00:00.000Z"

const charge = (over: Record<string, unknown> = {}) =>
  mapTransaction({
    reference: "twnhall-sub-1",
    status: "success",
    amount: 1_500_000,
    currency: "NGN",
    plan: { plan_code: "PLN_s" },
    paid_at: "2026-11-04T09:00:00.000Z",
    metadata: { profile_id: ME },
    customer: { id: 7, customer_code: "CUS_1" },
    authorization: { authorization_code: "AUTH_secret", last4: "4081", brand: "visa", reusable: true },
    ...over,
  })

const checkout = (over: Record<string, unknown> = {}) => ({
  reference: "twnhall-sub-1",
  profile_id: ME,
  plan_id: "starter",
  kind: "new",
  replaces_subscription_id: null,
  completed_at: null,
  ...over,
})

const paystackSub = (over: Partial<PaystackSubscription> = {}): PaystackSubscription => ({
  subscriptionCode: "SUB_1",
  createdAt: null,
  status: "active",
  emailToken: "tok",
  nextPaymentDate: NEXT,
  planCode: "PLN_s",
  customerCode: "CUS_1",
  customerId: 7,
  card: { last4: "4081", brand: "visa", reusable: true },
  invoiceReferences: ["twnhall-sub-1"],
  ...over,
})

const activeRow = (over: Record<string, unknown> = {}) => ({
  id: "row-1",
  account_id: "acc",
  profile_id: ME,
  plan_id: "starter",
  status: "active",
  source: "paystack",
  payment_reference: "twnhall-sub-0",
  period_end: "2026-11-04T09:00:00.000Z",
  provider_customer_id: "CUS_1",
  provider_subscription_id: "SUB_1",
  provider_email_token: "tok",
  card_last4: "4081",
  ...over,
})

function world(
  tables: { paystack_checkouts?: Record<string, unknown>[]; subscriptions?: Record<string, unknown>[] },
  rpc: Record<string, (args: Record<string, unknown>) => unknown> = {},
) {
  const db = fakeDb({ paystack_checkouts: [], subscriptions: [], ...tables }, { rpc })
  vi.mocked(createAdminClient).mockReturnValue(db as never)
  return db
}

const applied = () => vi.mocked(applySubscription).mock.calls.map(([a]) => a)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PAYSTACK_PLAN_STARTER", "PLN_s")
  vi.stubEnv("PAYSTACK_PLAN_PRO", "PLN_p")
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.mocked(applySubscription).mockResolvedValue("ok")
  vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [paystackSub()] })
  vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: paystackSub() })
})

describe("what is refused, granting nothing", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["a failed charge", { status: "failed" }],
    ["an underpayment", { amount: 1_499_900 }],
    ["an overpayment", { amount: 1_500_100 }],
    ["another currency", { currency: "USD" }],
    ["an unknown plan code", { plan: { plan_code: "PLN_other" } }],
    ["no plan at all, such as a payment link", { plan: {} }],
    ["Pro's plan at Starter's price", { plan: { plan_code: "PLN_p" } }],
  ]
  it.each(cases)("%s is a mismatch", async (_name, over) => {
    world({ paystack_checkouts: [checkout()] })
    expect(await settleCharge(charge(over))).toBe("mismatch")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("a charge claiming another builder's checkout is a mismatch", async () => {
    world({ paystack_checkouts: [checkout()] })
    expect(await settleCharge(charge({ metadata: { profile_id: "someone-else" } }))).toBe("mismatch")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("a checkout for a different plan than the one paid for is a mismatch", async () => {
    world({ paystack_checkouts: [checkout({ plan_id: "pro" })] })
    expect(await settleCharge(charge())).toBe("mismatch")
    expect(applySubscription).not.toHaveBeenCalled()
  })
})

describe("a first charge", () => {
  it("starts the plan with every provider field, and never an authorization code", async () => {
    const db = world({ paystack_checkouts: [checkout()] })
    expect(await settleCharge(charge())).toBe("settled")
    expect(applied()).toHaveLength(1)
    expect(applied()[0]).toMatchObject({
      action: "start",
      userId: ME,
      planId: "starter",
      source: "paystack",
      periodEnd: NEXT,
      amountNgn: 15000,
      paymentReference: "twnhall-sub-1",
      paymentKind: "first",
      providerCustomerId: "CUS_1",
      providerSubscriptionId: "SUB_1",
      providerEmailToken: "tok",
      providerPlanCode: "PLN_s",
      providerStatus: "active",
      cardLast4: "4081",
      cardBrand: "visa",
    })
    expect(JSON.stringify(applied()[0])).not.toContain("AUTH_secret")
    expect(db.tables.paystack_checkouts[0].completed_at).toBeTruthy()
    expect(emailBuilder).toHaveBeenCalledWith(ME, "subscription-started", expect.objectContaining({ subject: "You're on Starter" }))
  })

  it("uses a provisional month until Paystack has made the subscription", async () => {
    world({ paystack_checkouts: [checkout()] })
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [] })
    expect(await settleCharge(charge())).toBe("settled")
    expect(applied()[0]).toMatchObject({ periodEnd: "2026-12-04T09:00:00.000Z", providerSubscriptionId: null })
  })

  it("still starts the plan when Paystack can't be asked: the money is in", async () => {
    world({ paystack_checkouts: [checkout()] })
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: false, message: "down", permanent: false })
    expect(await settleCharge(charge())).toBe("settled")
  })

  it("a second delivery is a duplicate, with no second email", async () => {
    world({ paystack_checkouts: [checkout()] })
    vi.mocked(applySubscription).mockResolvedValue("duplicate")
    expect(await settleCharge(charge())).toBe("duplicate")
    expect(emailBuilder).not.toHaveBeenCalled()
  })

  it("a delivery after the checkout completed doesn't reach apply_subscription", async () => {
    world({ paystack_checkouts: [checkout({ completed_at: "2026-11-04T09:01:00Z" })] })
    expect(await settleCharge(charge())).toBe("duplicate")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("racing the other path isn't a duplicate charge: its own reference is on the row", async () => {
    world({ paystack_checkouts: [checkout()], subscriptions: [activeRow({ payment_reference: "twnhall-sub-1" })] })
    vi.mocked(applySubscription).mockResolvedValue("duplicate")
    expect(await settleCharge(charge())).toBe("duplicate")
  })

  it("replaces a manual plan the page was opened before", async () => {
    world({ paystack_checkouts: [checkout()], subscriptions: [activeRow({ source: "manual", provider_subscription_id: null })] })
    expect(await settleCharge(charge())).toBe("settled")
    expect(applied()[0]).toMatchObject({ action: "start", actions: [] })
  })
})

describe("a duplicate charge", () => {
  it("a second paid checkout for a plan already held changes nothing and is flagged", async () => {
    const db = world({ paystack_checkouts: [checkout()], subscriptions: [activeRow()] })
    expect(await settleCharge(charge())).toBe("duplicate_charge")
    expect(applySubscription).not.toHaveBeenCalled()
    expect(db.tables.paystack_checkouts[0].completed_at).toBeTruthy()
    expect(emailBuilder).not.toHaveBeenCalled()
  })

  it("a stale page for the other tier doesn't move the plan either", async () => {
    world({
      paystack_checkouts: [checkout({ plan_id: "pro" })],
      subscriptions: [activeRow()],
    })
    expect(await settleCharge(charge({ amount: 3_000_000, plan: { plan_code: "PLN_p" } }))).toBe("duplicate_charge")
    expect(applySubscription).not.toHaveBeenCalled()
  })
})

describe("a resubscribe", () => {
  it("starts a fresh period and queues the old subscription's disable with the payment", async () => {
    world({
      paystack_checkouts: [checkout({ kind: "resubscribe", replaces_subscription_id: "row-1" })],
      subscriptions: [activeRow({ provider_subscription_id: "SUB_old", provider_email_token: "old-tok" })],
    })
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [paystackSub({ subscriptionCode: "SUB_new" })] })
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: paystackSub({ subscriptionCode: "SUB_new" }) })
    expect(await settleCharge(charge())).toBe("settled")
    expect(applied()[0]).toMatchObject({
      action: "start",
      paymentKind: "resubscribe",
      providerSubscriptionId: "SUB_new",
      actions: [{ kind: "disable_subscription", subscription_code: "SUB_old", email_token: "old-tok", idempotency_key: "disable:SUB_old" }],
    })
    expect(later).toHaveBeenCalledOnce()
  })

  it("a retried webhook queues none: apply_subscription refuses it before queueing", async () => {
    world({
      paystack_checkouts: [checkout({ kind: "resubscribe", replaces_subscription_id: "row-1" })],
      subscriptions: [activeRow()],
    })
    vi.mocked(applySubscription).mockResolvedValue("duplicate")
    expect(await settleCharge(charge())).toBe("duplicate")
    expect(later).not.toHaveBeenCalled()
  })
})

describe("a renewal", () => {
  const renewal = (over: Record<string, unknown> = {}) => charge({ reference: "ps-renewal-1", metadata: {}, ...over })

  it("extends to Paystack's next_payment_date and records the payment", async () => {
    world({ subscriptions: [activeRow()] })
    expect(await settleCharge(renewal())).toBe("settled")
    expect(applied()[0]).toMatchObject({
      action: "extend",
      userId: ME,
      periodEnd: NEXT,
      amountNgn: 15000,
      paymentReference: "ps-renewal-1",
      paymentKind: "renewal",
      providerStatus: "active",
    })
    expect(emailBuilder).toHaveBeenCalledWith(ME, "subscription-renewed", expect.objectContaining({ subject: "Payment received for Starter" }))
  })

  it("doesn't take a stale next_payment_date: a month from the charge instead", async () => {
    world({ subscriptions: [activeRow()] })
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: paystackSub({ nextPaymentDate: "2026-11-04T09:00:00.000Z" }) })
    await settleCharge(renewal())
    expect(applied()[0].periodEnd).toBe("2026-12-04T09:00:00.000Z")
  })

  it("a renewal names no subscription: the one whose own invoices list it is the one renewed", async () => {
    world({ subscriptions: [activeRow()] })
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: paystackSub({ invoiceReferences: ["twnhall-sub-0", "ps-renewal-1"] }) })
    expect(await settleCharge(renewal())).toBe("settled")
    expect(applied()[0]).toMatchObject({ action: "extend", providerSubscriptionId: "SUB_1" })
  })

  it("a renewal for no known subscription is unmatched", async () => {
    world({})
    expect(await settleCharge(renewal())).toBe("unmatched")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("a charge from a subscription we already ended renews nothing", async () => {
    world({ subscriptions: [activeRow(), activeRow({ id: "old", status: "expired", provider_subscription_id: "SUB_old" })] })
    vi.mocked(fetchSubscription).mockImplementation(async (code) => ({ ok: true, data: paystackSub({ subscriptionCode: code, invoiceReferences: code === "SUB_old" ? ["ps-renewal-1"] : [] }) }))
    expect(await settleCharge(renewal())).not.toBe("settled")
    expect(applied().filter((a) => a.action === "extend")).toEqual([])
  })

  it("a charge on a cancelled plan renews nothing and reaches a person", async () => {
    world({ subscriptions: [activeRow(), { profile_id: ME, status: "scheduled", plan_id: "community" }] })
    expect(await settleCharge(renewal())).not.toBe("settled")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("a second delivery is a duplicate, with no second receipt", async () => {
    world({ subscriptions: [activeRow()] })
    vi.mocked(applySubscription).mockResolvedValue("duplicate")
    expect(await settleCharge(renewal())).toBe("duplicate")
    expect(emailBuilder).not.toHaveBeenCalled()
  })
})

describe("an upgrade, Starter to Pro", () => {
  const STARTER = activeRow({ id: "starter-row", plan_id: "starter", payment_reference: "twnhall-sub-0" })
  const proCharge = (over: Record<string, unknown> = {}) =>
    charge({ reference: "twnhall-sub-pro", amount: 3_000_000, plan: { plan_code: "PLN_p" }, paid_at: "2026-11-13T23:30:00.000Z", ...over })
  const upgradeCheckout = () => checkout({ reference: "twnhall-sub-pro", plan_id: "pro", kind: "upgrade", replaces_subscription_id: "starter-row" })
  beforeEach(() => {
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [paystackSub({ subscriptionCode: "SUB_pro", planCode: "PLN_p" })] })
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: paystackSub({ subscriptionCode: "SUB_pro", planCode: "PLN_p", invoiceReferences: ["twnhall-sub-pro"] }) })
  })

  it("an abandoned or declined checkout changes nothing: no RPC, Starter as it was", async () => {
    const db = world({ paystack_checkouts: [upgradeCheckout()], subscriptions: [STARTER] })
    expect(await settleCharge(proCharge({ status: "abandoned" }))).toBe("mismatch")
    expect(await settleCharge(proCharge({ status: "failed" }))).toBe("mismatch")
    expect(db.rpcCalls).toEqual([])
    expect(applySubscription).not.toHaveBeenCalled()
    expect(db.tables.subscriptions[0]).toMatchObject({ status: "active", plan_id: "starter" })
  })

  it("a verified charge settles in one call: Pro, Starter's disable, the refund from paid_at", async () => {
    const db = world({ paystack_checkouts: [upgradeCheckout()], subscriptions: [STARTER] }, { settle_upgrade: () => ({ result: "ok", refund_ngn: 9500 }) })
    expect(await settleCharge(proCharge())).toBe("settled")
    expect(db.rpcCalls).toHaveLength(1)
    expect(db.rpcCalls[0]).toMatchObject({
      name: "settle_upgrade",
      args: {
        p_user_id: ME,
        p_pro_reference: "twnhall-sub-pro",
        p_amount_ngn: 30000,
        p_paid_at: "2026-11-13T23:30:00.000Z",
        p_starter_subscription_id: "starter-row",
        p_provider_subscription_id: "SUB_pro",
        p_actions: [{ kind: "disable_subscription", subscription_code: "SUB_1", email_token: "tok", idempotency_key: "disable:SUB_1" }],
      },
    })
    expect(applySubscription).not.toHaveBeenCalled()
    expect(later).toHaveBeenCalledTimes(2)
    expect(emailBuilder).toHaveBeenCalledWith(ME, "subscription-upgraded", expect.objectContaining({ body: expect.stringContaining("refunding ₦9,500") }))
    expect(JSON.stringify(db.rpcCalls)).not.toContain("AUTH_secret")
  })

  it("delivered twice, or the return page racing the webhook: the second is a duplicate and sends nothing", async () => {
    let n = 0
    const db = world({ paystack_checkouts: [upgradeCheckout()], subscriptions: [STARTER] }, { settle_upgrade: () => (n++ ? { result: "duplicate", refund_ngn: 0 } : { result: "ok", refund_ngn: 9500 }) })
    expect(await settleCharge(proCharge())).toBe("settled")
    db.tables.paystack_checkouts[0].completed_at = null
    expect(await settleCharge(proCharge())).toBe("duplicate")
    expect(emailBuilder).toHaveBeenCalledTimes(1)
  })

  it("a second, different Pro payment never reaches settle_upgrade", async () => {
    const pro = activeRow({ id: "pro-row", plan_id: "pro", payment_reference: "twnhall-sub-pro" })
    const second = checkout({ reference: "twnhall-sub-pro-2", plan_id: "pro", kind: "upgrade", replaces_subscription_id: "starter-row" })
    const db = world({ paystack_checkouts: [second], subscriptions: [pro] }, { record_unwanted_charge: () => "ok" })
    expect(await settleCharge(proCharge({ reference: "twnhall-sub-pro-2" }))).toBe("duplicate_charge")
    expect(db.rpcCalls.map((c) => c.name)).not.toContain("settle_upgrade")
  })

  it("an upgrade with no refund says so in its email", async () => {
    world({ paystack_checkouts: [upgradeCheckout()], subscriptions: [STARTER] }, { settle_upgrade: () => ({ result: "ok", refund_ngn: 0 }) })
    expect(await settleCharge(proCharge())).toBe("settled")
    expect(later).toHaveBeenCalledTimes(1)
    expect(emailBuilder).toHaveBeenCalledWith(ME, "subscription-upgraded", expect.objectContaining({ body: expect.not.stringContaining("refunding") }))
  })
})

describe("which subscription a first charge belongs to", () => {
  it("only one whose own invoices name the charge: an older live one is never attached", async () => {
    world({ paystack_checkouts: [checkout()] })
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [paystackSub({ subscriptionCode: "SUB_old" })] })
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: paystackSub({ subscriptionCode: "SUB_old", invoiceReferences: ["twnhall-sub-0"] }) })
    expect(await settleCharge(charge())).toBe("settled")
    expect(applied()[0].providerSubscriptionId).toBeNull()
  })
})

describe("a downgrade's Starter, on the billing date", () => {
  const PRO = activeRow({ id: "pro-row", plan_id: "pro", provider_subscription_id: "SUB_pro" })
  const WAITING = { ...activeRow({ id: "starter-row", plan_id: "starter", provider_subscription_id: "SUB_starter" }), status: "scheduled" }
  const first = () => charge({ reference: "ps-starter-1", metadata: {} })
  beforeEach(() => {
    vi.mocked(fetchSubscription).mockImplementation(async (code) => ({
      ok: true,
      data: paystackSub({ subscriptionCode: code, invoiceReferences: code === "SUB_starter" ? ["ps-starter-1"] : [] }),
    }))
  })

  it("its first charge applies the scheduled row with Paystack's next date, and Pro ends with it", async () => {
    world({ subscriptions: [PRO, WAITING] })
    expect(await settleCharge(first())).toBe("settled")
    expect(applied()[0]).toMatchObject({
      action: "apply",
      subscriptionId: "starter-row",
      periodEnd: NEXT,
      amountNgn: 15000,
      paymentReference: "ps-starter-1",
      paymentKind: "first",
      providerSubscriptionId: "SUB_starter",
    })
  })

  it("not due yet throws, so Paystack delivers it again", async () => {
    world({ subscriptions: [PRO, WAITING] })
    vi.mocked(applySubscription).mockResolvedValue("not_due")
    await expect(settleCharge(first())).rejects.toThrow("isn't due")
  })
})
