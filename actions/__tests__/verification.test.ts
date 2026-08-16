import { beforeEach, describe, expect, it, vi } from "vitest"

// Mocked before the import of the module under test, so the action picks these
// up rather than reaching for a real session or a real database.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAccountForVerification: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { completeVerification, saveVerificationStep } from "@/actions/verification"
import { requireAccountForVerification } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const USER_ID = "11111111-1111-4111-8111-111111111111"

/** A tester profile that satisfies every field of the full schema. */
const COMPLETE_TESTER = {
  full_name: "Ada Lovelace",
  country: "NG",
  phone: "+2348012345678",
  timezone: "Africa/Lagos",
  skills: ["QA", "Frontend"],
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
      maybeSingle() {
        return Promise.resolve({
          data: opts.profile ?? null,
          error: opts.readError ?? null,
        })
      },
      // Awaiting the chain is what runs an update in PostgREST.
      then(resolve: (r: { error: unknown }) => unknown) {
        writes.push({ ...state, filters: { ...state.filters } })
        return Promise.resolve(resolve({ error: opts.writeError ?? null }))
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
    expect(Object.keys(writes[0].values)).toEqual(["full_name"])
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
    expect(writes[0].filters).toEqual({ user_id: USER_ID, type: "tester" })
  })

  it("holds a builder to three fields and sends them to /dashboard", async () => {
    const writes = useAdmin({
      profile: { full_name: "Ada Lovelace", country: "NG", phone: "+2348012345678" },
    })

    const result = await completeVerification("builder")

    expect(result).toEqual({ success: true, redirectTo: "/dashboard" })
    expect(writes[0].filters).toEqual({ user_id: USER_ID, type: "builder" })
  })

  it("surfaces a database failure instead of reporting success", async () => {
    useAdmin({ profile: COMPLETE_TESTER, writeError: { message: "connection reset" } })

    const result = await completeVerification("tester")

    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/could not complete/i)
  })
})
