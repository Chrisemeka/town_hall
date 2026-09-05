import { beforeEach, describe, expect, it, vi } from "vitest"

// Mocked before the module under test is imported, so the action picks these up
// rather than reaching for a real session or a real database.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  // redirect() throws in Next, which is how a successful action ends.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))
vi.mock("@/lib/auth", () => ({
  requireAccount: vi.fn(),
  requireProjectOwner: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { createProject, updateProject } from "@/actions/project"
import { requireAccount, requireProjectOwner } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const PROJECT_ID = "22222222-2222-4222-8222-222222222222"

/** A submission that satisfies every rule, so each test can break one thing. */
const VALID = {
  name: "DevSync",
  app_url: "https://devsync.example.com",
  description: "Keeps your dotfiles in sync across machines. For developers who switch laptops.",
  category: "Developer Tools",
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

type Write = { table: string; op: "insert" | "update"; values: Record<string, unknown> }

/**
 * Stands in for the PostgREST builder. Records what each write actually asked
 * for — the column list is the thing under test, since these writes send
 * whatever reaches them.
 */
function fakeClient(opts: { user?: { id: string } | null; writeError?: { message: string } } = {}) {
  const writes: Write[] = []
  const state: Write = { table: "", op: "insert", values: {} }

  const chain = {
    insert(values: Record<string, unknown>) {
      state.op = "insert"
      state.values = values
      writes.push({ ...state })
      return chain
    },
    update(values: Record<string, unknown>) {
      state.op = "update"
      state.values = values
      writes.push({ ...state })
      return chain
    },
    select() {
      return chain
    },
    eq() {
      return chain
    },
    single() {
      return Promise.resolve({
        data: { id: PROJECT_ID },
        error: opts.writeError ?? null,
      })
    },
    // Awaiting the chain is what runs an update in PostgREST.
    then(resolve: (r: { error: unknown }) => unknown) {
      return Promise.resolve(resolve({ error: opts.writeError ?? null }))
    },
  }

  // Auth still comes off the session client; the write goes through service role.
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: "user" in opts ? opts.user : { id: USER_ID } } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  vi.mocked(createAdminClient).mockReturnValue({
    from(table: string) {
      state.table = table
      return chain
    },
  } as unknown as ReturnType<typeof createAdminClient>)

  return writes
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAccount).mockResolvedValue({ userId: USER_ID })
  vi.mocked(requireProjectOwner).mockResolvedValue(undefined)
})

describe("createProject", () => {
  it("rejects an unauthenticated caller without touching the database", async () => {
    const writes = fakeClient({ user: null })

    await expect(createProject(null, formData(VALID))).rejects.toThrow("Unauthorized")
    expect(writes).toHaveLength(0)
  })

  it("rejects a caller the builder guard turns away", async () => {
    const writes = fakeClient()
    vi.mocked(requireAccount).mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(createProject(null, formData(VALID))).rejects.toThrow("NEXT_REDIRECT")
    expect(writes).toHaveLength(0)
  })

  it("writes the category on the happy path", async () => {
    const writes = fakeClient()

    await expect(createProject(null, formData(VALID))).rejects.toThrow(/NEXT_REDIRECT/)

    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe("projects")
    expect(writes[0].values).toEqual({
      name: VALID.name,
      app_url: VALID.app_url,
      description: VALID.description,
      category: VALID.category,
      owner_id: USER_ID,
    })
  })

  it("rejects a category outside the vocabulary", async () => {
    const writes = fakeClient()

    const result = await createProject(null, formData({ ...VALID, category: "Crypto Rugpulls" }))

    expect(result?.fieldErrors?.category).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects a missing category", async () => {
    const writes = fakeClient()

    const result = await createProject(null, formData({ ...VALID, category: "" }))

    expect(result?.fieldErrors?.category).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects a three-sentence summary", async () => {
    const writes = fakeClient()

    const result = await createProject(
      null,
      formData({ ...VALID, description: "One thing. Two things. Three things." }),
    )

    expect(result?.fieldErrors?.description).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("accepts a summary with no full stop at all", async () => {
    const writes = fakeClient()

    await expect(
      createProject(null, formData({ ...VALID, description: "HR ERP for small teams" })),
    ).rejects.toThrow(/NEXT_REDIRECT/)

    expect(writes[0].values.description).toBe("HR ERP for small teams")
  })

  it("rejects a summary over the character cap", async () => {
    const writes = fakeClient()

    const result = await createProject(null, formData({ ...VALID, description: "a".repeat(201) }))

    expect(result?.fieldErrors?.description).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("surfaces a database failure instead of reporting success", async () => {
    fakeClient({ writeError: { message: "connection reset" } })

    const result = await createProject(null, formData(VALID))

    expect(result?.error).toBe("connection reset")
  })
})

describe("updateProject", () => {
  it("rejects an unauthenticated caller without touching the database", async () => {
    const writes = fakeClient({ user: null })

    await expect(updateProject(PROJECT_ID, null, formData(VALID))).rejects.toThrow("Unauthorized")
    expect(writes).toHaveLength(0)
  })

  it("rejects a project the caller does not own, and writes nothing", async () => {
    // Service role bypasses RLS, so this guard replaced the owner-scoped policy
    // that used to reduce a foreign write to zero rows.
    const writes = fakeClient()
    vi.mocked(requireProjectOwner).mockRejectedValue(new Error("Not authorized"))

    await expect(updateProject(PROJECT_ID, null, formData(VALID))).rejects.toThrow("Not authorized")
    expect(writes).toHaveLength(0)
  })

  it("writes exactly the four editable columns and nothing else", async () => {
    const writes = fakeClient()

    await expect(updateProject(PROJECT_ID, null, formData(VALID))).rejects.toThrow(/NEXT_REDIRECT/)

    // owner_id, flagged_at and friends must not be reachable from this form.
    expect(Object.keys(writes[0].values).sort()).toEqual([
      "app_url",
      "category",
      "description",
      "name",
    ])
  })

  it("rejects an invalid category on update too", async () => {
    const writes = fakeClient()

    const result = await updateProject(
      PROJECT_ID,
      null,
      formData({ ...VALID, category: "Not A Category" }),
    )

    expect(result?.fieldErrors?.category).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("applies the summary rules to an edit of an older project", async () => {
    const writes = fakeClient()

    // A description written before the cap dropped to 200. The builder has to
    // trim it before this saves — the deliberate consequence of validating at
    // the boundary rather than backfilling.
    const result = await updateProject(
      PROJECT_ID,
      null,
      formData({ ...VALID, description: "b".repeat(239) }),
    )

    expect(result?.fieldErrors?.description).toBeTruthy()
    expect(writes).toHaveLength(0)
  })
})
