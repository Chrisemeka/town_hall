import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ requireAccount: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/events", () => ({ recordEvent: vi.fn(async () => {}) }))
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock("@/lib/rateLimitDb", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  clientIp: vi.fn(() => "203.0.113.7"),
}))
vi.mock("server-only", () => ({}))

import { markMissionsSeen, setDigestEmail, unsubscribeFromEmail } from "@/actions/notifications"
import { requireAccount } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordEvent } from "@/lib/events"
import { checkRateLimit } from "@/lib/rateLimitDb"
import { unsubscribeToken } from "@/lib/unsubscribe"

const TESTER = "11111111-1111-4111-8111-111111111111"

/** Records each update and its filters. */
function db() {
  const writes: { row: Record<string, unknown>; filters: [string, string, unknown][] }[] = []
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      update: (row: Record<string, unknown>) => {
        const w = { row, filters: [] as [string, string, unknown][] }
        writes.push(w)
        const q = {
          eq: (c: string, v: unknown) => (w.filters.push(["eq", c, v]), q),
          lt: (c: string, v: unknown) => (w.filters.push(["lt", c, v]), q),
          is: (c: string, v: unknown) => (w.filters.push(["is", c, v]), q),
          select: () => Promise.resolve({ data: [{ id: "acc" }], error: null }),
          then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok),
        }
        return q
      },
    }),
  } as unknown as ReturnType<typeof createAdminClient>)
  return writes
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAccount).mockResolvedValue({ userId: TESTER })
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret")
})

describe("setDigestEmail", () => {
  it("is a tester's switch only", async () => {
    const writes = db()
    vi.mocked(requireAccount).mockRejectedValue(new Error("NEXT_REDIRECT"))
    await expect(setDigestEmail(false)).rejects.toThrow("NEXT_REDIRECT")
    expect(requireAccount).toHaveBeenCalledWith("tester")
    expect(writes).toHaveLength(0)
  })

  it("goes off, then on — and on moves the window to now, so no backlog", async () => {
    const writes = db()
    expect(await setDigestEmail(false)).toEqual({ ok: true })
    expect(writes[0].row.digest_opted_out_at).toEqual(expect.any(String))
    expect(writes[0].filters).toEqual([["eq", "user_id", TESTER], ["eq", "type", "tester"]])

    const before = Date.now()
    expect(await setDigestEmail(true)).toEqual({ ok: true })
    expect(writes[1].row.digest_opted_out_at).toBeNull()
    expect(Date.parse(writes[1].row.digest_through as string)).toBeGreaterThanOrEqual(before - 1000)
    expect(vi.mocked(recordEvent).mock.calls.map(([e]) => [e.name, e.props])).toEqual([
      ["notifications.digest_off", { source: "settings" }],
      ["notifications.digest_on", { source: "settings" }],
    ])
  })
})

describe("unsubscribeFromEmail (the /unsubscribe button)", () => {
  const ACC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const form = (a: string, t: string) => {
    const fd = new FormData()
    fd.set("a", a)
    fd.set("t", t)
    return fd
  }

  it("opts the account out with a good token, signed out", async () => {
    const writes = db()
    expect(await unsubscribeFromEmail({ status: "idle" }, form(ACC, unsubscribeToken(ACC)))).toEqual({ status: "done" })
    expect(requireAccount).not.toHaveBeenCalled()
    expect(writes[0].filters).toEqual([
      ["eq", "id", ACC],
      ["eq", "type", "tester"],
      ["is", "digest_opted_out_at", null],
    ])
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "notifications.digest_off", props: { source: "email" } }),
    )
  })

  it("answers a tampered token with one generic state, and writes nothing", async () => {
    const writes = db()
    const good = unsubscribeToken(ACC)
    const bad = (good[0] === "a" ? "b" : "a") + good.slice(1)
    expect(await unsubscribeFromEmail({ status: "idle" }, form(ACC, bad))).toEqual({ status: "invalid" })
    expect(writes).toHaveLength(0)
  })

  it("is rate limited before anything is checked", async () => {
    const writes = db()
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 30 })
    const state = await unsubscribeFromEmail({ status: "idle" }, form(ACC, unsubscribeToken(ACC)))
    expect(state.status).toBe("limited")
    expect(writes).toHaveLength(0)
  })
})

describe("markMissionsSeen", () => {
  it("refuses without a tester account", async () => {
    const writes = db()
    vi.mocked(requireAccount).mockRejectedValue(new Error("NEXT_REDIRECT"))
    await expect(markMissionsSeen(new Date().toISOString())).rejects.toThrow("NEXT_REDIRECT")
    expect(requireAccount).toHaveBeenCalledWith("tester")
    expect(writes).toHaveLength(0)
  })

  it("moves the tester account forward to the render time, and only forward", async () => {
    const writes = db()
    const at = new Date(Date.now() - 60_000).toISOString()
    await markMissionsSeen(at)
    expect(writes[0].row).toEqual({ missions_seen_at: at })
    expect(writes[0].filters).toEqual([
      ["eq", "user_id", TESTER],
      ["eq", "type", "tester"],
      // The write happens only while the stored value is earlier: never back.
      ["lt", "missions_seen_at", at],
    ])
  })

  it("clamps a future time to now", async () => {
    const writes = db()
    await markMissionsSeen(new Date(Date.now() + 86_400_000).toISOString())
    expect(Date.parse(writes[0].row.missions_seen_at as string)).toBeLessThanOrEqual(Date.now())
  })

  it("ignores something that is not a time", async () => {
    const writes = db()
    await markMissionsSeen("yesterday")
    expect(writes).toHaveLength(0)
  })
})
