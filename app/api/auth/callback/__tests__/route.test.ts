import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/events", () => ({ recordEvent: vi.fn(), recordEventLater: vi.fn() }))
const jar: Record<string, string> = {}
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) })),
}))
vi.mock("@/lib/rateLimitDb", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  clientIp: vi.fn(() => "203.0.113.7"),
}))

import { GET } from "@/app/api/auth/callback/route"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function given(exchangeError: { message: string } | null) {
  const auth = { exchangeCodeForSession: vi.fn().mockResolvedValue({ error: exchangeError }) }
  vi.mocked(createClient).mockResolvedValue({ auth } as unknown as Awaited<
    ReturnType<typeof createClient>
  >)
  return auth
}

const get = (query: string) => GET(new Request(`http://localhost:3000/api/auth/callback?${query}`))

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(jar)) delete jar[k]
})

/** A signed-in builder who also holds a tester account, terms accepted. */
function signedIn() {
  const auth = {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "b@example.com", user_metadata: {} } } }),
  }
  vi.mocked(createClient).mockResolvedValue({ auth } as unknown as Awaited<ReturnType<typeof createClient>>)
  const profile = { role: "user", accepted_terms_at: "2026-01-01", full_name: "B", avatar_url: "x", accounts: [{ type: "tester" }, { type: "builder" }] }
  const chain = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
    select: () => chain,
    eq: () => chain,
    maybeSingle: vi.fn().mockResolvedValue({ data: profile }),
  }
  vi.mocked(createAdminClient).mockReturnValue({ from: () => chain } as unknown as ReturnType<typeof createAdminClient>)
}

describe("GET /api/auth/callback — the return target", () => {
  it("a Google sign-in from /pricing returns to Settings → Plan as the builder, and the cookie is spent", async () => {
    signedIn()
    jar.th_return = "/settings?tab=plan"
    const res = await get("code=abc")
    expect(res.headers.get("location")).toBe("http://localhost:3000/settings?tab=plan")
    expect(res.cookies.get("th_account")?.value).toBe("builder")
    expect(res.cookies.get("th_return")?.value).toBe("")
  })

  it("without one, the builder's home, and the account cookie is left alone", async () => {
    signedIn()
    const res = await get("code=abc")
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard")
    expect(res.cookies.get("th_account")).toBeUndefined()
  })

  it("an unlisted target is ignored, in the query or the cookie: no open redirect", async () => {
    signedIn()
    jar.th_return = "@evil.com"
    expect((await get("code=abc&next=@evil.com")).headers.get("location")).toBe("http://localhost:3000/dashboard")
  })
})

describe("GET /api/auth/callback — password recovery", () => {
  it("exchanges the code and lands on the reset form", async () => {
    const auth = given(null)
    const res = await get("code=abc&next=/reset-password")

    // Without the exchange the form has no session and reads as "expired".
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc")
    expect(res.headers.get("location")).toBe("http://localhost:3000/reset-password")
    // Terms/account routing must not run: it would send the user elsewhere.
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("does not reach the form when the exchange fails", async () => {
    given({ message: "invalid code" })
    const res = await get("code=bad&next=/reset-password")
    expect(res.headers.get("location")).toBe("http://localhost:3000/?error=auth")
  })
})
