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
  return { ...real, initializeTransaction: vi.fn(), disableSubscription: vi.fn(), fetchSubscription: vi.fn(), listSubscriptions: vi.fn() }
})

import { cancelSubscription, startSubscription } from "@/actions/billing"
import { requireAccount } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { disableSubscription, fetchSubscription, initializeTransaction, listSubscriptions } from "@/lib/paystack/client"
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
    world({ subscriptions: [active({ provider_subscription_id: null, provider_email_token: null })] })
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [{ status: "active", subscriptionCode: "SUB_9", emailToken: "t9" }] } as never)
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
