import { beforeEach, describe, expect, it, vi } from "vitest"

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

import { createMission, updateMission } from "@/actions/missions"
import { requireAccount, requireProjectOwner } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const USER_ID = "11111111-1111-4111-8111-111111111111"
const PROJECT_ID = "22222222-2222-4222-8222-222222222222"
const MISSION_ID = "33333333-3333-4333-8333-333333333333"
const STEP_A = "44444444-4444-4444-8444-444444444444"
const STEP_B = "55555555-5555-4555-8555-555555555555"

const STEPS = [
  { id: STEP_A, action: "Open the sign-up form", expected_result: "The form appears" },
  { id: STEP_B, action: "Submit a valid email", expected_result: "A verification email arrives" },
]

const VALID: Record<string, string> = {
  projectId: PROJECT_ID,
  missionId: MISSION_ID,
  title: "Sign-up walkthrough",
  task_description: "Walk through creating an account from scratch and report what snags.",
  intent: "publish",
  payout: "0",
  category: "process_flow",
  device_target: "both",
  test_steps: JSON.stringify(STEPS),
}

function formData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ ...VALID, ...overrides })) fd.set(k, v)
  return fd
}

type Write = { table: string; op: "insert" | "update"; values: Record<string, unknown>; filters: Record<string, unknown> }

/** Records what the service-role write actually asked for. */
function fakeAdmin(opts: { writeError?: { message: string } } = {}) {
  const writes: Write[] = []
  const state: Write = { table: "", op: "insert", values: {}, filters: {} }

  const chain = {
    insert(values: Record<string, unknown>) {
      state.op = "insert"
      state.values = values
      writes.push({ ...state, filters: { ...state.filters } })
      return chain
    },
    update(values: Record<string, unknown>) {
      state.op = "update"
      state.values = values
      return chain
    },
    eq(column: string, value: unknown) {
      state.filters[column] = value
      if (state.op === "update") {
        const existing = writes.find((w) => w.op === "update")
        if (existing) existing.filters[column] = value
        else writes.push({ ...state, values: state.values, filters: { ...state.filters } })
      }
      return chain
    },
    select() {
      return chain
    },
    single() {
      return Promise.resolve({ data: { id: MISSION_ID }, error: opts.writeError ?? null })
    },
    then(resolve: (r: { error: unknown }) => unknown) {
      return Promise.resolve(resolve({ error: opts.writeError ?? null }))
    },
  }

  vi.mocked(createAdminClient).mockReturnValue({
    from(table: string) {
      state.table = table
      return chain
    },
  } as unknown as ReturnType<typeof createAdminClient>)

  return writes
}

function signedIn(user: { id: string } | null = { id: USER_ID }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

beforeEach(() => {
  vi.clearAllMocks()
  signedIn()
  vi.mocked(requireAccount).mockResolvedValue({ userId: USER_ID })
  vi.mocked(requireProjectOwner).mockResolvedValue(undefined)
})

describe("createMission", () => {
  it("rejects an unauthenticated caller before any check runs", async () => {
    const writes = fakeAdmin()
    signedIn(null)

    await expect(createMission(null, formData())).rejects.toThrow("Unauthorized")
    expect(writes).toHaveLength(0)
  })

  it("rejects a caller the builder guard turns away", async () => {
    const writes = fakeAdmin()
    vi.mocked(requireAccount).mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(createMission(null, formData())).rejects.toThrow("NEXT_REDIRECT")
    expect(writes).toHaveLength(0)
  })

  it("rejects a project the caller does not own, and writes nothing", async () => {
    // Service role bypasses RLS, so this guard is the only ownership check
    // left. If it stops being called, this is what fails.
    const writes = fakeAdmin()
    vi.mocked(requireProjectOwner).mockRejectedValue(new Error("Not authorized"))

    await expect(createMission(null, formData())).rejects.toThrow("Not authorized")
    expect(writes).toHaveLength(0)
  })

  it("round-trips the test steps exactly", async () => {
    const writes = fakeAdmin()

    await expect(createMission(null, formData())).rejects.toThrow(/NEXT_REDIRECT/)

    expect(writes[0].values.test_steps).toEqual(STEPS)
    expect(writes[0].values.category).toBe("process_flow")
    expect(writes[0].values.device_target).toBe("both")
  })

  it("records template provenance when one was used", async () => {
    const writes = fakeAdmin()

    await expect(createMission(null, formData({ template_id: "auth-flow" }))).rejects.toThrow(
      /NEXT_REDIRECT/,
    )

    expect(writes[0].values.template_id).toBe("auth-flow")
  })

  it("stores null template_id when built from scratch", async () => {
    const writes = fakeAdmin()

    await expect(createMission(null, formData())).rejects.toThrow(/NEXT_REDIRECT/)

    expect(writes[0].values.template_id).toBeNull()
  })

  it("rejects malformed test_steps JSON as a field error, not a throw", async () => {
    const writes = fakeAdmin()

    const result = await createMission(null, formData({ test_steps: "{not json" }))

    expect(result?.fieldErrors?.test_steps).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects an empty step list", async () => {
    const writes = fakeAdmin()

    const result = await createMission(null, formData({ test_steps: "[]" }))

    expect(result?.fieldErrors?.test_steps).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects more steps than the cap allows", async () => {
    const writes = fakeAdmin()
    const tooMany = Array.from({ length: 16 }, (_, i) => ({
      id: `${String(i).padStart(8, "0")}-4444-4444-8444-444444444444`,
      action: "Do the thing",
      expected_result: "The thing happens",
    }))

    const result = await createMission(null, formData({ test_steps: JSON.stringify(tooMany) }))

    expect(result?.fieldErrors?.test_steps).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects duplicate step ids", async () => {
    // Two entries sharing an id would let two audit histories collapse into one
    // step in PR 4, which reads as a tester answering something they never saw.
    const writes = fakeAdmin()
    const duped = [STEPS[0], { ...STEPS[1], id: STEP_A }]

    const result = await createMission(null, formData({ test_steps: JSON.stringify(duped) }))

    expect(result?.fieldErrors?.test_steps).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects a step missing its expected result", async () => {
    const writes = fakeAdmin()
    const bad = [{ id: STEP_A, action: "Open the form", expected_result: "" }]

    const result = await createMission(null, formData({ test_steps: JSON.stringify(bad) }))

    expect(result?.fieldErrors?.test_steps).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects a category outside the vocabulary", async () => {
    const writes = fakeAdmin()

    const result = await createMission(null, formData({ category: "smoke_test" }))

    expect(result?.fieldErrors?.category).toBeTruthy()
    expect(writes).toHaveLength(0)
  })

  it("rejects a device target outside the vocabulary", async () => {
    const writes = fakeAdmin()

    const result = await createMission(null, formData({ device_target: "watch" }))

    expect(result?.fieldErrors?.device_target).toBeTruthy()
    expect(writes).toHaveLength(0)
  })
})

describe("updateMission", () => {
  it("rejects a project the caller does not own", async () => {
    const writes = fakeAdmin()
    vi.mocked(requireProjectOwner).mockRejectedValue(new Error("Not authorized"))

    await expect(updateMission(null, formData())).rejects.toThrow("Not authorized")
    expect(writes).toHaveLength(0)
  })

  it("preserves step ids across an edit that reorders and rewrites text", async () => {
    // The invariant PR 4 depends on: a step's id survives editing, so a
    // tester's answer stays attached to the instruction they actually read.
    const writes = fakeAdmin()
    const reordered = [
      { ...STEPS[1], action: "Submit a valid work email" },
      STEPS[0],
    ]

    await expect(
      updateMission(null, formData({ test_steps: JSON.stringify(reordered) })),
    ).rejects.toThrow(/NEXT_REDIRECT/)

    const written = writes[0].values.test_steps as typeof STEPS
    expect(written.map((s) => s.id)).toEqual([STEP_B, STEP_A])
  })

  it("writes only the explicit column set", async () => {
    const writes = fakeAdmin()

    await expect(updateMission(null, formData())).rejects.toThrow(/NEXT_REDIRECT/)

    // project_id is not writable, and template_id is set once at creation —
    // an edit must not rewrite where a mission came from.
    expect(Object.keys(writes[0].values).sort()).toEqual([
      "category",
      "device_target",
      "is_active",
      "payout_cents",
      "task_description",
      "test_steps",
      "title",
    ])
  })

  it("scopes the write to the owned project as well as the mission", async () => {
    const writes = fakeAdmin()

    await expect(updateMission(null, formData())).rejects.toThrow(/NEXT_REDIRECT/)

    expect(writes[0].filters).toEqual({ id: MISSION_ID, project_id: PROJECT_ID })
  })
})
