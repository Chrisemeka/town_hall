import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
// after() normally defers to the response; run it inline so the AI path is
// exercised rather than silently skipped.
vi.mock("next/server", () => ({ after: vi.fn((fn: () => unknown) => fn()) }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  uploadToStorage: vi.fn(async (_c: unknown, file: File) => ({ path: `p/${file.name}` })),
  getPublicUrl: vi.fn((_c: unknown, path: string) => `https://cdn.example/${path}`),
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getActiveAccount: vi.fn() }))
// The limiter's own behaviour is lib/__tests__/rateLimitDb.test.ts. Here it
// passes unless a test says otherwise, and never reaches the admin client.
vi.mock("@/lib/rateLimitDb", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  clientIp: vi.fn(() => "203.0.113.7"),
}))
// Only reportLanded is on the submission path. Anything that reads a balance
// is mocked to throw, so a test fails if the path ever starts consulting one.
vi.mock("@/lib/allowanceDb", () => ({
  reportLanded: vi.fn(async () => {}),
  reportBalance: vi.fn(async () => { throw new Error("submission read the allowance") }),
  publishMission: vi.fn(async () => { throw new Error("submission touched publish") }),
}))
vi.mock("@/lib/ai", () => ({
  generateAnalysis: vi.fn(async () => ({
    text: "Looks solid.\nPOSITIVE",
    usage: { inputTokens: 2400, outputTokens: 350 },
    model: "gemini-3-flash-preview",
  })),
  parseSentiment: vi.fn(() => "POSITIVE"),
  townhallModel: { modelId: "gemini-3-flash-preview" },
}))
// lib/aiUsage is deliberately NOT mocked: the metering tests below need its
// real swallow-every-failure behaviour, driven through the admin client.

import { submitTestResult } from "@/actions/submissions"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAccount } from "@/lib/auth"
import { generateAnalysis } from "@/lib/ai"
import { reportBalance, reportLanded } from "@/lib/allowanceDb"
import { checkRateLimit } from "@/lib/rateLimitDb"

const TESTER_ID = "11111111-1111-4111-8111-111111111111"
const OWNER_ID = "22222222-2222-4222-8222-222222222222"
const MISSION_ID = "33333333-3333-4333-8333-333333333333"
const RESULT_ID = "44444444-4444-4444-8444-444444444444"
const PROJECT_ID = "88888888-8888-4888-8888-888888888888"
const STEP_A = "55555555-5555-4555-8555-555555555555"
const STEP_B = "66666666-6666-4666-8666-666666666666"

const MISSION_STEPS = [
  { id: STEP_A, action: "Open the sign-up form", expected_result: "The form appears" },
  { id: STEP_B, action: "Submit a valid email", expected_result: "A verification email arrives" },
]

const entry = (stepId: string, over: Record<string, unknown> = {}) => ({
  step_id: stepId,
  step_action: "Open the sign-up form",
  step_expected: "The form appears",
  status: "pass",
  actual_result: "The form appeared straight away",
  expected_result: "The form appears",
  issue_summary: "",
  steps_to_reproduce: "",
  ...over,
})

function png(name = "shot.png") {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" })
}

function formData(over: { entries?: unknown; comment?: string; files?: File[] } = {}) {
  const fd = new FormData()
  fd.set("missionId", MISSION_ID)
  fd.set("comment", over.comment ?? "")
  fd.set(
    "entries",
    typeof over.entries === "string"
      ? over.entries
      : JSON.stringify(over.entries ?? [entry(STEP_A), entry(STEP_B)]),
  )
  for (const f of over.files ?? [png()]) fd.append("screenshots", f)
  return fd
}

/** Rows recordAiUsage inserted, and ai_summary updates made, since the last mocks(). */
let usageRows: Record<string, unknown>[] = []
let summaryUpdates: Record<string, unknown>[] = []

/**
 * Records the rpc call; `rpcError` makes the write fail. `meteringFails`
 * makes the ai_usage_events insert throw.
 */
function mocks(
  opts: {
    ownerId?: string
    steps?: unknown
    category?: string | null
    rpcError?: { message: string; code?: string }
    meteringFails?: boolean
    alreadySubmitted?: boolean
  } = {},
) {
  usageRows = []
  summaryUpdates = []
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = []

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: TESTER_ID } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                project_id: PROJECT_ID,
                test_steps: opts.steps ?? MISSION_STEPS,
                category: opts.category === undefined ? "process_flow" : opts.category,
                projects: { owner_id: opts.ownerId ?? OWNER_ID },
              },
            }),
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  vi.mocked(createAdminClient).mockReturnValue({
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      return Promise.resolve({
        data: opts.rpcError ? null : RESULT_ID,
        error: opts.rpcError ?? null,
      })
    },
    from: (table: string) => {
      if (table === "ai_usage_events") {
        return {
          insert: (row: Record<string, unknown>) => {
            if (opts.meteringFails) throw new Error("relation does not exist")
            usageRows.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      // test_results: the earlier-report lookup, and the ai_summary update.
      const existing = {
        eq: () => existing,
        limit: () => Promise.resolve({ data: opts.alreadySubmitted ? [{ id: "earlier" }] : [], error: null }),
      }
      return {
        select: () => existing,
        update: (row: Record<string, unknown>) => {
          summaryUpdates.push(row)
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
    },
  } as unknown as ReturnType<typeof createAdminClient>)

  return rpcCalls
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getActiveAccount).mockResolvedValue({
    userId: TESTER_ID,
    active: "tester",
    types: ["tester"],
    verified: true,
    emailConfirmed: true
  })
})

describe("submitTestResult", () => {
  it("refuses an unauthenticated caller", async () => {
    const rpc = mocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const result = await submitTestResult(formData())

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("refuses an account that is not acting as a tester", async () => {
    const rpc = mocks()
    vi.mocked(getActiveAccount).mockResolvedValue({
      userId: TESTER_ID,
      active: "builder",
      types: ["builder"],
      verified: true,
    emailConfirmed: true
    })

    const result = await submitTestResult(formData())

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("refuses a tester submitting against their own project (SUB-02)", async () => {
    const rpc = mocks({ ownerId: TESTER_ID })

    const result = await submitTestResult(formData())

    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(/own project/i)
    expect(rpc).toHaveLength(0)
  })

  it("writes one row and its entries through the RPC", async () => {
    const rpc = mocks()

    const result = await submitTestResult(formData())

    expect(result.success).toBe(true)
    expect(rpc).toHaveLength(1)
    expect(rpc[0].name).toBe("submit_audit_log")
    expect(rpc[0].args.p_mission_id).toBe(MISSION_ID)
    expect(rpc[0].args.p_tester_id).toBe(TESTER_ID)
    expect((rpc[0].args.p_entries as unknown[]).length).toBe(2)
  })

  it("uploads screenshots before the write, so a failed upload persists nothing (SUB-03)", async () => {
    const rpc = mocks()
    const { uploadToStorage } = await import("@/lib/supabase/server")
    vi.mocked(uploadToStorage).mockRejectedValueOnce(new Error("storage down"))

    const result = await submitTestResult(formData())

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("keeps the submission when AI analysis fails (SUB-04)", async () => {
    const rpc = mocks()
    vi.mocked(generateAnalysis).mockRejectedValueOnce(new Error("gemini down"))

    const result = await submitTestResult(formData())

    expect(result.success).toBe(true)
    expect(rpc).toHaveLength(1)
  })

  it("rejects an entry naming a step the mission does not have", async () => {
    // The snapshot makes this unfalsifiable after the write, so it has to be
    // caught here.
    const rpc = mocks()
    const ghost = "77777777-7777-4777-8777-777777777777"

    const result = await submitTestResult(formData({ entries: [entry(ghost), entry(STEP_B)] }))

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("rejects a log that does not cover every step", async () => {
    const rpc = mocks()

    const result = await submitTestResult(formData({ entries: [entry(STEP_A)] }))

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("rejects a failing step with no issue summary", async () => {
    const rpc = mocks()
    const entries = [
      entry(STEP_A, { status: "fail", steps_to_reproduce: "1. Open it" }),
      entry(STEP_B),
    ]

    const result = await submitTestResult(formData({ entries }))

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("rejects a failing step with no reproduction steps", async () => {
    const rpc = mocks()
    const entries = [entry(STEP_A, { status: "fail", issue_summary: "It broke" }), entry(STEP_B)]

    const result = await submitTestResult(formData({ entries }))

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("accepts a passing step with neither", async () => {
    // The whole reason the rule is conditional: "N/A" four times per passing
    // step is how the data becomes worthless.
    const rpc = mocks()

    const result = await submitTestResult(formData())

    expect(result.success).toBe(true)
    expect(rpc).toHaveLength(1)
  })

  it("rejects malformed entries JSON as a field error rather than throwing", async () => {
    const rpc = mocks()

    const result = await submitTestResult(formData({ entries: "{not json" }))

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("accepts a comment-only submission on a mission with no steps", async () => {
    // Thirteen of sixteen live missions are this shape.
    const rpc = mocks({ steps: [] })

    const result = await submitTestResult(
      formData({ entries: [], comment: "Nothing structured to file against, but the nav is broken." }),
    )

    expect(result.success).toBe(true)
    expect((rpc[0].args.p_entries as unknown[]).length).toBe(0)
  })

  it("refuses a submission that carries neither entries nor a comment", async () => {
    const rpc = mocks({ steps: [] })

    const result = await submitTestResult(formData({ entries: [], comment: "" }))

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("surfaces an RPC failure instead of reporting success", async () => {
    mocks({ rpcError: { message: "deadlock detected" } })

    const result = await submitTestResult(formData())

    expect(result.success).toBe(false)
    expect(reportLanded).not.toHaveBeenCalled()
  })
})

describe("submitTestResult and the allowance", () => {
  it("credits the tester after the submission is written", async () => {
    mocks()
    const result = await submitTestResult(formData())
    expect(result.success).toBe(true)
    expect(reportLanded).toHaveBeenCalledWith(RESULT_ID)
  })

  it("succeeds with the builder at zero balance — nothing on this path reads one", async () => {
    // The mission was published; the tester's work is owed. reportBalance is
    // mocked to throw, so any read of the allowance here would fail the test.
    mocks()
    const result = await submitTestResult(formData())
    expect(result.success).toBe(true)
    expect(reportBalance).not.toHaveBeenCalled()
  })
})

describe("submitTestResult — one report per tester per mission", () => {
  it("refuses a second report before uploading anything", async () => {
    const rpc = mocks({ alreadySubmitted: true })
    const { uploadToStorage } = await import("@/lib/supabase/server")

    const result = await submitTestResult(formData())

    expect(result).toEqual({ success: false, error: "You've already submitted a report for this mission." })
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
  })

  it("gives the same answer when the database catches a double tap", async () => {
    mocks({ rpcError: { message: "already_submitted", code: "23505" } })

    const result = await submitTestResult(formData())

    expect(result).toEqual({ success: false, error: "You've already submitted a report for this mission." })
  })
})

describe("submitTestResult by mission category", () => {
  const bare = [entry(STEP_A, { actual_result: "" }), entry(STEP_B, { actual_result: "" })]

  it("rejects a ui_design pass with no description, before writing anything", async () => {
    const rpc = mocks({ category: "ui_design" })
    const result = await submitTestResult(formData({ entries: bare }))
    expect(result.success).toBe(false)
    expect(!result.success && result.error).toMatch(/^Step 1: Describe what you saw/)
    expect(rpc).toHaveLength(0)
  })

  it("accepts a described ui_design log", async () => {
    const rpc = mocks({ category: "ui_design" })
    const described = { actual_result: "The purpose was clear within a few seconds" }
    const result = await submitTestResult(
      formData({ entries: [entry(STEP_A, described), entry(STEP_B, described)] }),
    )
    expect(result.success).toBe(true)
    expect(rpc).toHaveLength(1)
  })

  for (const category of ["process_flow", "component", null, "retired_category"]) {
    it(`still accepts a bare pass on a ${String(category)} mission`, async () => {
      const rpc = mocks({ category })
      const result = await submitTestResult(formData({ entries: bare }))
      expect(result.success).toBe(true)
      expect(rpc).toHaveLength(1)
    })
  }

  it("calls submit_audit_log with the same argument shape and stored statuses for ui_design", async () => {
    const described = { actual_result: "The purpose was clear within a few seconds" }
    const entries = [entry(STEP_A, described), entry(STEP_B, { ...described, status: "blocked", issue_summary: "Hero image never loaded", steps_to_reproduce: "1. Open the page on 3G" })]

    const designRpc = mocks({ category: "ui_design" })
    await submitTestResult(formData({ entries }))
    const flowRpc = mocks({ category: "process_flow" })
    await submitTestResult(formData({ entries }))

    expect(designRpc[0].name).toBe("submit_audit_log")
    expect(Object.keys(designRpc[0].args).sort()).toEqual(Object.keys(flowRpc[0].args).sort())
    expect(designRpc[0].args.p_entries).toEqual(flowRpc[0].args.p_entries)
    const statuses = (designRpc[0].args.p_entries as { status: string }[]).map((e) => e.status)
    expect(statuses).toEqual(["pass", "blocked"])
  })
})

describe("submitTestResult AI shadow metering", () => {
  // after() is mocked to run inline but the action does not await it; one
  // macrotask lets the background block finish before asserting on it.
  const settle = () => new Promise((r) => setTimeout(r, 0))

  it("records exactly one succeeded event for a successful analysis", async () => {
    mocks()
    const result = await submitTestResult(formData({ files: [png("a.png"), png("b.png")] }))
    await settle()

    expect(result.success).toBe(true)
    expect(usageRows).toEqual([
      expect.objectContaining({
        test_result_id: RESULT_ID,
        project_id: PROJECT_ID,
        profile_id: OWNER_ID,
        model: "gemini-3-flash-preview",
        input_tokens: 2400,
        output_tokens: 350,
        image_count: 2,
        estimated_cost_usd: 0.00225,
        status: "succeeded",
        error: null,
      }),
    ])
  })

  it("records exactly one failed event, with the error, when the analysis fails", async () => {
    mocks()
    vi.mocked(generateAnalysis).mockRejectedValueOnce(new Error("gemini down"))

    const result = await submitTestResult(formData())
    await settle()

    expect(result.success).toBe(true)
    expect(usageRows).toHaveLength(1)
    expect(usageRows[0]).toMatchObject({
      status: "failed",
      error: "gemini down",
      input_tokens: null,
      estimated_cost_usd: null,
    })
    expect(summaryUpdates).toHaveLength(0)
  })

  it("keeps the submission and the ai_summary update when the metering insert fails", async () => {
    const rpc = mocks({ meteringFails: true })

    const result = await submitTestResult(formData())
    await settle()

    expect(result.success).toBe(true)
    expect(rpc).toHaveLength(1)
    expect(usageRows).toHaveLength(0)
    expect(summaryUpdates).toEqual([{ ai_summary: "Looks solid.", ai_sentiment: "POSITIVE" }])
  })

  it("records null tokens and cost when the SDK returns no usage", async () => {
    mocks()
    vi.mocked(generateAnalysis).mockResolvedValueOnce({
      text: "Looks solid.\nPOSITIVE",
      usage: undefined as unknown as Awaited<ReturnType<typeof generateAnalysis>>["usage"],
      model: "gemini-3-flash-preview",
    })

    const result = await submitTestResult(formData())
    await settle()

    expect(result.success).toBe(true)
    expect(usageRows).toHaveLength(1)
    expect(usageRows[0]).toMatchObject({
      status: "succeeded",
      input_tokens: null,
      output_tokens: null,
      estimated_cost_usd: null,
    })
  })
})

describe("the submission rate limit", () => {
  it("refuses before any upload or write, keyed on the account", async () => {
    const rpc = mocks()
    const { uploadToStorage } = await import("@/lib/supabase/server")
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })

    const result = await submitTestResult(formData())

    expect(result).toEqual({ success: false, error: "Too many attempts. Try again in a minute." })
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
    expect(checkRateLimit).toHaveBeenCalledWith(["submit:account", TESTER_ID])
  })

  it("a second report on the same mission is refused without spending an attempt", async () => {
    mocks({ alreadySubmitted: true })
    await submitTestResult(formData())
    expect(checkRateLimit).not.toHaveBeenCalled()
  })
})
