import { beforeEach, describe, expect, it, vi } from "vitest"

// Mocked before the import of the module under test, so the action picks these
// up rather than reaching for a real session or a real database.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getActiveAccount: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { updateProfile } from "@/actions/profile"
import { getActiveAccount } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { updateProfileSchema } from "@/lib/validation/schemas"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const VERIFIED_AT = "2026-01-15T09:30:00.000Z"

/** What the profile row already holds before an edit. */
const STORED_PROFILE = {
  full_name: "Ada Lovelace",
  country: "NG",
  phone: "+2348012345678",
  timezone: "Africa/Lagos",
  bio: "Existing bio.",
  skills: ["QA"],
}

type Write = { table: string; values: Record<string, unknown>; filters: Record<string, unknown> }

/**
 * Stands in for the PostgREST builder.
 *
 * Applies each write to a stored row rather than only recording it, so a test can
 * ask what a column *holds* afterwards. "The skills column is unchanged" and "the
 * gate is still open" are both claims about state, and asserting a key was absent
 * from an UPDATE is a weaker thing than asserting the value never moved.
 */
function fakeAdmin(opts: { writeError?: { message: string } | null } = {}) {
  const writes: Write[] = []
  const rows: Record<string, Record<string, unknown>> = {
    profiles: { ...STORED_PROFILE },
    // The row the verification gate lives on. Nothing in this action should ever
    // reach it; this is here so that "nothing reached it" is checkable.
    accounts: { verification_completed_at: VERIFIED_AT },
  }

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
      // Awaiting the chain is what runs an update in PostgREST.
      then(resolve: (r: { error: unknown }) => unknown) {
        writes.push({ ...state, filters: { ...state.filters } })
        if (!opts.writeError && rows[state.table]) {
          Object.assign(rows[state.table], state.values)
        }
        return Promise.resolve(resolve({ error: opts.writeError ?? null }))
      },
    }
    return chain
  }

  return { client: { from }, writes, rows }
}

function useAdmin(opts: Parameters<typeof fakeAdmin>[0] = {}) {
  const { client, writes, rows } = fakeAdmin(opts)
  vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>)
  return { writes, rows }
}

/** Signs in a person holding exactly these account types. */
function signedInAs(...types: ("builder" | "tester")[]) {
  vi.mocked(getActiveAccount).mockResolvedValue({
    userId: USER_ID,
    active: types[0],
    types,
    verified: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  signedInAs("tester")
})

describe("updateProfile — auth", () => {
  it("refuses an unauthenticated caller and writes nothing", async () => {
    const { writes } = useAdmin()
    vi.mocked(getActiveAccount).mockResolvedValue(null)

    const result = await updateProfile({ phone: "+2348012345678" })

    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/signed in/i)
    expect(writes).toHaveLength(0)
  })

  it("refuses someone signed in who holds no account yet", async () => {
    const { writes } = useAdmin()
    // Authenticated, but has not picked a role — there is no profile surface for
    // them to be editing yet.
    vi.mocked(getActiveAccount).mockResolvedValue({
      userId: USER_ID,
      active: null,
      types: [],
      verified: false,
    })

    const result = await updateProfile({ phone: "+2348012345678" })

    expect(result.success).toBe(false)
    expect(writes).toHaveLength(0)
  })
})

describe("updateProfile — validation", () => {
  it("returns a field error for an invalid phone and writes nothing", async () => {
    const { writes, rows } = useAdmin()

    const result = await updateProfile({ phone: "12345" })

    expect(result.success).toBe(false)
    expect(result.success === false && result.fieldErrors?.phone).toBeTruthy()
    expect(writes).toHaveLength(0)
    expect(rows.profiles.phone).toEqual(STORED_PROFILE.phone)
  })

  it("refuses to empty the skills list", async () => {
    const { writes, rows } = useAdmin()

    // The one destructive edit the spec leaves to Zod: removing every skill.
    const result = await updateProfile({ skills: [] })

    expect(result.success).toBe(false)
    expect(result.success === false && result.fieldErrors?.skills?.[0]).toMatch(/at least one/i)
    expect(writes).toHaveLength(0)
    expect(rows.profiles.skills).toEqual(["QA"])
  })

  it("refuses a bio longer than the limit", async () => {
    const { writes } = useAdmin()

    const result = await updateProfile({ bio: "x".repeat(501) })

    expect(result.success).toBe(false)
    expect(result.success === false && result.fieldErrors?.bio).toBeTruthy()
    expect(writes).toHaveLength(0)
  })
})

describe("updateProfile — the write", () => {
  it("writes every editable column and normalises as it goes", async () => {
    const { writes, rows } = useAdmin()

    const result = await updateProfile({
      full_name: "Ada Byron",
      country: "GB",
      phone: "+44 7400 123456",
      timezone: "Europe/London",
      bio: "  Building things.  ",
      skills: ["frontend", "  qa  "],
    })

    expect(result).toEqual({ success: true })
    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe("profiles")
    expect(writes[0].filters).toEqual({ id: USER_ID })
    expect(writes[0].values).toEqual({
      full_name: "Ada Byron",
      country: "GB",
      // E.164 via the same schema the gate uses.
      phone: "+447400123456",
      timezone: "Europe/London",
      bio: "Building things.",
      // Canonical spelling, same as the verification action.
      skills: ["Frontend", "QA"],
    })
    expect(rows.profiles.phone).toBe("+447400123456")
  })

  it("touches only the columns the payload carried", async () => {
    const { writes, rows } = useAdmin()

    const result = await updateProfile({ phone: "+2348099998888" })

    expect(result.success).toBe(true)
    expect(Object.keys(writes[0].values)).toEqual(["phone"])
    // Everything else is still what it was.
    expect(rows.profiles.full_name).toBe(STORED_PROFILE.full_name)
    expect(rows.profiles.bio).toBe(STORED_PROFILE.bio)
    expect(rows.profiles.skills).toEqual(STORED_PROFILE.skills)
  })

  it("never writes a column outside the editable set", async () => {
    const { writes, rows } = useAdmin()

    // This write runs as service-role, so an unmapped key reaching the UPDATE
    // would be a privilege escalation, not a typo.
    const result = await updateProfile({
      country: "GB",
      role: "admin",
      moderation_status: "clear",
      banned_at: null,
      id: "22222222-2222-4222-8222-222222222222",
      verification_completed_at: new Date().toISOString(),
    })

    expect(result.success).toBe(true)
    expect(Object.keys(writes[0].values)).toEqual(["country"])
    expect(rows.profiles.role).toBeUndefined()
  })

  it("clears the bio to NULL when the field is emptied", async () => {
    const { writes, rows } = useAdmin()

    const result = await updateProfile({ bio: "" })

    expect(result.success).toBe(true)
    expect(writes[0].values).toEqual({ bio: null })
    expect(rows.profiles.bio).toBeNull()
  })

  it("leaves the bio alone when the field is absent", async () => {
    const { rows } = useAdmin()

    // Absent and null are different answers: one is "I did not touch this", the
    // other is "I deleted it".
    const result = await updateProfile({ country: "GB" })

    expect(result.success).toBe(true)
    expect(rows.profiles.bio).toBe(STORED_PROFILE.bio)
  })

  it("does not send an empty UPDATE when there is nothing to change", async () => {
    const { writes } = useAdmin()

    const result = await updateProfile({})

    expect(result).toEqual({ success: true })
    expect(writes).toHaveLength(0)
  })

  it("surfaces a database failure instead of reporting success", async () => {
    useAdmin({ writeError: { message: "connection reset" } })

    const result = await updateProfile({ country: "GB" })

    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/could not save/i)
  })
})

describe("updateProfile — per-role skills isolation", () => {
  it("drops skills from a builder-only account without failing the save", async () => {
    const { writes, rows } = useAdmin()
    signedInAs("builder")

    const result = await updateProfile({
      country: "GB",
      skills: ["Frontend", "Backend"],
    })

    // Silently dropped, not rejected: the field is never rendered for a builder,
    // so an error here would only turn a UI bug into a dead end for the user.
    expect(result).toEqual({ success: true })
    expect(Object.keys(writes[0].values)).toEqual(["country"])
    expect(rows.profiles.skills).toEqual(["QA"])
  })

  it("writes nothing at all when a builder-only payload was skills-only", async () => {
    const { writes, rows } = useAdmin()
    signedInAs("builder")

    const result = await updateProfile({ skills: ["Frontend"] })

    expect(result).toEqual({ success: true })
    expect(writes).toHaveLength(0)
    expect(rows.profiles.skills).toEqual(["QA"])
  })

  it("accepts skills from a tester", async () => {
    const { rows } = useAdmin()
    signedInAs("tester")

    const result = await updateProfile({ skills: ["Frontend", "Rust"] })

    expect(result.success).toBe(true)
    expect(rows.profiles.skills).toEqual(["Frontend", "Rust"])
  })

  it("accepts skills from someone holding both accounts while acting as builder", async () => {
    const { rows } = useAdmin()
    // Decision 8 in the spec: the field shows if the person *has* a tester
    // account, whichever role they are currently acting as. The row is
    // per-person, so the active role has no say in it.
    vi.mocked(getActiveAccount).mockResolvedValue({
      userId: USER_ID,
      active: "builder",
      types: ["builder", "tester"],
      verified: true,
    })

    const result = await updateProfile({ skills: ["Design"] })

    expect(result.success).toBe(true)
    expect(rows.profiles.skills).toEqual(["Design"])
  })
})

describe("updateProfile — verification invariant", () => {
  it("leaves verification_completed_at untouched across an edit", async () => {
    const { writes, rows } = useAdmin()

    const before = rows.accounts.verification_completed_at

    const result = await updateProfile({
      full_name: "Ada Byron",
      country: "GB",
      phone: "+44 7400 123456",
      timezone: "Europe/London",
      bio: "Rewrote everything.",
      skills: ["Design"],
    })

    const after = rows.accounts.verification_completed_at

    expect(result.success).toBe(true)
    expect(after).toBe(before)
    expect(after).toBe(VERIFIED_AT)
    // Editing a profile is not re-verifying. Nothing here may reach `accounts`
    // at all — not to clear the timestamp, and not to re-set it either.
    expect(writes.every((w) => w.table === "profiles")).toBe(true)
    expect(writes.some((w) => "verification_completed_at" in w.values)).toBe(false)
  })

  it("cannot be talked into clearing the gate through the payload", async () => {
    const { writes, rows } = useAdmin()

    const result = await updateProfile({
      country: "GB",
      verification_completed_at: null,
    })

    expect(result.success).toBe(true)
    expect(rows.accounts.verification_completed_at).toBe(VERIFIED_AT)
    expect(Object.keys(writes[0].values)).toEqual(["country"])
  })

  it("does not admit verification_completed_at as a field in the first place", () => {
    // Pins the outer of the two layers. The test above cannot distinguish them:
    // the schema strips this key, so it never reaches the column allowlist, and
    // adding it to that allowlist therefore breaks no test. The allowlist is
    // still the backstop — this is what fires if the schema stops being one.
    const parsed = updateProfileSchema.safeParse({
      country: "GB",
      verification_completed_at: null,
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success && "verification_completed_at" in parsed.data).toBe(false)
  })
})
