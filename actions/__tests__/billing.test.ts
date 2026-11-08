import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock("@/lib/auth", () => ({ requireAccount: vi.fn() }))
vi.mock("@/lib/billing", () => ({ applySubscription: vi.fn(async () => "ok") }))
vi.mock("@/lib/rateLimitDb", () => ({ checkRateLimit: vi.fn(async () => ({ ok: true })) }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/paystack/notify", () => ({ emailBuilder: vi.fn(), later: vi.fn(), site: () => "https://twnhall.com" }))
vi.mock("@/lib/paystack/client", async (original) => {
  const real = await original<typeof import("@/lib/paystack/client")>()
  return { ...real, initializeTransaction: vi.fn(), disableSubscription: vi.fn(), fetchSubscription: vi.fn(), listSubscriptions: vi.fn(), createSubscriptionFrom: vi.fn() }
})

import { cancelSubscription, scheduleDowngrade, startSubscription } from "@/actions/billing"
import { requireAccount } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { createSubscriptionFrom, disableSubscription, fetchSubscription, initializeTransaction, listSubscriptions } from "@/lib/paystack/client"
import { emailBuilder } from "@/lib/paystack/notify"
import { checkRateLimit } from "@/lib/rateLimitDb"
import { createAdminClient } from "@/lib/supabase/admin"
import { fakeDb } from "@/lib/__tests__/fakeDb"

const ME = "11111111-1111-4111-8111-111111111111"
const PAGE = "https://checkout.paystack.com/abc"

/** Emulates paystack_checkouts_one_open. */
const oneOpen = (row: Record<string, unknown>, rows: Record<string, unknown>[]) =>
  rows.some((r) => r.profile_id === row.profile_id && r.plan_id === row.plan_id && r.kind === row.kind && !r.completed_at && !r.superseded_at)

function world(tables: { subscriptions?: Record<string, unknown>[]; accounts?: Record<string, unknown>[]; paystack_checkouts?: Record<string, unknown>[] } = {}) {
  const db = fakeDb(
    { subscriptions: [], accounts: [{ user_id: ME, type: "builder", plan_id: null }], paystack_checkouts: [], ...tables },
    { unique: { paystack_checkouts: oneOpen } },
  )
  vi.mocked(createAdminClient).mockReturnValue(db as never)
  return db
}

const active = (over: Record<string, unknown> = {}) => ({
  id: "row-1",
  profile_id: ME,
  status: "active",
  plan_id: "starter",
  source: "paystack",
  period_end: "2026-12-04T09:00:00Z",
  provider_status: "active",
  provider_customer_id: "CUS_1",
  provider_plan_code: "PLN_s",
  provider_subscription_id: "SUB_1",
  provider_email_token: "tok",
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_x")
  vi.stubEnv("PAYSTACK_PLAN_STARTER", "PLN_s")
  vi.stubEnv("PAYSTACK_PLAN_PRO", "PLN_p")
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.mocked(requireAccount).mockResolvedValue({ userId: ME })
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true })
  vi.mocked(initializeTransaction).mockResolvedValue({ ok: true, data: { authorizationUrl: PAGE, accessCode: "ac" } })
  vi.mocked(disableSubscription).mockResolvedValue({ ok: true, data: null })
  vi.mocked(applySubscription).mockResolvedValue("ok")
})

describe("startSubscription", () => {
  it("doesn't run for an unverified builder: the guard redirects", async () => {
    vi.mocked(requireAccount).mockRejectedValue(new Error("REDIRECT /verify/builder"))
    await expect(startSubscription("starter")).rejects.toThrow("/verify/builder")
    expect(initializeTransaction).not.toHaveBeenCalled()
  })

  it("refuses when Paystack isn't configured", async () => {
    world()
    vi.stubEnv("PAYSTACK_PLAN_PRO", "")
    expect(await startSubscription("starter")).toMatchObject({ ok: false })
    expect(initializeTransaction).not.toHaveBeenCalled()
  })

  it("refuses a made-up plan or kind", async () => {
    world()
    expect(await startSubscription("community" as never)).toMatchObject({ ok: false })
    expect(await startSubscription("starter", "downgrade" as never)).toMatchObject({ ok: false })
  })

  it("is rate limited, in words that say when, not how many", async () => {
    world()
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, retryAfter: 120 })
    const res = await startSubscription("starter")
    expect(res).toMatchObject({ ok: false })
    expect(checkRateLimit).toHaveBeenCalledWith(["checkout:account", ME])
    expect(initializeTransaction).not.toHaveBeenCalled()
  })

  it("refuses an active manual plan, naming the date", async () => {
    world({ subscriptions: [active({ source: "manual" })] })
    const res = await startSubscription("starter")
    expect(res).toEqual({ ok: false, error: "Your plan was arranged directly and ends on 4 Dec 2026. You can subscribe here from then." })
    expect(initializeTransaction).not.toHaveBeenCalled()
  })

  it("refuses a plan set before subscriptions existed", async () => {
    world({ accounts: [{ user_id: ME, type: "builder", plan_id: "pro" }] })
    expect(await startSubscription("starter")).toMatchObject({ ok: false })
  })

  it("refuses an active paystack plan: that's PR 3's change of plan", async () => {
    world({ subscriptions: [active()] })
    expect(await startSubscription("pro")).toMatchObject({ ok: false })
    expect(await startSubscription("starter", "resubscribe")).toMatchObject({ ok: false })
    expect(initializeTransaction).not.toHaveBeenCalled()
  })

  it("makes the checkout row, and sends Paystack the plan, card only, naira", async () => {
    const db = world()
    await expect(startSubscription("starter")).rejects.toThrow(`REDIRECT ${PAGE}`)
    const call = vi.mocked(initializeTransaction).mock.calls[0][0]
    expect(call).toMatchObject({
      email: "ada@example.ng",
      amountNgn: 15000,
      planCode: "PLN_s",
      callbackUrl: "https://twnhall.com/settings/billing/return",
      metadata: { profile_id: ME, plan_id: "starter", kind: "new" },
    })
    expect(call.reference).toMatch(/^twnhall-sub-[0-9a-f]{32}$/)
    expect(db.tables.paystack_checkouts[0]).toMatchObject({ reference: call.reference, profile_id: ME, plan_id: "starter", kind: "new", authorization_url: PAGE })
  })

  it("grants nothing: only the checkout row is written", async () => {
    world()
    await expect(startSubscription("pro")).rejects.toThrow("REDIRECT")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("a second start within 30 minutes lands on the first page, without calling Paystack", async () => {
    const db = world()
    await expect(startSubscription("starter")).rejects.toThrow(`REDIRECT ${PAGE}`)
    db.tables.paystack_checkouts[0].created_at = new Date().toISOString()
    await expect(startSubscription("starter")).rejects.toThrow(`REDIRECT ${PAGE}`)
    expect(initializeTransaction).toHaveBeenCalledOnce()
    expect(db.tables.paystack_checkouts).toHaveLength(1)
  })

  it("two concurrent starts make one row: the loser reads the winner's", async () => {
    const db = world()
    const results = await Promise.allSettled([startSubscription("starter"), startSubscription("starter")])
    expect(db.tables.paystack_checkouts).toHaveLength(1)
    expect(initializeTransaction).toHaveBeenCalledOnce()
    // One goes to Paystack; the other either follows it or is told to try again.
    expect(results.some((r) => r.status === "rejected" && String(r.reason).includes(PAGE))).toBe(true)
  })

  it("after 30 minutes the old row is superseded and a new page is made", async () => {
    const old = new Date(Date.now() - 31 * 60 * 1000).toISOString()
    const db = world({
      paystack_checkouts: [{ reference: "old", profile_id: ME, plan_id: "starter", kind: "new", authorization_url: "https://old", created_at: old, completed_at: null, superseded_at: null }],
    })
    vi.mocked(initializeTransaction).mockResolvedValue({ ok: true, data: { authorizationUrl: "https://new", accessCode: "ac" } })
    await expect(startSubscription("starter")).rejects.toThrow("REDIRECT https://new")
    expect(db.tables.paystack_checkouts[0].superseded_at).toBeTruthy()
    expect(db.tables.paystack_checkouts).toHaveLength(2)
  })

  it("back to Settings when Paystack refuses, freeing the index for the next try", async () => {
    const db = world()
    vi.mocked(initializeTransaction).mockResolvedValue({ ok: false, message: "down", permanent: false })
    await expect(startSubscription("starter")).rejects.toThrow("REDIRECT /settings?tab=plan&billing=failed")
    expect(db.tables.paystack_checkouts).toHaveLength(0)
  })

  it("Pay now on a failed renewal resubscribes, naming the row it replaces", async () => {
    const db = world({ subscriptions: [active({ provider_status: "attention" })] })
    await expect(startSubscription("starter", "resubscribe")).rejects.toThrow("REDIRECT")
    expect(db.tables.paystack_checkouts[0]).toMatchObject({ kind: "resubscribe", replaces_subscription_id: "row-1" })
  })

  it("Pay now after the plan already lapsed is a fresh start", async () => {
    const db = world()
    await expect(startSubscription("starter", "resubscribe")).rejects.toThrow("REDIRECT")
    expect(db.tables.paystack_checkouts[0]).toMatchObject({ kind: "new", replaces_subscription_id: null })
  })

  it.each(["active", "attention"])("Starter → Pro from a Paystack Starter (%s) names the Starter row, and changes nothing else", async (status) => {
    const db = world({ subscriptions: [active({ provider_status: status })] })
    await expect(startSubscription("pro", "upgrade")).rejects.toThrow(`REDIRECT ${PAGE}`)
    expect(db.tables.paystack_checkouts[0]).toMatchObject({ plan_id: "pro", kind: "upgrade", replaces_subscription_id: "row-1" })
    expect(vi.mocked(initializeTransaction).mock.calls[0][0]).toMatchObject({ amountNgn: 30000, planCode: "PLN_p" })
    expect(applySubscription).not.toHaveBeenCalled()
    expect(disableSubscription).not.toHaveBeenCalled()
    expect(db.tables.subscriptions[0]).toMatchObject({ status: "active", plan_id: "starter" })
  })

  it("no upgrade from a manual plan", async () => {
    world({ subscriptions: [active({ source: "manual" })] })
    expect(await startSubscription("pro", "upgrade")).toMatchObject({ ok: false })
    expect(initializeTransaction).not.toHaveBeenCalled()
  })

  it("no upgrade from Pro, and no 'upgrade' to Starter", async () => {
    world({ subscriptions: [active({ plan_id: "pro" })] })
    expect(await startSubscription("pro", "upgrade")).toMatchObject({ ok: false })
    world({ subscriptions: [active()] })
    expect(await startSubscription("starter", "upgrade")).toMatchObject({ ok: false })
    expect(initializeTransaction).not.toHaveBeenCalled()
  })
})

describe("cancelSubscription", () => {
  it("disables at Paystack, then schedules Community, then confirms", async () => {
    world({ subscriptions: [active()] })
    expect(await cancelSubscription()).toEqual({ ok: true })
    expect(disableSubscription).toHaveBeenCalledWith({ code: "SUB_1", token: "tok" })
    expect(vi.mocked(disableSubscription).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(applySubscription).mock.invocationCallOrder[0])
    expect(applySubscription).toHaveBeenCalledWith(expect.objectContaining({ action: "schedule", userId: ME, planId: "community", reason: "Cancelled by the builder" }))
    expect(emailBuilder).toHaveBeenCalledWith(ME, "subscription-cancelled", expect.objectContaining({ subject: "Starter cancelled" }))
  })

  it("is never rate limited: it's the off switch", async () => {
    world({ subscriptions: [active()] })
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, retryAfter: 120 })
    expect(await cancelSubscription()).toEqual({ ok: true })
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  it("Paystack refusing changes nothing, and says so", async () => {
    world({ subscriptions: [active()] })
    vi.mocked(disableSubscription).mockResolvedValue({ ok: false, message: "down", permanent: false })
    const res = await cancelSubscription()
    expect(res).toEqual({ ok: false, error: "We couldn't cancel just now, so nothing has changed. Try again in a minute." })
    expect(applySubscription).not.toHaveBeenCalled()
    expect(emailBuilder).not.toHaveBeenCalled()
  })

  it("a subscription already off at Paystack still cancels here", async () => {
    world({ subscriptions: [active()] })
    vi.mocked(disableSubscription).mockResolvedValue({ ok: false, message: "Subscription already inactive", permanent: true })
    expect(await cancelSubscription()).toEqual({ ok: true })
    expect(applySubscription).toHaveBeenCalled()
  })

  it("twice is a no-op: Paystack isn't called again", async () => {
    world({ subscriptions: [active(), { profile_id: ME, status: "scheduled", plan_id: "community" }] })
    expect(await cancelSubscription()).toEqual({ ok: false, error: "There's nothing to cancel." })
    expect(disableSubscription).not.toHaveBeenCalled()
  })

  it("nothing to cancel on Community or a manual plan", async () => {
    world()
    expect(await cancelSubscription()).toMatchObject({ ok: false })
    world({ subscriptions: [active({ source: "manual" })] })
    expect(await cancelSubscription()).toMatchObject({ ok: false })
    expect(disableSubscription).not.toHaveBeenCalled()
  })

  it("fetches a missing email token first", async () => {
    world({ subscriptions: [active({ provider_email_token: null })] })
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: { emailToken: "fresh" } } as never)
    await cancelSubscription()
    expect(disableSubscription).toHaveBeenCalledWith({ code: "SUB_1", token: "fresh" })
  })

  it("asks Paystack for a code it doesn't have yet", async () => {
    world({ subscriptions: [active({ provider_subscription_id: null, provider_email_token: null, payment_reference: "twnhall-sub-1" })] })
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [{ status: "active", subscriptionCode: "SUB_old", emailToken: "t0" }, { status: "active", subscriptionCode: "SUB_9", emailToken: "t9" }] } as never)
    // Only the subscription whose own invoices name this plan's payment: never just the newest.
    vi.mocked(fetchSubscription).mockImplementation(async (code) => ({ ok: true, data: { subscriptionCode: code, emailToken: code === "SUB_9" ? "t9" : "t0", invoiceReferences: code === "SUB_9" ? ["twnhall-sub-1"] : [] } }) as never)
    expect(await cancelSubscription()).toEqual({ ok: true })
    expect(disableSubscription).toHaveBeenCalledWith({ code: "SUB_9", token: "t9" })
  })

  it("never says it cancelled when it can't find the subscription", async () => {
    world({ subscriptions: [active({ provider_subscription_id: null })] })
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [] })
    expect(await cancelSubscription()).toMatchObject({ ok: false })
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("a failed write after Paystack accepted still answers ok: the webhook schedules it", async () => {
    world({ subscriptions: [active()] })
    vi.mocked(applySubscription).mockRejectedValue(new Error("db down"))
    expect(await cancelSubscription()).toEqual({ ok: true })
    expect(console.error).toHaveBeenCalled()
  })
})

describe("scheduleDowngrade, Pro to Starter", () => {
  const pro = () => active({ plan_id: "pro", provider_plan_code: "PLN_p", card_last4: "4081" })
  const proSub = (reusable = true) =>
    ({ ok: true, data: { subscriptionCode: "SUB_1", emailToken: "tok", nextPaymentDate: "2026-12-04T09:00:00Z", card: { last4: "4081", brand: "visa", reusable }, invoiceReferences: [] } }) as never
  beforeEach(() => {
    vi.mocked(fetchSubscription).mockResolvedValue(proSub())
    vi.mocked(createSubscriptionFrom).mockResolvedValue({ ok: true, data: { subscriptionCode: "SUB_starter", emailToken: "tok2" } } as never)
  })

  it("switches Pro off before it creates Starter on the same card, from Pro's next date, and schedules it", async () => {
    world({ subscriptions: [pro()] })
    expect(await scheduleDowngrade()).toEqual({ ok: true })
    expect(vi.mocked(disableSubscription).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(createSubscriptionFrom).mock.invocationCallOrder[0])
    expect(createSubscriptionFrom).toHaveBeenCalledWith({ fromCode: "SUB_1", planCode: "PLN_s", startDate: "2026-12-04T09:00:00Z" })
    // Marked as ours before Paystack's not_renew can arrive for it.
    expect(vi.mocked(applySubscription).mock.calls[0][0]).toEqual({ action: "attach", userId: ME, source: "paystack", providerStatus: "switching" })
    expect(vi.mocked(applySubscription).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(disableSubscription).mock.invocationCallOrder[0])
    expect(applySubscription).toHaveBeenCalledWith(
      expect.objectContaining({ action: "schedule", planId: "starter", source: "paystack", providerSubscriptionId: "SUB_starter", providerEmailToken: "tok2" }),
    )
    expect(emailBuilder).toHaveBeenCalledWith(ME, "subscription-downgrade", expect.objectContaining({ subject: expect.stringMatching(/^Your plan changes to Starter on /) }))
  })

  it("a card that can't be charged again is refused before anything changes", async () => {
    world({ subscriptions: [pro()] })
    vi.mocked(fetchSubscription).mockResolvedValue(proSub(false))
    expect(await scheduleDowngrade()).toMatchObject({ ok: false, error: expect.stringContaining("Cancel Pro, then subscribe to Starter") })
    expect(disableSubscription).not.toHaveBeenCalled()
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("Pro refusing to switch off changes nothing", async () => {
    world({ subscriptions: [pro()] })
    vi.mocked(disableSubscription).mockResolvedValue({ ok: false, message: "down", permanent: false })
    expect(await scheduleDowngrade()).toMatchObject({ ok: false })
    expect(createSubscriptionFrom).not.toHaveBeenCalled()
    // The mark is taken back; nothing is scheduled.
    expect(vi.mocked(applySubscription).mock.calls.map((c) => c[0])).toEqual([
      expect.objectContaining({ action: "attach", providerStatus: "switching" }),
      expect.objectContaining({ action: "attach", providerStatus: "active" }),
    ])
  })

  it("Starter refused now is still scheduled, with its creation queued: the Pro code, never a card", async () => {
    world({ subscriptions: [pro()] })
    vi.mocked(createSubscriptionFrom).mockResolvedValue({ ok: false, message: "down", permanent: false })
    expect(await scheduleDowngrade()).toEqual({ ok: true })
    const call = vi.mocked(applySubscription).mock.calls[1][0]
    expect(call).toMatchObject({ action: "schedule", planId: "starter" })
    expect(call.actions).toEqual([
      { kind: "create_subscription", subscription_code: "SUB_1", payload: { plan: "starter", start_date: "2026-12-04T09:00:00Z", customer: "CUS_1" }, idempotency_key: "create:SUB_1" },
    ])
    expect(JSON.stringify(call)).not.toMatch(/AUTH/)
  })

  it("only from a renewing Paystack Pro with nothing waiting", async () => {
    world({ subscriptions: [active()] })
    expect(await scheduleDowngrade()).toMatchObject({ ok: false })
    world({ subscriptions: [pro(), { profile_id: ME, status: "scheduled", plan_id: "community" }] })
    expect(await scheduleDowngrade()).toMatchObject({ ok: false })
    world({ subscriptions: [active({ plan_id: "pro", source: "manual" })] })
    expect(await scheduleDowngrade()).toMatchObject({ ok: false })
    expect(disableSubscription).not.toHaveBeenCalled()
  })
})

describe("cancel with a downgrade waiting", () => {
  const waiting = { id: "w", profile_id: ME, status: "scheduled", plan_id: "starter", provider_subscription_id: "SUB_starter", provider_email_token: "tok2" }

  it("switches the scheduled Starter off first, then Pro, then schedules Community", async () => {
    world({ subscriptions: [active({ plan_id: "pro" }), waiting] })
    expect(await cancelSubscription()).toEqual({ ok: true })
    expect(vi.mocked(disableSubscription).mock.calls.map(([a]) => a.code)).toEqual(["SUB_starter", "SUB_1"])
    expect(applySubscription).toHaveBeenCalledWith(expect.objectContaining({ action: "schedule", planId: "community" }))
  })

  it("if Starter can't be switched off, nothing changes", async () => {
    world({ subscriptions: [active({ plan_id: "pro" }), waiting] })
    vi.mocked(disableSubscription).mockResolvedValueOnce({ ok: false, message: "down", permanent: false })
    expect(await cancelSubscription()).toMatchObject({ ok: false })
    expect(disableSubscription).toHaveBeenCalledTimes(1)
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("a Starter not created yet is stopped from being created", async () => {
    const db = world({ subscriptions: [active({ plan_id: "pro" }), { ...waiting, provider_subscription_id: null }] })
    db.tables.billing_actions = [{ id: "a1", profile_id: ME, kind: "create_subscription", done_at: null }]
    expect(await cancelSubscription()).toEqual({ ok: true })
    expect(db.tables.billing_actions[0].done_at).toBeTruthy()
  })
})
