import { beforeEach, describe, expect, it, vi } from "vitest"

const jar = new Map<string, string>()
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
  }),
}))
vi.mock("@/lib/rateLimitDb", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  clientIp: () => "1.2.3.4",
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { POST } from "@/app/api/track/route"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1"
const ME = "9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b"

let views: Record<string, unknown>[]
let role: string | null

function signedIn(sub: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getClaims: async () => ({ data: sub ? { claims: { sub } } : null }) },
  } as never)
}

beforeEach(() => {
  jar.clear()
  views = []
  role = null
  signedIn(null)
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.mocked(createAdminClient).mockReturnValue({
    from: (table: string) =>
      table === "page_views"
        ? { insert: async (row: Record<string, unknown>) => (views.push(row), { error: null }) }
        : {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { role, accounts: [{ type: "tester" }] } }) }),
            }),
          },
  } as never)
})

const beacon = (body: unknown, ua = PHONE) =>
  POST(
    new Request("https://twnhall.com/api/track", {
      method: "POST",
      headers: { "user-agent": ua, host: "twnhall.com", "x-vercel-ip-country": "NG" },
      body: JSON.stringify(body),
    }),
  )

describe("POST /api/track", () => {
  it("records a logged-out visit once, with no ids in the path and no IP", async () => {
    const res = await beacon({ path: `/mission/${ME}?x=1`, referrer: "https://x.com/post/1", utm_source: "x" })
    expect(res.status).toBe(204)
    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({
      path: "/mission/[id]",
      profile_id: null,
      referrer_host: "x.com",
      utm_source: "x",
      country: "NG",
      device: "mobile",
    })
    expect(JSON.stringify(views[0])).not.toContain("1.2.3.4")
    expect(jar.get("th_vid")).toMatch(/^[0-9a-f-]{36}$/)
    expect(jar.get("th_sid")).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("keeps a returning visitor's id", async () => {
    jar.set("th_vid", ME)
    await beacon({ path: "/" })
    expect(views[0].visitor_id).toBe(ME)
  })

  it("attributes a signed-in visit, believing th_account only for an account held", async () => {
    signedIn(ME)
    jar.set("th_account", "builder")
    await beacon({ path: "/explore" })
    expect(views[0]).toMatchObject({ profile_id: ME, account_type: "tester" })
  })

  it("records nothing for /admin, bots or admin profiles", async () => {
    await beacon({ path: "/admin/accounts" })
    await beacon({ path: "/" }, "Mozilla/5.0 (compatible; Googlebot/2.1)")
    signedIn(ME)
    role = "admin"
    await beacon({ path: "/" })
    expect(views).toEqual([])
  })

  it("answers 204 to garbage and to a dead database", async () => {
    expect((await POST(new Request("https://twnhall.com/api/track", { method: "POST", headers: { "user-agent": PHONE }, body: "{" }))).status).toBe(204)
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("database down")
    })
    expect((await beacon({ path: "/" })).status).toBe(204)
  })
})
