import { beforeEach, describe, expect, it, vi } from "vitest"

// Mocked before the import of the module under test, so the action picks these
// up rather than reaching for a real session or a real database.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAccountForVerification: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
// lib/mail.ts imports "server-only", which does not resolve in the node test
// environment — and a test has no business reaching Resend anyway.
vi.mock("@/lib/mail", () => ({ sendWelcomeEmail: vi.fn() }))
// after() defers to the end of the response. Running it inline is what makes
// the send observable here without the test knowing about scheduling — and
// swallowing the result mirrors the real thing, which awaits the callback and
// whose callee swallows its own failures. Without the catch, the throwing-send
// case would pass on a floating rejection rather than on the behaviour.
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void Promise.resolve(fn()).catch(() => {})
  },
}))

import { completeVerification, saveVerificationStep } from "@/actions/verification"
import { requireAccountForVerification } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWelcomeEmail } from "@/lib/mail"
import { completionHeadlineFor, nextStepsFor } from "@/lib/setup"
import { builderStep1Schema, testerStep1Schema } from "@/lib/validation/schemas"

const USER_ID = "11111111-1111-4111-8111-111111111111"

/** A tester profile that satisfies every field of the full schema. */
const COMPLETE_TESTER = {
  full_name: "Ada Lovelace",
  country: "NG",
  phone: "+2348012345678",
  timezone: "Africa/Lagos",
  skills: ["QA", "Frontend"],
}

/** The same, minus skills — a builder is asked for everything else. */
const COMPLETE_BUILDER = {
  full_name: "Ada Lovelace",
  country: "NG",
  phone: "+2348012345678",
  timezone: "Africa/Lagos",
}

type Write = { table: string; values: Record<string, unknown>; filters: Record<string, unknown> }

/**
 * Stands in for the PostgREST builder. Records what each write actually asked
 * for — the filters matter as much as the values here, since "only this role's
 * row" is expressed as a filter.
 */
function fakeAdmin(opts: {
  profile?: Record<string, unknown> | null
  readError?: { message: string } | null
  writeError?: { message: string } | null
  /** Rows the guarded update returns. Empty means the gate was already open. */
  updated?: { id: string }[]
} = {}) {
  const writes: Write[] = []

  const from = (table: string) => {
    const state: Write = { table, values: {}, filters: {} }
    const chain = {
      update(values: Record<string, unknown>) {
        state.values = values
        return chain
      },
      select() {
        return chain
      },
      eq(column: string, value: unknown) {
        state.filters[column] = value
        return chain
      },
      // The fire-once guard: .is("verification_completed_at", null).
      is(column: string, value: unknown) {
        state.filters[`is:${column}`] = value
        return chain
      },
      maybeSingle() {
        return Promise.resolve({
          data: opts.profile ?? null,
          error: opts.readError ?? null,
        })
      },
      // Awaiting the chain is what runs an update in PostgREST.
      then(resolve: (r: { data: unknown; error: unknown }) => unknown) {
        writes.push({ ...state, filters: { ...state.filters } })
        return Promise.resolve(
          resolve({
            // One row by default: the common case is the call that opens it.
            data: opts.updated ?? [{ id: "account-1" }],
            error: opts.writeError ?? null,
          }),
        )
      },
    }
    return chain
  }

  return { client: { from }, writes }
}

function useAdmin(opts: Parameters<typeof fakeAdmin>[0] = {}) {
  const { client, writes } = fakeAdmin(opts)
  vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>)
  return writes
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAccountForVerification).mockResolvedValue({ userId: USER_ID, verified: false })
})

describe("saveVerificationStep", () => {
  it("rejects a caller the guard turns away, without touching the database", async () => {
    const writes = useAdmin()
    // redirect() throws in Next — an unauthenticated caller never returns.
    vi.mocked(requireAccountForVerification).mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(saveVerificationStep("tester", { fullName: "Ada" })).rejects.toThrow("NEXT_REDIRECT")
    expect(writes).toHaveLength(0)
  })

  it("returns a field error for an invalid phone and writes nothing", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("tester", {
      fullName: "Ada Lovelace",
      country: "NG",
      phone: "12345",
    })

    expect(result.success).toBe(false)
    expect(result.success === false && result.fieldErrors?.phone).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("saves a partial step and normalises the phone to E.164", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("tester", {
      fullName: "Ada Lovelace",
      country: "NG",
      phone: "+234 801 234 5678",
    })

    expect(result.success).toBe(true)
    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe("profiles")
    expect(writes[0].filters).toEqual({ id: USER_ID })
    expect(writes[0].values).toEqual({
      full_name: "Ada Lovelace",
      country: "NG",
      phone: "+2348012345678",
    })
  })

  it("accepts a step that omits the fields belonging to later steps", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("tester", { skills: ["QA"] })

    expect(result.success).toBe(true)
    expect(writes[0].values).toEqual({ skills: ["QA"] })
  })

  it("never writes a column outside the verification set", async () => {
    const writes = useAdmin()

    // This write runs as service-role, so an unmapped key reaching the UPDATE
    // would be a privilege escalation, not a typo.
    const result = await saveVerificationStep("tester", {
      timezone: "Africa/Lagos",
      role: "admin",
      moderation_status: "clear",
      verification_completed_at: new Date().toISOString(),
    })

    expect(result.success).toBe(true)
    expect(Object.keys(writes[0].values)).toEqual(["timezone"])
  })

  it("no longer writes bio, which verification has stopped collecting", async () => {
    const writes = useAdmin()

    // The column still exists and still holds what earlier verifications put
    // there. It is simply not this flow's to touch any more.
    const result = await saveVerificationStep("tester", {
      timezone: "Africa/Lagos",
      bio: "A perfectly valid bio that must not reach the database from here.",
    })

    expect(result.success).toBe(true)
    expect(Object.keys(writes[0].values)).toEqual(["timezone"])
  })

  it("accepts a skill outside the vocabulary, which is the point of model Z", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("tester", { skills: ["Astrology"] })

    expect(result.success).toBe(true)
    expect(writes[0].values.skills).toEqual(["Astrology"])
  })

  it("ignores tester-only fields on a builder save", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("builder", {
      fullName: "Ada Lovelace",
      timezone: "Africa/Lagos",
      skills: ["QA"],
    })

    expect(result.success).toBe(true)
    // Timezone is a builder field now. Skills is the only one left that is not.
    expect(Object.keys(writes[0].values)).toEqual(["full_name", "timezone"])
  })

  it("rewrites skills to canonical spelling before writing", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("tester", { skills: ["frontend", "  qa  "] })

    expect(result.success).toBe(true)
    expect(writes[0].values.skills).toEqual(["Frontend", "QA"])
  })

  it("collapses duplicates that only differ by case before writing", async () => {
    const writes = useAdmin()

    // The schema accepts both — they are each individually valid strings. It is
    // normalisation, not validation, that stops the profile holding two tags
    // that say the same thing.
    const result = await saveVerificationStep("tester", {
      skills: ["React", "react", "frontend", "Frontend"],
    })

    expect(result.success).toBe(true)
    expect(writes[0].values.skills).toEqual(["React", "Frontend"])
  })

  it("keeps a custom skill the vocabulary does not have", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("tester", { skills: ["Rust", "gRPC"] })

    expect(result.success).toBe(true)
    expect(writes[0].values.skills).toEqual(["Rust", "gRPC"])
  })

  it("rejects a skill with characters that do not belong in a tag", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("tester", { skills: ["<script>alert(1)</script>"] })

    expect(result.success).toBe(false)
    expect(result.success === false && result.fieldErrors?.skills).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects more than the maximum number of skills", async () => {
    const writes = useAdmin()

    const result = await saveVerificationStep("tester", {
      skills: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"],
    })

    expect(result.success).toBe(false)
    expect(writes).toHaveLength(0)
  })

  it("surfaces a database failure instead of reporting success", async () => {
    useAdmin({ writeError: { message: "connection reset" } })

    const result = await saveVerificationStep("tester", { fullName: "Ada Lovelace" })

    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/could not save/i)
  })
})

describe("completeVerification", () => {
  it("rejects a caller the guard turns away, without touching the database", async () => {
    const writes = useAdmin({ profile: COMPLETE_TESTER })
    vi.mocked(requireAccountForVerification).mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(completeVerification("tester")).rejects.toThrow("NEXT_REDIRECT")
    expect(writes).toHaveLength(0)
  })

  it("refuses to open the gate on an incomplete profile", async () => {
    const writes = useAdmin({ profile: { ...COMPLETE_TESTER, skills: [] } })

    const result = await completeVerification("tester")

    expect(result.success).toBe(false)
    expect(result.success === false && result.fieldErrors?.skills).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("normalises what it reads before judging it", async () => {
    // Defends the gate against rows this action did not write — a direct DB
    // edit could leave "frontend" and "Frontend" side by side, and that should
    // still verify rather than trip on a duplicate the user cannot see.
    const writes = useAdmin({
      profile: { ...COMPLETE_TESTER, skills: ["frontend", "Frontend", "  qa  "] },
    })

    const result = await completeVerification("tester")

    expect(result).toEqual({ success: true, redirectTo: "/explore" })
    expect(writes).toHaveLength(1)
  })

  it("refuses a profile whose only skills are whitespace", async () => {
    // Normalisation drops these, which drops the list below the minimum —
    // the gate must not open on a profile with no real skills on it.
    const writes = useAdmin({ profile: { ...COMPLETE_TESTER, skills: ["  ", ""] } })

    const result = await completeVerification("tester")

    expect(result.success).toBe(false)
    expect(writes).toHaveLength(0)
  })

  it("refuses when the profile row does not exist at all", async () => {
    const writes = useAdmin({ profile: null })

    const result = await completeVerification("tester")

    expect(result.success).toBe(false)
    expect(writes).toHaveLength(0)
  })

  it("sets the timestamp and sends a verified tester to /explore", async () => {
    const writes = useAdmin({ profile: COMPLETE_TESTER })

    const result = await completeVerification("tester")

    expect(result).toEqual({ success: true, redirectTo: "/explore" })
    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe("accounts")
    expect(writes[0].values.verification_completed_at).toEqual(expect.any(String))
  })

  it("opens only the role being verified, not the person's other account", async () => {
    const writes = useAdmin({ profile: COMPLETE_TESTER })

    await completeVerification("tester")

    // Without the type filter this UPDATE would verify the same person's
    // builder account too — the whole point of the gate living on `accounts`.
    expect(writes[0].filters).toEqual({
      user_id: USER_ID,
      type: "tester",
      // The fire-once guard travels with the write, so it cannot be
      // dropped without a test noticing.
      "is:verification_completed_at": null,
    })
  })

  it("holds a builder to four fields and sends them to /dashboard", async () => {
    const writes = useAdmin({ profile: COMPLETE_BUILDER })

    const result = await completeVerification("builder")

    expect(result).toEqual({ success: true, redirectTo: "/dashboard" })
    expect(writes[0].filters).toEqual({
      user_id: USER_ID,
      type: "builder",
      // The fire-once guard travels with the write, so it cannot be
      // dropped without a test noticing.
      "is:verification_completed_at": null,
    })
  })

  it("refuses to open a builder's gate without a timezone", async () => {
    // The field builders were never asked for before. A builder who somehow
    // reaches the gate without one is incomplete like any other, and the
    // timestamp must not be written.
    const writes = useAdmin({ profile: { ...COMPLETE_BUILDER, timezone: null } })

    const result = await completeVerification("builder")

    expect(result.success).toBe(false)
    expect(result.success === false && result.fieldErrors?.timezone).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("still does not ask a builder for skills", async () => {
    // Widening the builder schema by one field must not have widened it by two.
    const writes = useAdmin({ profile: { ...COMPLETE_BUILDER, skills: [] } })

    const result = await completeVerification("builder")

    expect(result).toEqual({ success: true, redirectTo: "/dashboard" })
    expect(writes).toHaveLength(1)
  })

  it("surfaces a database failure instead of reporting success", async () => {
    useAdmin({ profile: COMPLETE_TESTER, writeError: { message: "connection reset" } })

    const result = await completeVerification("tester")

    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/could not complete/i)
  })
})

describe("step 1 schemas", () => {
  it("are one schema shared by both roles, not two declarations of it", () => {
    // The alias is what stops them drifting. Two z.object() calls listing the
    // same fields would let one gain a field the other did not, and the symptom
    // would be a builder rejected at the gate for a field their own form never
    // rendered.
    expect(builderStep1Schema).toBe(testerStep1Schema)
  })
})

describe("the welcome email", () => {
  const withEmail = { ...COMPLETE_TESTER, email: "ada@twnhall.com" }

  it("goes out once, to the address on the profile", async () => {
    useAdmin({ profile: withEmail })

    const result = await completeVerification("tester")

    expect(result.success).toBe(true)
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1)
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ada@twnhall.com",
        role: "tester",
        name: "Ada Lovelace",
      }),
    )
  })

  it("carries that role's three next steps, so the mail matches the screen", async () => {
    useAdmin({ profile: withEmail })
    await completeVerification("tester")

    const sent = vi.mocked(sendWelcomeEmail).mock.calls[0][0]
    expect(sent.nextSteps).toEqual(nextStepsFor("tester"))
    expect(sent.headline).toBe(completionHeadlineFor("tester"))
  })

  it("sends nothing when the gate was already open", async () => {
    // The guarded UPDATE returns no rows, which is how a second call announces
    // itself. Nothing in the UI prevents this — a server action is an
    // addressable endpoint — so the database is what has to.
    useAdmin({ profile: withEmail, updated: [] })

    const result = await completeVerification("tester")

    expect(sendWelcomeEmail).not.toHaveBeenCalled()
    // Still a success: the caller asked for an open gate and has one.
    expect(result).toEqual({ success: true, redirectTo: "/explore" })
  })

  it("survives a send that throws", async () => {
    // Non-fatal means the gate does not care. lib/mail.ts swallows its own
    // failures, but the call site must not depend on that to stay correct.
    vi.mocked(sendWelcomeEmail).mockRejectedValueOnce(new Error("Resend down"))
    const writes = useAdmin({ profile: withEmail })

    const result = await completeVerification("tester")

    expect(result).toEqual({ success: true, redirectTo: "/explore" })
    expect(writes[0].values).toHaveProperty("verification_completed_at")
  })

  it("still opens the gate when there is no address to send to", async () => {
    const writes = useAdmin({ profile: { ...COMPLETE_TESTER, email: null } })

    const result = await completeVerification("tester")

    expect(sendWelcomeEmail).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, redirectTo: "/explore" })
    expect(writes[0].values).toHaveProperty("verification_completed_at")
  })

  it("sends nothing when the profile fails revalidation", async () => {
    useAdmin({ profile: { ...withEmail, phone: null } })

    const result = await completeVerification("tester")

    expect(result.success).toBe(false)
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })
})
