import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ adminRecipients: vi.fn(async () => [{ id: "a", email: "ops@twnhall.com", name: "Ops" }]) }))
vi.mock("@/lib/billing", () => ({ applySubscription: vi.fn(async () => "ok") }))
vi.mock("@/lib/events", () => ({ recordEvent: vi.fn() }))
vi.mock("@/lib/mail", () => ({ sendNotice: vi.fn() }))
vi.mock("@/lib/alerts/run", () => ({ runAlerts: vi.fn(async () => 14) }))
vi.mock("@/lib/digest", () => ({ runTesterDigest: vi.fn(async () => 2) }))
vi.mock("@/lib/paystack/actions", () => ({ runBillingActions: vi.fn(async () => 1) }))
vi.mock("@/lib/paystack/client", () => ({ listSubscriptions: vi.fn() }))
vi.mock("@/lib/paystack/config", () => ({ paystackConfigured: vi.fn(() => true) }))

import { GET } from "@/app/api/cron/daily/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { applySubscription } from "@/lib/billing"
import { sendNotice } from "@/lib/mail"
import { listSubscriptions } from "@/lib/paystack/client"
import { paystackConfigured } from "@/lib/paystack/config"
import { runBillingActions } from "@/lib/paystack/actions"

const req = (auth?: string) => new Request("https://x/api/cron/daily", { headers: auth ? { authorization: auth } : {} })

/** Every select answers `rows[table]`; every chain method returns the chain. */
function store(rows: Record<string, unknown[]>, opts: { rpcFails?: boolean } = {}) {
  const chain = (table: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ["select", "eq", "lte", "lt", "gte", "is", "in", "or", "limit", "update", "delete"]) q[m] = () => q
    q.maybeSingle = async () => ({ data: { full_name: "Ada Obi", email: "ada@example.ng" } })
    // The update-then-select that claims a reminder returns the row it marked.
    q.then = (resolve: (v: unknown) => void) => resolve({ data: rows[table] ?? [{ id: "x" }], error: null, count: 0 })
    return q
  }
  vi.mocked(createAdminClient).mockReturnValue({
    from: chain,
    rpc: async () => (opts.rpcFails ? { data: null, error: { message: "down" } } : { data: 3, error: null }),
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("CRON_SECRET", "s3cret")
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

/** Only the subscriptions query that asks for this column list answers these rows. */
function subscriptionWorld(world: { expired?: unknown[]; reminded?: unknown[]; scheduled?: unknown[]; reconcile?: unknown[] }) {
  vi.mocked(createAdminClient).mockReturnValue({
    rpc: async () => ({ data: 0, error: null }),
    from: (table: string) => {
      let columns = ""
      let status = ""
      let updating = false
      const q: Record<string, unknown> = {}
      for (const m of ["lte", "lt", "gte", "is", "in", "or", "limit", "delete"]) q[m] = () => q
      q.select = (c: string) => ((columns = c ?? ""), q)
      q.update = () => ((updating = true), q)
      q.eq = (col: string, v: string) => ((col === "status" ? (status = v) : 0), q)
      q.maybeSingle = async () => ({ data: { full_name: "Ada Obi", email: "ada@example.ng" } })
      q.then = (resolve: (v: unknown) => void) => {
        let data: unknown = []
        if (table === "subscriptions" && updating) data = [{ id: "x" }]
        else if (table === "subscriptions" && status === "scheduled" && columns === "profile_id") data = world.scheduled ?? []
        else if (table === "subscriptions" && columns.includes("provider_customer_id")) data = world.reconcile ?? []
        else if (table === "subscriptions" && columns.includes("card_last4")) data = world.reminded ?? []
        else if (table === "subscriptions" && columns.includes("provider_email_token")) data = world.expired ?? []
        resolve({ data, error: null, count: 0 })
      }
      return q
    },
  } as never)
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
const daysOn = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
const auth = "Bearer s3cret"

describe("the expired step", () => {
  const row = { profile_id: "p1", plan_id: "starter", source: "paystack", provider_subscription_id: "SUB_1", provider_email_token: "tok" }
  const ends = () => vi.mocked(applySubscription).mock.calls.map(([a]) => a).filter((a) => a.action === "end")

  it("keeps a paystack row 1 day past period_end: its renewal or its grace", async () => {
    subscriptionWorld({ expired: [{ ...row, period_end: daysAgo(1) }] })
    const body = await (await GET(req(auth))).json()
    expect(ends()).toEqual([])
    expect(body.expired).toBe(0)
  })

  it("ends a paystack row 4 days past, queues the disable with it, and says why", async () => {
    subscriptionWorld({ expired: [{ ...row, period_end: daysAgo(4) }] })
    await GET(req(auth))
    expect(ends()[0]).toMatchObject({
      endStatus: "expired",
      actions: [{ kind: "disable_subscription", subscription_code: "SUB_1", email_token: "tok", idempotency_key: "disable:SUB_1" }],
    })
    const mail = vi.mocked(sendNotice).mock.calls.find(([n]) => n.template === "subscription-lapsed")
    expect(mail?.[0].messageBody).toContain("There will be no further charges")
  })

  it("ends a manual row on the day, with nothing to disable", async () => {
    subscriptionWorld({ expired: [{ ...row, source: "manual", provider_subscription_id: null, period_end: daysAgo(0.01) }] })
    await GET(req(auth))
    expect(ends()[0]).toMatchObject({ endStatus: "expired", actions: [] })
    expect(vi.mocked(sendNotice).mock.calls.some(([n]) => n.template === "subscription-lapsed")).toBe(false)
  })

  it("sweeps work owed to Paystack after the lapse", async () => {
    subscriptionWorld({})
    const body = await (await GET(req(auth))).json()
    expect(runBillingActions).toHaveBeenCalled()
    expect(body.billing_actions).toBe(1)
  })
})

describe("the three reminders", () => {
  const row = { id: "s1", profile_id: "p1", plan_id: "starter", period_end: daysOn(2), card_last4: "4081" }
  const reminder = () => vi.mocked(sendNotice).mock.calls.map(([n]) => n)[0]

  it("a renewing plan names the charge, the card and how to stop it", async () => {
    subscriptionWorld({ reminded: [{ ...row, source: "paystack" }] })
    await GET(req(auth))
    expect(reminder().subject).toMatch(/^Your Starter plan renews on /)
    expect(reminder().messageBody).toMatch(/We'll charge ₦15,000 to the card ending 4081 on .*To stop it, cancel in Settings → Plan before then./)
  })

  it("a cancelled plan says it ends, and that nothing more is charged", async () => {
    subscriptionWorld({ reminded: [{ ...row, source: "paystack" }], scheduled: [{ profile_id: "p1" }] })
    await GET(req(auth))
    expect(reminder().subject).toMatch(/^Your Starter plan ends on /)
    expect(reminder().messageBody).toContain("You won't be charged again.")
  })

  it("a manual plan invites them to subscribe", async () => {
    subscriptionWorld({ reminded: [{ ...row, source: "manual" }] })
    await GET(req(auth))
    expect(reminder().subject).toMatch(/^Your Starter plan ends on /)
    expect(reminder().messageBody).toContain("To keep it, subscribe in Settings → Plan")
  })

  it("a manual plan still asks them to get in touch until Paystack is switched on", async () => {
    vi.mocked(paystackConfigured).mockReturnValueOnce(false)
    subscriptionWorld({ reminded: [{ ...row, source: "manual" }] })
    await GET(req(auth))
    expect(reminder().messageBody).toContain("get in touch and we'll renew it")
    expect(reminder().messageBody).not.toMatch(/subscribe/i)
  })

  it("tells the admin which kind it is", async () => {
    subscriptionWorld({ reminded: [{ ...row, source: "paystack" }] })
    await GET(req(auth))
    const admin = vi.mocked(sendNotice).mock.calls.map(([n]) => n).find((n) => n.template === "plan-ending-admin")
    expect(admin?.subject).toContain("renews by card")
  })
})

describe("the reconcile step", () => {
  it("attaches the codes Paystack has, and skips one it hasn't made", async () => {
    subscriptionWorld({
      reconcile: [
        { profile_id: "p1", provider_customer_id: "CUS_1", provider_plan_code: "PLN_s" },
        { profile_id: "p2", provider_customer_id: "CUS_2", provider_plan_code: "PLN_s" },
      ],
    })
    vi.mocked(listSubscriptions)
      .mockResolvedValueOnce({ ok: true, data: [{ subscriptionCode: "SUB_1", emailToken: "tok", status: "active", nextPaymentDate: "2026-12-04T00:00:00Z" }] } as never)
      .mockResolvedValueOnce({ ok: true, data: [] })
    const body = await (await GET(req(auth))).json()
    const attaches = vi.mocked(applySubscription).mock.calls.map(([a]) => a).filter((a) => a.action === "attach")
    expect(attaches).toHaveLength(1)
    expect(attaches[0]).toMatchObject({ userId: "p1", providerSubscriptionId: "SUB_1", providerEmailToken: "tok", periodEnd: "2026-12-04T00:00:00Z" })
    expect(body.reconciled).toBe(1)
  })
})

describe("GET /api/cron/daily", () => {
  it("refuses without the secret, and when no secret is configured, touching nothing", async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req("Bearer wrong"))).status).toBe(401)
    vi.stubEnv("CRON_SECRET", "")
    expect((await GET(req("Bearer "))).status).toBe(401)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("applies, lapses, reminds builder and admin, and sweeps — and one failed step does not stop the rest", async () => {
    store(
      {
        subscriptions: [{ id: "s1", profile_id: "p1", plan_id: "pro", period_end: "2026-10-30T22:59:59Z" }],
      },
      { rpcFails: true },
    )
    const res = await GET(req("Bearer s3cret"))
    const body = await res.json()
    expect(vi.mocked(applySubscription).mock.calls.map(([a]) => a.action)).toEqual(["apply", "end"])
    expect(body).toMatchObject({ applied: 1, expired: 1, reminded: 1, tester_digest: 2, page_views_rolled: "failed", alerts_evaluated: 14 })
    // The digest runs before retention and alerts.
    expect(Object.keys(body).indexOf("tester_digest")).toBeLessThan(Object.keys(body).indexOf("page_views_rolled"))
    expect(body.events_deleted).toBe(0)
    expect(vi.mocked(sendNotice).mock.calls.map(([n]) => n.template)).toEqual(["plan-ending", "plan-ending-admin"])
  })
})
