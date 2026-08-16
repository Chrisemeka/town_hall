import { beforeEach, describe, expect, it, vi } from "vitest"

// redirect() throws in Next and never returns. Tagging the thrown message is
// how a test tells "sent somewhere" apart from "let through".
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAccount, requireAccountForVerification } from "@/lib/auth"
import { ACCOUNT_COOKIE, type AccountType } from "@/lib/access"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const VERIFIED_AT = "2026-08-16T10:00:00.000Z"

type Row = { type: AccountType; verification_completed_at: string | null }

/** Wires the session, the accounts table, and the active-account cookie. */
function given(opts: { user?: boolean; rows?: Row[]; cookie?: AccountType }) {
  const user = opts.user === false ? null : { id: USER_ID }

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: async () => ({ data: opts.rows ?? [] }),
      }),
    }),
  } as unknown as ReturnType<typeof createAdminClient>)

  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === ACCOUNT_COOKIE && opts.cookie ? { value: opts.cookie } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

const unverified = (type: AccountType): Row => ({ type, verification_completed_at: null })
const verified = (type: AccountType): Row => ({ type, verification_completed_at: VERIFIED_AT })

beforeEach(() => vi.clearAllMocks())

describe("requireAccount", () => {
  it("sends an anonymous caller to the landing page", async () => {
    given({ user: false })
    await expect(requireAccount("tester")).rejects.toThrow("REDIRECT:/")
  })

  it("sends someone with no account yet to the picker", async () => {
    given({ rows: [] })
    await expect(requireAccount("tester")).rejects.toThrow("REDIRECT:/choose-account")
  })

  it("sends the wrong role to its own home", async () => {
    given({ rows: [verified("builder")] })
    await expect(requireAccount("tester")).rejects.toThrow("REDIRECT:/dashboard")
  })

  it("sends an unverified account to its verify page", async () => {
    given({ rows: [unverified("tester")] })
    await expect(requireAccount("tester")).rejects.toThrow("REDIRECT:/verify/tester")
  })

  it("lets a verified account through", async () => {
    given({ rows: [verified("tester")] })
    await expect(requireAccount("tester")).resolves.toEqual({ userId: USER_ID })
  })

  it("judges verification per role, not per person", async () => {
    // The whole reason the flag lives on `accounts`: this person has cleared
    // the gate as a builder and must still be stopped as a tester.
    given({ rows: [verified("builder"), unverified("tester")], cookie: "tester" })
    await expect(requireAccount("tester")).rejects.toThrow("REDIRECT:/verify/tester")

    given({ rows: [verified("builder"), unverified("tester")], cookie: "builder" })
    await expect(requireAccount("builder")).resolves.toEqual({ userId: USER_ID })
  })

  it("does not trust a cookie naming an account the user does not hold", async () => {
    given({ rows: [verified("builder")], cookie: "tester" })
    await expect(requireAccount("tester")).rejects.toThrow("REDIRECT:/dashboard")
  })
})

describe("requireAccountForVerification", () => {
  it("lets an unverified account through — this is what stops the redirect loop", async () => {
    // If this ever redirects, /verify/[role] sends the user to /verify/[role]
    // and the account can never become verified.
    given({ rows: [unverified("tester")] })
    await expect(requireAccountForVerification("tester")).resolves.toEqual({
      userId: USER_ID,
      verified: false,
    })
  })

  it("reports verification rather than acting on it", async () => {
    // The verify page bounces an already-verified user itself. This helper
    // hands it the answer instead of redirecting, so the page keeps the choice.
    given({ rows: [verified("tester")] })
    await expect(requireAccountForVerification("tester")).resolves.toEqual({
      userId: USER_ID,
      verified: true,
    })
  })

  it("still enforces everything that is not the verification gate", async () => {
    given({ user: false })
    await expect(requireAccountForVerification("tester")).rejects.toThrow("REDIRECT:/")

    given({ rows: [] })
    await expect(requireAccountForVerification("tester")).rejects.toThrow("REDIRECT:/choose-account")

    given({ rows: [unverified("builder")] })
    await expect(requireAccountForVerification("tester")).rejects.toThrow("REDIRECT:/dashboard")
  })
})
