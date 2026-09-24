import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { setUserPlan } from "@/actions/admin/users"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const ADMIN_ID = "11111111-1111-4111-8111-111111111111"
const TARGET_ID = "22222222-2222-4222-8222-222222222222"

type Write = {
  table: string
  values: Record<string, unknown>
  filters: Record<string, unknown>
}

/**
 * The write chain setUserPlan uses: update → eq → eq → select. `select()`
 * resolves, because the action reads the returned rows to tell "changed it"
 * from "that user has no such account".
 */
function fakeAdmin(opts: { rows?: { id: string }[]; error?: { message: string } } = {}) {
  const writes: Write[] = []
  const from = (table: string) => {
    const state: Write = { table, values: {}, filters: {} }
    const chain = {
      update(values: Record<string, unknown>) {
        state.values = values
        return chain
      },
      eq(column: string, value: unknown) {
        state.filters[column] = value
        return chain
      },
      select() {
        writes.push({ ...state, filters: { ...state.filters } })
        return Promise.resolve({
          data: opts.rows ?? [{ id: "account-1" }],
          error: opts.error ?? null,
        })
      },
    }
    return chain
  }
  // setUserPlan uses the client requireAdmin() hands back, not
  // createAdminClient() directly — the guard and the client come together so a
  // caller cannot get one without the other.
  vi.mocked(requireAdmin).mockResolvedValue({
    admin: { from } as unknown as ReturnType<typeof createAdminClient>,
    user: { id: ADMIN_ID } as never,
    adminUserId: ADMIN_ID,
  })
  return writes
}

beforeEach(() => vi.clearAllMocks())

describe("setUserPlan", () => {
  it("rejects a caller who is not an admin, without touching the database", async () => {
    const writes = fakeAdmin()
    // Overrides what fakeAdmin() just set: the guard throws before it can
    // hand over a client at all.
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Not authorized"))

    await expect(setUserPlan(TARGET_ID, "builder", "pro")).rejects.toThrow("Not authorized")
    expect(writes).toHaveLength(0)
  })

  it("writes the plan to the named role's account only", async () => {
    // plan_id lives on accounts, so upgrading a builder must not touch the
    // same person's tester account.
    const writes = fakeAdmin()

    await setUserPlan(TARGET_ID, "builder", "pro")

    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe("accounts")
    expect(writes[0].filters).toEqual({ user_id: TARGET_ID, type: "builder" })
  })

  it("writes plan_id and nothing else", async () => {
    // Service role bypasses RLS, so anything reaching the UPDATE is written.
    const writes = fakeAdmin()
    await setUserPlan(TARGET_ID, "builder", "pro")
    expect(Object.keys(writes[0].values)).toEqual(["plan_id"])
    expect(writes[0].values.plan_id).toBe("pro")
  })

  it("round-trips both plans", async () => {
    for (const plan of ["community", "pro"] as const) {
      const writes = fakeAdmin()
      await setUserPlan(TARGET_ID, "builder", plan)
      expect(writes[0].values.plan_id).toBe(plan)
    }
  })

  it("refuses a plan that is not in the vocabulary, before writing", async () => {
    // The column has no CHECK constraint, so this parse is the only thing
    // between a typo and the database.
    const writes = fakeAdmin()

    await expect(setUserPlan(TARGET_ID, "builder", "enterprise")).rejects.toThrow("Unknown plan")
    expect(writes).toHaveLength(0)
  })

  it("refuses a plan id in the wrong case", async () => {
    const writes = fakeAdmin()
    await expect(setUserPlan(TARGET_ID, "builder", "PRO")).rejects.toThrow("Unknown plan")
    expect(writes).toHaveLength(0)
  })

  it("says so when the user has no account of that role", async () => {
    // Zero rows back means the filters matched nothing. Silently succeeding
    // would leave an admin believing they had recorded a sale.
    fakeAdmin({ rows: [] })

    await expect(setUserPlan(TARGET_ID, "tester", "pro")).rejects.toThrow(
      /no tester account/,
    )
  })

  it("surfaces a database error rather than swallowing it", async () => {
    fakeAdmin({ error: { message: "connection reset" } })
    await expect(setUserPlan(TARGET_ID, "builder", "pro")).rejects.toThrow("connection reset")
  })
})
