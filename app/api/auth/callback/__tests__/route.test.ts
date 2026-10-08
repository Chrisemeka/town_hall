import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
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

beforeEach(() => vi.clearAllMocks())

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
