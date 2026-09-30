import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { setCohortMember, setUserPlan } from "@/actions/admin/users"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const ADMIN_ID = "11111111-1111-4111-8111-111111111111"
const TARGET_ID = "22222222-2222-4222-8222-222222222222"

type Call = { name: string; args: Record<string, unknown> }

/**
 * setUserPlan and setCohortMember both go through set_account_field, which
 * makes the change and writes its log row in one transaction. `result` is what
 * the function answers.
 */
function fakeAdmin(opts: { result?: string; error?: { message: string } } = {}) {
  const calls: Call[] = []
  const rpc = (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return Promise.resolve({ data: opts.error ? null : (opts.result ?? "ok"), error: opts.error ?? null })
  }
  // The client requireAdmin() hands back, not createAdminClient() directly —
  // the guard and the client come together so a caller cannot get one
  // without the other.
  vi.mocked(requireAdmin).mockResolvedValue({
    admin: { rpc } as unknown as ReturnType<typeof createAdminClient>,
    user: { id: ADMIN_ID } as never,
    adminUserId: ADMIN_ID,
  })
  return calls
}

beforeEach(() => vi.clearAllMocks())

describe("setUserPlan", () => {
  it("rejects a caller who is not an admin, without touching the database", async () => {
    const calls = fakeAdmin()
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Not authorized"))

    await expect(setUserPlan(TARGET_ID, "builder", "pro")).rejects.toThrow("Not authorized")
    expect(calls).toHaveLength(0)
  })

  it("writes the plan to the named role's account, logged with the admin's id", async () => {
    const calls = fakeAdmin()

    await setUserPlan(TARGET_ID, "builder", "pro")

    expect(calls).toEqual([
      {
        name: "set_account_field",
        args: { p_user_id: TARGET_ID, p_type: "builder", p_field: "plan_id", p_value: "pro", p_admin_id: ADMIN_ID },
      },
    ])
  })

  it("writes Community as null, never 'community'", async () => {
    // The plan_id migration: "not assigned a plan" and "on the free plan" are
    // the same fact, and writing the word would invent a distinction.
    const calls = fakeAdmin()
    await setUserPlan(TARGET_ID, "builder", "community")
    expect(calls[0].args.p_value).toBeNull()
  })

  it("refuses a plan that is not in the vocabulary, before writing", async () => {
    const calls = fakeAdmin()
    await expect(setUserPlan(TARGET_ID, "builder", "enterprise")).rejects.toThrow("Unknown plan")
    expect(calls).toHaveLength(0)
  })

  it("refuses a plan id in the wrong case", async () => {
    const calls = fakeAdmin()
    await expect(setUserPlan(TARGET_ID, "builder", "PRO")).rejects.toThrow("Unknown plan")
    expect(calls).toHaveLength(0)
  })

  it("says so when the user has no account of that role", async () => {
    // Silently succeeding would leave an admin believing they had recorded a sale.
    fakeAdmin({ result: "no_account" })
    await expect(setUserPlan(TARGET_ID, "tester", "pro")).rejects.toThrow(/no tester account/)
  })

  it("treats setting the plan it already has as done", async () => {
    fakeAdmin({ result: "unchanged" })
    await expect(setUserPlan(TARGET_ID, "builder", "pro")).resolves.toBeUndefined()
  })

  it("surfaces a database error rather than swallowing it", async () => {
    fakeAdmin({ error: { message: "connection reset" } })
    await expect(setUserPlan(TARGET_ID, "builder", "pro")).rejects.toThrow("connection reset")
  })
})

describe("setCohortMember", () => {
  it("rejects a caller who is not an admin", async () => {
    const calls = fakeAdmin()
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Not authorized"))
    await expect(setCohortMember(TARGET_ID, true)).rejects.toThrow("Not authorized")
    expect(calls).toHaveLength(0)
  })

  it("adds and removes on the tester account, logged with the admin's id", async () => {
    const calls = fakeAdmin()
    await setCohortMember(TARGET_ID, true)
    await setCohortMember(TARGET_ID, false)
    expect(calls.map((c) => c.args)).toEqual([
      { p_user_id: TARGET_ID, p_type: "tester", p_field: "cohort", p_value: "member", p_admin_id: ADMIN_ID },
      { p_user_id: TARGET_ID, p_type: "tester", p_field: "cohort", p_value: "not_member", p_admin_id: ADMIN_ID },
    ])
  })

  it("refuses a user with no tester account", async () => {
    fakeAdmin({ result: "no_account" })
    await expect(setCohortMember(TARGET_ID, true)).rejects.toThrow(/no tester account/)
  })
})
