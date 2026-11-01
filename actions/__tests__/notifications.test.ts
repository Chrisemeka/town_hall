import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ requireAccount: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { markMissionsSeen } from "@/actions/notifications"
import { requireAccount } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

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
