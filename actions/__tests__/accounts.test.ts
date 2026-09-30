import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ accountRowsFor: vi.fn() }))
vi.mock("@/lib/allowanceDb", () => ({ grantSignup: vi.fn() }))

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { accountRowsFor } from "@/lib/auth"
import { grantSignup } from "@/lib/allowanceDb"
import { createAccount, switchAccount } from "@/actions/accounts"
import type { AccountType } from "@/lib/access"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const VERIFIED_AT = "2026-08-16T10:00:00.000Z"

type Row = { type: AccountType; verification_completed_at: string | null }

function given(opts: { user?: boolean; rows?: Row[]; upsertError?: { message: string }; created?: boolean }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: opts.user === false ? null : { id: USER_ID } } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  // upsert(...).select("id") — the returned rows are what was inserted, so an
  // account that already existed comes back empty.
  const upsert = vi.fn(() => ({
    select: async () => ({
      data: opts.created ? [{ id: "acct-new" }] : [],
      error: opts.upsertError ?? null,
    }),
  }))
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({ upsert }),
  } as unknown as ReturnType<typeof createAdminClient>)

  vi.mocked(accountRowsFor).mockResolvedValue(opts.rows ?? [])

  const set = vi.fn()
  vi.mocked(cookies).mockResolvedValue({ set } as unknown as Awaited<ReturnType<typeof cookies>>)
  return { upsert, set }
}

beforeEach(() => vi.clearAllMocks())

describe("createAccount", () => {
  it("sends an unauthenticated caller home without writing", async () => {
    const { upsert } = given({ user: false })
    await expect(createAccount("builder")).rejects.toThrow("REDIRECT:/")
    expect(upsert).not.toHaveBeenCalled()
  })

  it("lands a new, unverified account on its verify page — not via its home", async () => {
    given({ rows: [{ type: "builder", verification_completed_at: null }] })
    await expect(createAccount("builder")).rejects.toThrow("REDIRECT:/verify/builder")

    given({ rows: [{ type: "tester", verification_completed_at: null }] })
    await expect(createAccount("tester")).rejects.toThrow("REDIRECT:/verify/tester")
  })

  it("stays idempotent: a held, verified type is just a switch home", async () => {
    const { upsert, set } = given({ rows: [{ type: "tester", verification_completed_at: VERIFIED_AT }] })
    await expect(createAccount("tester")).rejects.toThrow("REDIRECT:/explore")
    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, type: "tester" },
      { onConflict: "user_id,type", ignoreDuplicates: true },
    )
    expect(set).toHaveBeenCalledWith("th_account", "tester", expect.any(Object))
  })

  it("surfaces a failed insert without setting the cookie", async () => {
    const { set } = given({ upsertError: { message: "boom" } })
    await expect(createAccount("builder")).rejects.toThrow("Could not create that account")
    expect(set).not.toHaveBeenCalled()
  })

  it("grants the signup reports when the account is new", async () => {
    given({ created: true, rows: [{ type: "builder", verification_completed_at: null }] })
    await expect(createAccount("builder")).rejects.toThrow("REDIRECT:/verify/builder")
    expect(grantSignup).toHaveBeenCalledWith(USER_ID, "acct-new")
  })

  it("does not ask for a grant when the account already existed", async () => {
    given({ rows: [{ type: "tester", verification_completed_at: VERIFIED_AT }] })
    await expect(createAccount("tester")).rejects.toThrow("REDIRECT:/explore")
    expect(grantSignup).not.toHaveBeenCalled()
  })

  it("rejects an unknown type", async () => {
    given({})
    await expect(createAccount("admin" as AccountType)).rejects.toThrow("Unknown account type.")
  })
})

describe("switchAccount", () => {
  it("lands a held but unverified account on its verify page", async () => {
    given({ rows: [{ type: "tester", verification_completed_at: null }] })
    await expect(switchAccount("tester")).rejects.toThrow("REDIRECT:/verify/tester")
  })

  it("lands a verified account at home", async () => {
    given({ rows: [{ type: "builder", verification_completed_at: VERIFIED_AT }] })
    await expect(switchAccount("builder")).rejects.toThrow("REDIRECT:/dashboard")
  })

  it("refuses a type the user does not hold", async () => {
    const { set } = given({ rows: [{ type: "builder", verification_completed_at: VERIFIED_AT }] })
    await expect(switchAccount("tester")).rejects.toThrow("You don't have a tester account.")
    expect(set).not.toHaveBeenCalled()
  })
})
