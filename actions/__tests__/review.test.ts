import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAccount: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/mail", () => ({ sendApprovalNotification: vi.fn() }))
// Run after() inline and keep its promise, so a test can await the send.
const pending: Promise<unknown>[] = []
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    pending.push(Promise.resolve(fn()).catch(() => {}))
  },
}))

import { reviewSubmission } from "@/actions/review"
import { requireAccount } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendApprovalNotification } from "@/lib/mail"

const OWNER = "11111111-1111-4111-8111-111111111111"
const TESTER = "22222222-2222-4222-8222-222222222222"
const RESULT = "33333333-3333-4333-8333-333333333333"

type Write = { values: Record<string, unknown>; filters: Record<string, unknown> }

function useAdmin(opts: {
  status?: string
  owner?: string
  updated?: { id: string }[]
  writeError?: { message: string } | null
  testerEmail?: string | null
} = {}) {
  const writes: Write[] = []
  const from = (table: string) => {
    const w: Write = { values: {}, filters: {} }
    const chain = {
      select: () => chain,
      update(values: Record<string, unknown>) {
        w.values = values
        return chain
      },
      eq(c: string, v: unknown) {
        w.filters[c] = v
        return chain
      },
      neq(c: string, v: unknown) {
        w.filters[`neq:${c}`] = v
        return chain
      },
      maybeSingle() {
        if (table === "profiles") {
          return Promise.resolve({
            data: opts.testerEmail === null ? null : { full_name: "Ada", email: opts.testerEmail ?? "ada@x.com" },
            error: null,
          })
        }
        return Promise.resolve({
          data: {
            id: RESULT,
            status: opts.status ?? "pending",
            mission_id: "m1",
            tester_id: TESTER,
            missions: { title: "Checkout", project_id: "p1", projects: { owner_id: opts.owner ?? OWNER, name: "Acme" } },
          },
          error: null,
        })
      },
      then(resolve: (r: { data: unknown; error: unknown }) => unknown) {
        writes.push({ ...w })
        return Promise.resolve(resolve({ data: opts.updated ?? [{ id: RESULT }], error: opts.writeError ?? null }))
      },
    }
    return chain
  }
  vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)
  return writes
}

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  fd.set("resultId", RESULT)
  fd.set("action", "approve")
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  pending.length = 0
  vi.mocked(requireAccount).mockResolvedValue({ userId: OWNER } as Awaited<ReturnType<typeof requireAccount>>)
})

describe("reviewSubmission", () => {
  it("rejects a caller the guard turns away", async () => {
    const writes = useAdmin()
    vi.mocked(requireAccount).mockRejectedValue(new Error("NEXT_REDIRECT"))
    await expect(reviewSubmission(null, form({ rating: "4" }))).rejects.toThrow("NEXT_REDIRECT")
    expect(writes).toHaveLength(0)
  })

  it("refuses another builder's submission and sends nothing", async () => {
    const writes = useAdmin({ owner: "someone-else" })
    const res = await reviewSubmission(null, form({ rating: "4" }))
    expect(res?.success).toBe(false)
    expect(writes).toHaveLength(0)
    expect(sendApprovalNotification).not.toHaveBeenCalled()
  })

  it("approves, keeps the note, guards the write, and mails the tester", async () => {
    const writes = useAdmin()
    const res = await reviewSubmission(null, form({ rating: "2", reviewNote: "  Good repro.  " }))
    await Promise.all(pending)

    expect(res).toEqual({ success: true })
    expect(writes[0].values).toMatchObject({ status: "approved", rating: 2, review_note: "Good repro." })
    expect(writes[0].filters).toEqual({ id: RESULT, "neq:status": "approved" })
    expect(sendApprovalNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@x.com", rating: 2, reviewNote: "Good repro.", missionTitle: "Checkout" }),
    )
  })

  it("stores a blank note as null", async () => {
    const writes = useAdmin()
    await reviewSubmission(null, form({ rating: "5", reviewNote: "   " }))
    expect(writes[0].values.review_note).toBeNull()
  })

  it("sends nothing when an already-approved row is approved again", async () => {
    useAdmin({ status: "approved" })
    const res = await reviewSubmission(null, form({ rating: "5" }))
    await Promise.all(pending)
    expect(res?.success).toBe(false)
    expect(sendApprovalNotification).not.toHaveBeenCalled()
  })

  it("sends nothing when a racing approval got the row first", async () => {
    useAdmin({ updated: [] })
    const res = await reviewSubmission(null, form({ rating: "5" }))
    await Promise.all(pending)
    expect(res?.success).toBe(false)
    expect(sendApprovalNotification).not.toHaveBeenCalled()
  })

  it("still succeeds when the send throws or the tester has no address", async () => {
    useAdmin()
    vi.mocked(sendApprovalNotification).mockRejectedValueOnce(new Error("smtp down"))
    expect(await reviewSubmission(null, form({ rating: "3" }))).toEqual({ success: true })

    useAdmin({ testerEmail: null })
    expect(await reviewSubmission(null, form({ rating: "3" }))).toEqual({ success: true })
    await Promise.all(pending)
  })

  it("surfaces a failed write", async () => {
    useAdmin({ writeError: { message: "boom" } })
    const res = await reviewSubmission(null, form({ rating: "3" }))
    expect(res).toMatchObject({ success: false, error: "Could not save your review. Please try again." })
    expect(sendApprovalNotification).not.toHaveBeenCalled()
  })
})
