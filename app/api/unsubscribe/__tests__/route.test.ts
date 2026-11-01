import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/events", () => ({ recordEvent: vi.fn(async () => {}) }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/rateLimitDb", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimitDb")>()),
  checkRateLimit: vi.fn(async () => ({ ok: true })),
}))

import { POST } from "@/app/api/unsubscribe/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rateLimitDb"
import { unsubscribeToken } from "@/lib/unsubscribe"

const ACC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
let writes = 0

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret")
  writes = 0
  const q = { eq: () => q, is: () => q, select: async () => ({ data: [{ user_id: "u" }], error: null }) }
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      update: () => {
        writes++
        return q
      },
    }),
  } as unknown as ReturnType<typeof createAdminClient>)
})

// What Gmail sends: a POST to the List-Unsubscribe URL, with this body.
const oneClick = (t: string) =>
  new Request(`https://www.twnhall.com/api/unsubscribe?a=${ACC}&t=${t}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  })

describe("POST /api/unsubscribe", () => {
  it("opts out with a valid token and answers 200, no sign-in", async () => {
    const res = await POST(oneClick(unsubscribeToken(ACC)))
    expect(res.status).toBe(200)
    expect(writes).toBe(1)
  })

  it("answers a bad token with a generic 400 and no write", async () => {
    const res = await POST(oneClick("0".repeat(64)))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe("This unsubscribe link isn't valid.")
    expect(writes).toBe(0)
  })

  it("answers 429 with Retry-After when limited, before the token is read", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 120 })
    const res = await POST(oneClick(unsubscribeToken(ACC)))
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("120")
    expect(writes).toBe(0)
  })
})
