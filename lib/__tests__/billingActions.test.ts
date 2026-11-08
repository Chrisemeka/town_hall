import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/mail", () => ({ sendNotice: vi.fn() }))
vi.mock("@/lib/paystack/client", async (original) => {
  const real = await original<typeof import("@/lib/paystack/client")>()
  return { ...real, disableSubscription: vi.fn(), fetchSubscription: vi.fn(), createSubscriptionFrom: vi.fn(), listSubscriptions: vi.fn() }
})

import { runBillingActions } from "@/lib/paystack/actions"
import { createSubscriptionFrom, disableSubscription, fetchSubscription, listSubscriptions } from "@/lib/paystack/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { fakeDb } from "./fakeDb"

const action = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  kind: "disable_subscription",
  subscription_code: "SUB_1",
  email_token: "tok",
  attempts: 0,
  done_at: null,
  claimed_until: null,
  ...over,
})
const world = (rows: Record<string, unknown>[]) => {
  const db = fakeDb({ billing_actions: rows })
  vi.mocked(createAdminClient).mockReturnValue(db as never)
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("runBillingActions", () => {
  it("disables at Paystack and marks it done", async () => {
    const db = world([action()])
    vi.mocked(disableSubscription).mockResolvedValue({ ok: true, data: null })
    expect(await runBillingActions()).toBe(1)
    expect(disableSubscription).toHaveBeenCalledWith({ code: "SUB_1", token: "tok" })
    expect(db.tables.billing_actions[0]).toMatchObject({ attempts: 1, last_error: null })
    expect(db.tables.billing_actions[0].done_at).toBeTruthy()
  })

  it.each(["Subscription not found", "Subscription already inactive"])("counts a permanent '%s' as done", async (message) => {
    const db = world([action()])
    vi.mocked(disableSubscription).mockResolvedValue({ ok: false, message, permanent: true })
    expect(await runBillingActions()).toBe(1)
    expect(db.tables.billing_actions[0].done_at).toBeTruthy()
  })

  it("a transient error records the attempt and leaves it to run again", async () => {
    const db = world([action()])
    vi.mocked(disableSubscription).mockResolvedValue({ ok: false, message: "Paystack returned 502", permanent: false })
    expect(await runBillingActions()).toBe(0)
    expect(db.tables.billing_actions[0]).toMatchObject({ attempts: 1, done_at: null, last_error: "Paystack returned 502" })
  })

  it("a permanent refusal that doesn't mean 'off' isn't counted done", async () => {
    const db = world([action()])
    vi.mocked(disableSubscription).mockResolvedValue({ ok: false, message: "Invalid token", permanent: true })
    expect(await runBillingActions()).toBe(0)
    expect(db.tables.billing_actions[0].done_at).toBeNull()
  })

  it("fetches a missing email token first", async () => {
    world([action({ email_token: null })])
    vi.mocked(fetchSubscription).mockResolvedValue({ ok: true, data: { emailToken: "fresh" } } as never)
    vi.mocked(disableSubscription).mockResolvedValue({ ok: true, data: null })
    await runBillingActions()
    expect(disableSubscription).toHaveBeenCalledWith({ code: "SUB_1", token: "fresh" })
  })

  it("leaves a row another runner holds alone", async () => {
    const db = world([action({ claimed_until: new Date(Date.now() + 60_000).toISOString() })])
    expect(await runBillingActions()).toBe(0)
    expect(disableSubscription).not.toHaveBeenCalled()
    expect(db.tables.billing_actions[0].attempts).toBe(0)
  })

  it("two runners claiming at once call Paystack once", async () => {
    world([action()])
    vi.mocked(disableSubscription).mockResolvedValue({ ok: true, data: null })
    await Promise.all([runBillingActions(), runBillingActions()])
    expect(disableSubscription).toHaveBeenCalledOnce()
  })

  it("takes an expired lease back", async () => {
    world([action({ claimed_until: new Date(Date.now() - 60_000).toISOString() })])
    vi.mocked(disableSubscription).mockResolvedValue({ ok: true, data: null })
    expect(await runBillingActions()).toBe(1)
  })

  it("ignores what's already done", async () => {
    world([action({ done_at: "2026-11-04T00:00:00Z" })])
    expect(await runBillingActions()).toBe(0)
    expect(disableSubscription).not.toHaveBeenCalled()
  })

  it("doesn't run PR 3's create_subscription yet", async () => {
    world([action({ kind: "create_subscription" })])
    expect(await runBillingActions()).toBe(0)
  })
})

describe("create_subscription, a downgrade's Starter", () => {
  const create = (over: Record<string, unknown> = {}) =>
    action({
      kind: "create_subscription",
      profile_id: "p1",
      subscription_code: "SUB_pro",
      email_token: null,
      payload: { plan: "starter", start_date: "2026-12-04T09:00:00Z", customer: "CUS_1" },
      created_at: "2026-11-20T10:00:00Z",
      ...over,
    })
  const waiting = () => ({ id: "w", profile_id: "p1", status: "scheduled", plan_id: "starter", provider_subscription_id: null })
  const worldWith = (subs: Record<string, unknown>[]) => {
    const db = fakeDb({ billing_actions: [create()], subscriptions: subs })
    vi.mocked(createAdminClient).mockReturnValue(db as never)
    return db
  }
  beforeEach(() => {
    vi.stubEnv("PAYSTACK_PLAN_STARTER", "PLN_s")
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [] })
  })

  it("creates it from Pro's card and puts its codes on the scheduled row", async () => {
    const db = worldWith([waiting()])
    vi.mocked(createSubscriptionFrom).mockResolvedValue({ ok: true, data: { subscriptionCode: "SUB_starter", emailToken: "tok2" } } as never)
    expect(await runBillingActions()).toBe(1)
    expect(createSubscriptionFrom).toHaveBeenCalledWith({ fromCode: "SUB_pro", planCode: "PLN_s", startDate: "2026-12-04T09:00:00Z" })
    expect(db.tables.subscriptions[0]).toMatchObject({ provider_subscription_id: "SUB_starter", provider_email_token: "tok2", provider_plan_code: "PLN_s" })
  })

  it("adopts one an earlier attempt made, whose answer was lost, rather than making two", async () => {
    const db = worldWith([waiting()])
    vi.mocked(listSubscriptions).mockResolvedValue({ ok: true, data: [{ subscriptionCode: "SUB_made", emailToken: "t", status: "active", createdAt: "2026-11-20T10:01:00Z" }] } as never)
    expect(await runBillingActions()).toBe(1)
    expect(createSubscriptionFrom).not.toHaveBeenCalled()
    expect(db.tables.subscriptions[0].provider_subscription_id).toBe("SUB_made")
  })

  it("cancelled since: nothing is created, and it's done", async () => {
    const db = worldWith([])
    expect(await runBillingActions()).toBe(1)
    expect(createSubscriptionFrom).not.toHaveBeenCalled()
    expect(db.tables.billing_actions[0].done_at).toBeTruthy()
  })

  it("Paystack refusing keeps it for the next sweep", async () => {
    const db = worldWith([waiting()])
    vi.mocked(createSubscriptionFrom).mockResolvedValue({ ok: false, message: "down", permanent: false })
    expect(await runBillingActions()).toBe(0)
    expect(db.tables.billing_actions[0]).toMatchObject({ done_at: null, last_error: "down" })
  })
})
