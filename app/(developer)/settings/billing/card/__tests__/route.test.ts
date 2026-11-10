import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock("@/lib/auth", () => ({ requireAccount: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/paystack/client", () => ({ manageLink: vi.fn() }))

import { GET } from "@/app/(developer)/settings/billing/card/route"
import { requireAccount } from "@/lib/auth"
import { manageLink } from "@/lib/paystack/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { fakeDb } from "@/lib/__tests__/fakeDb"

const ME = "11111111-1111-4111-8111-111111111111"

function world(subscriptions: Record<string, unknown>[]) {
  const db = fakeDb({ subscriptions })
  vi.mocked(createAdminClient).mockReturnValue(db as never)
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAccount).mockResolvedValue({ userId: ME })
})

describe("/settings/billing/card", () => {
  it("sends the builder to a fresh Paystack page for their own subscription, storing nothing", async () => {
    const db = world([{ profile_id: ME, status: "active", source: "paystack", provider_subscription_id: "SUB_1" }])
    vi.mocked(manageLink).mockResolvedValue({ ok: true, data: "https://paystack.com/manage/subscriptions/abc" })
    const res = await GET()
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("https://paystack.com/manage/subscriptions/abc")
    expect(manageLink).toHaveBeenCalledWith("SUB_1")
    expect(JSON.stringify(db.tables)).not.toContain("manage/subscriptions")
  })

  it("someone else's subscription is never looked up", async () => {
    world([{ profile_id: "someone-else", status: "active", source: "paystack", provider_subscription_id: "SUB_x" }])
    await expect(GET()).rejects.toThrow("billing=card_failed")
    expect(manageLink).not.toHaveBeenCalled()
  })

  it("back to Settings with a sentence when Paystack can't give a link", async () => {
    world([{ profile_id: ME, status: "active", source: "paystack", provider_subscription_id: "SUB_1" }])
    vi.mocked(manageLink).mockResolvedValue({ ok: false, message: "down", permanent: false })
    await expect(GET()).rejects.toThrow("REDIRECT /settings?tab=plan&billing=card_failed")
  })
})
