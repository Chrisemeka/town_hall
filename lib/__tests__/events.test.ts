import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { recordEvent, recordEventLater } from "@/lib/events"
import { createAdminClient } from "@/lib/supabase/admin"

let inserts: Record<string, unknown>[]
const store = (insert: (row: Record<string, unknown>) => Promise<unknown>) =>
  vi.mocked(createAdminClient).mockReturnValue({
    from: (table: string) => {
      expect(table).toBe("app_events")
      return { insert }
    },
  } as unknown as ReturnType<typeof createAdminClient>)

beforeEach(() => {
  inserts = []
  vi.spyOn(console, "error").mockImplementation(() => {})
  store(async (row) => {
    inserts.push(row)
    return { error: null }
  })
})

describe("recordEvent", () => {
  it("writes one row with snake_case columns and empty props by default", async () => {
    await recordEvent({ name: "auth.logout", profileId: "9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b" })
    expect(inserts).toEqual([
      {
        name: "auth.logout",
        profile_id: "9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b",
        account_type: null,
        subject_type: null,
        subject_id: null,
        props: {},
      },
    ])
  })

  it("refuses a name outside EVENT_NAMES without writing", async () => {
    await recordEvent({ name: "made.up" as never })
    expect(inserts).toEqual([])
  })

  it("never throws: a dead store and a thrown client both resolve", async () => {
    store(async () => ({ error: { message: "connection refused" } }))
    await expect(recordEvent({ name: "email.sent" })).resolves.toBeUndefined()
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("no env")
    })
    await expect(recordEvent({ name: "email.sent" })).resolves.toBeUndefined()
  })

  it("recordEventLater outside a request still writes, unawaited", async () => {
    recordEventLater({ name: "rate_limit.hit", props: { rules: ["signin:ip"] } })
    await vi.waitFor(() => expect(inserts).toHaveLength(1))
  })
})
