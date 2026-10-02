import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { checkRateLimit, clientIp, tooManyResponse } from "@/lib/rateLimitDb"
import { createAdminClient } from "@/lib/supabase/admin"

type Rpc = (name: string, args: { p_key: string; p_limit: number; p_window_seconds: number }) => Promise<unknown>

function given(rpc: Rpc) {
  const fn = vi.fn(rpc)
  vi.mocked(createAdminClient).mockReturnValue({ rpc: fn } as unknown as ReturnType<typeof createAdminClient>)
  return fn
}

/**
 * What rate_limit_hit's upsert does: increment-and-read is one step per key.
 * JavaScript runs each call's body to completion before the next, which is the
 * row lock's serialisation. The real proof is the single-statement upsert; the
 * migration header has the two-session manual check.
 */
function fakeStore() {
  const hits = new Map<string, number>()
  return given(async (_name, { p_key, p_limit }) => {
    const n = (hits.get(p_key) ?? 0) + 1
    hits.set(p_key, n)
    return { data: [{ allowed: n <= p_limit, retry_after: 42 }], error: null }
  })
}

const down = () => given(async () => ({ data: null, error: { message: "connection refused" } }))

let errorLog: ReturnType<typeof vi.spyOn>
let warnLog: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
  warnLog = vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  delete process.env.RATE_LIMIT_DISABLED
  errorLog.mockRestore()
  warnLog.mockRestore()
})

describe("checkRateLimit — the store", () => {
  it("passes to the limit and refuses after, with the store's retry-after", async () => {
    fakeStore()
    for (let i = 0; i < 10; i++) expect((await checkRateLimit(["submit:account", "u1"])).ok).toBe(true)
    expect(await checkRateLimit(["submit:account", "u1"])).toEqual({ ok: false, retryAfter: 42 })
  })

  it("concurrent requests at the boundary do not both pass", async () => {
    fakeStore()
    const results = await Promise.all(
      Array.from({ length: 11 }, () => checkRateLimit(["submit:account", "u2"])),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(10)
  })

  it("counts every key, and refuses if any one is over", async () => {
    const rpc = fakeStore()
    for (let i = 0; i < 10; i++) await checkRateLimit(["signin:ip", `ip${i}`], ["signin:email", "a@b.com"])
    const r = await checkRateLimit(["signin:ip", "fresh-ip"], ["signin:email", "a@b.com"])
    expect(r.ok).toBe(false)
    expect(rpc).toHaveBeenCalledTimes(22)
  })
})

describe("checkRateLimit — store down", () => {
  it("auth degrades to in-memory, logs it, and still lets a legitimate sign-in through", async () => {
    down()
    const r = await checkRateLimit(["signin:ip", "9.9.9.9"], ["signin:email", "real@person.com"])
    expect(r.ok).toBe(true)
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("degrading"), "connection refused")
  })

  it("the fallback is stricter than the store's limit", async () => {
    down()
    const results = []
    for (let i = 0; i < 6; i++) results.push(await checkRateLimit(["signin:email", "hammered@x.com"]))
    expect(results.filter((r) => r.ok)).toHaveLength(5)
  })

  it("a cost-bearing action is refused", async () => {
    down()
    expect(await checkRateLimit(["submit:account", "u3"])).toEqual({ ok: false, retryAfter: 60 })
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("refusing"), "connection refused")
  })

  it("a thrown RPC is treated the same as an errored one", async () => {
    given(async () => {
      throw new Error("fetch failed")
    })
    expect((await checkRateLimit(["export:account", "u4"])).ok).toBe(false)
  })
})

describe("the kill switch", () => {
  it("RATE_LIMIT_DISABLED=true allows everything, never touches the store, and says so", async () => {
    process.env.RATE_LIMIT_DISABLED = "true"
    const rpc = down()
    expect((await checkRateLimit(["submit:account", "u5"])).ok).toBe(true)
    expect(rpc).not.toHaveBeenCalled()
    expect(warnLog).toHaveBeenCalledWith(expect.stringContaining("DISABLED"))
  })

  it("anything else leaves it on", async () => {
    process.env.RATE_LIMIT_DISABLED = "1"
    down()
    expect((await checkRateLimit(["submit:account", "u6"])).ok).toBe(false)
  })
})

describe("tooManyResponse", () => {
  it("is a 429 with Retry-After and a body that states no parameters", async () => {
    const res = tooManyResponse(600)
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("600")
    expect(await res.text()).toBe("Too many attempts. Try again in 10 minutes.")
  })
})

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1")
    expect(clientIp(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2")
    expect(clientIp(new Headers())).toBe("unknown")
  })
})
