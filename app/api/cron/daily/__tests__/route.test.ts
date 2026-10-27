import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ adminRecipients: vi.fn(async () => [{ id: "a", email: "ops@twnhall.com", name: "Ops" }]) }))
vi.mock("@/lib/billing", () => ({ applySubscription: vi.fn(async () => "ok") }))
vi.mock("@/lib/events", () => ({ recordEvent: vi.fn() }))
vi.mock("@/lib/mail", () => ({ sendNotice: vi.fn() }))
vi.mock("@/lib/alerts/run", () => ({ runAlerts: vi.fn(async () => 14) }))

import { GET } from "@/app/api/cron/daily/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { applySubscription } from "@/lib/billing"
import { sendNotice } from "@/lib/mail"

const req = (auth?: string) => new Request("https://x/api/cron/daily", { headers: auth ? { authorization: auth } : {} })

/** Every select answers `rows[table]`; every chain method returns the chain. */
function store(rows: Record<string, unknown[]>, opts: { rpcFails?: boolean } = {}) {
  const chain = (table: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ["select", "eq", "lte", "lt", "gte", "is", "update", "delete"]) q[m] = () => q
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
    expect(body).toMatchObject({ applied: 1, expired: 1, reminded: 1, page_views_rolled: "failed", alerts_evaluated: 14 })
    expect(body.events_deleted).toBe(0)
    expect(vi.mocked(sendNotice).mock.calls.map(([n]) => n.template)).toEqual(["plan-ending", "plan-ending-admin"])
  })
})
