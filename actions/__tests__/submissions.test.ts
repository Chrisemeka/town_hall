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
vi.mock("server-only", () => ({}))
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
import { uploadToStorage } from "@/lib/supabase/server"
import { CLOSED_GRACE, startToken } from "@/lib/reportStart"

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

function formData(
  over: { entries?: unknown; comment?: string; files?: File[]; steps?: Record<string, File[]> } = {},
) {
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
  for (const [stepId, files] of Object.entries(over.steps ?? {})) {
    for (const f of files) fd.append(`screenshots.${stepId}`, f)
  }
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
    isActive?: boolean | null
    closedAt?: string | null
  } = {},
) {
  usageRows = []
  summaryUpdates = []
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = []

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: TESTER_ID } } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  // The mission read goes through service role: projects.owner_id is not
  // readable by a signed-in user (20261006_01).
  const missionRead = {
    select: () => ({
      eq: () => ({
        single: () =>
          Promise.resolve({
            data: {
              project_id: PROJECT_ID,
              test_steps: opts.steps ?? MISSION_STEPS,
              category: opts.category === undefined ? "process_flow" : opts.category,
              is_active: opts.isActive === undefined ? true : opts.isActive,
              closed_at: opts.closedAt ?? null,
              projects: { owner_id: opts.ownerId ?? OWNER_ID },
            },
          }),
      }),
    }),
  }

  vi.mocked(createAdminClient).mockReturnValue({
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      return Promise.resolve({
        data: opts.rpcError ? null : RESULT_ID,
        error: opts.rpcError ?? null,
      })
    },
    from: (table: string) => {
      if (table === "missions") return missionRead
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
    expect(rpc[0].args.p_started_at).toBeNull()
  })

  it("passes the tester's start time through, and drops a malformed one rather than refusing", async () => {
    let rpc = mocks()
    const fd = formData()
    fd.set("startedAt", "2026-10-27T09:00:00.000Z")
    expect((await submitTestResult(fd)).success).toBe(true)
    expect(rpc[0].args.p_started_at).toBe("2026-10-27T09:00:00.000Z")

    rpc = mocks()
    const bad = formData()
    bad.set("startedAt", "yesterday-ish")
    expect((await submitTestResult(bad)).success).toBe(true)
    expect(rpc[0].args.p_started_at).toBeNull()
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

    expect(result).toEqual({ success: false, error: "You've already submitted a report for this test case." })
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
  })

  it("gives the same answer when the database catches a double tap", async () => {
    mocks({ rpcError: { message: "already_submitted", code: "23505" } })

    const result = await submitTestResult(formData())

    expect(result).toEqual({ success: false, error: "You've already submitted a report for this test case." })
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

describe("submitTestResult and step screenshots", () => {
  const failed = (stepId: string, over: Record<string, unknown> = {}) =>
    entry(stepId, { status: "fail", issue_summary: "It broke", steps_to_reproduce: "1. Open it", ...over })
  const blocked = (stepId: string) => ({ ...failed(stepId), status: "blocked" })
  const sentEntries = (rpc: ReturnType<typeof mocks>) =>
    rpc[0].args.p_entries as { step_id: string; screenshot_urls: string[] }[]

  it("uploads a failed step's files and hands that entry exactly those URLs", async () => {
    const rpc = mocks()

    const result = await submitTestResult(
      formData({ entries: [failed(STEP_A), entry(STEP_B)], files: [], steps: { [STEP_A]: [png("a1.png"), png("a2.png")] } }),
    )

    expect(result.success).toBe(true)
    expect(sentEntries(rpc)[0].screenshot_urls).toEqual(["https://cdn.example/p/a1.png", "https://cdn.example/p/a2.png"])
    expect(sentEntries(rpc)[1].screenshot_urls).toEqual([])
    expect(rpc[0].args.p_screenshot_urls).toEqual([])
  })

  it("submits a step report whose only screenshot is on a step — no report-level minimum", async () => {
    const rpc = mocks()

    const result = await submitTestResult(
      formData({ entries: [blocked(STEP_A), entry(STEP_B)], files: [], steps: { [STEP_A]: [png()] } }),
    )

    expect(result.success).toBe(true)
    expect(rpc).toHaveLength(1)
  })

  it("accepts a blocked step with no screenshot", async () => {
    const rpc = mocks()

    const result = await submitTestResult(formData({ entries: [blocked(STEP_A), entry(STEP_B)] }))

    expect(result.success).toBe(true)
    expect(rpc).toHaveLength(1)
  })

  it("refuses a failed step with no screenshot, on that step, before any upload", async () => {
    const rpc = mocks()

    const result = await submitTestResult(formData({ entries: [entry(STEP_A), failed(STEP_B)] }))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.fieldErrors?.["entries.1.screenshots"]).toBeDefined()
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
  })

  it("refuses an all-pass report with no screenshot, asking for the final result", async () => {
    const rpc = mocks()

    const result = await submitTestResult(formData({ files: [] }))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.fieldErrors?.screenshots?.[0]).toMatch(/final result/)
    expect(rpc).toHaveLength(0)
  })

  it("refuses a file on a passing step, before any upload", async () => {
    const rpc = mocks()

    const result = await submitTestResult(formData({ steps: { [STEP_A]: [png()] } }))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.fieldErrors?.["entries.0.screenshots"]?.[0]).toMatch(/passed/)
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
  })

  it("refuses more than the per-step cap, before any upload", async () => {
    const rpc = mocks()

    const result = await submitTestResult(
      formData({ entries: [failed(STEP_A), entry(STEP_B)], files: [], steps: { [STEP_A]: [png(), png(), png(), png()] } }),
    )

    expect(result.success).toBe(false)
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
  })

  it("refuses more than the report total across steps, before any upload", async () => {
    const rpc = mocks()
    const three = () => [png(), png(), png()]

    const result = await submitTestResult(
      formData({
        entries: [failed(STEP_A), failed(STEP_B)],
        files: [png(), png(), png(), png(), png()],
        steps: { [STEP_A]: three(), [STEP_B]: three() },
      }),
    )

    expect(result.success).toBe(false)
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
  })

  it("refuses a screenshots key naming no step on the mission, before any upload", async () => {
    const rpc = mocks()

    const result = await submitTestResult(
      formData({ steps: { "77777777-7777-4777-8777-777777777777": [png()] } }),
    )

    expect(result.success).toBe(false)
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
  })

  it("never passes a client-sent screenshot_urls through to the RPC", async () => {
    const rpc = mocks()
    const forged = "https://evil.example/forged.png"

    const result = await submitTestResult(
      formData({ entries: [entry(STEP_A, { screenshot_urls: [forged] }), entry(STEP_B)] }),
    )

    expect(result.success).toBe(true)
    expect(JSON.stringify(rpc[0].args.p_entries)).not.toContain(forged)
    expect(sentEntries(rpc)[0].screenshot_urls).toEqual([])
  })

  it("still requires one report-level screenshot on a mission with no steps", async () => {
    const rpc = mocks({ steps: [] })

    const result = await submitTestResult(formData({ entries: [], comment: "The nav is broken.", files: [] }))

    expect(result.success).toBe(false)
    expect(rpc).toHaveLength(0)
  })

  it("still saves report-level screenshots on a step mission (a tab opened before the deploy)", async () => {
    const rpc = mocks()

    const result = await submitTestResult(formData({ files: [png("old.png")] }))

    expect(result.success).toBe(true)
    expect(rpc[0].args.p_screenshot_urls).toEqual(["https://cdn.example/p/old.png"])
  })

  it("gives the analysis each step image with its step, and meters the total", async () => {
    mocks()

    await submitTestResult(
      formData({ entries: [failed(STEP_A), entry(STEP_B)], files: [png("final.png")], steps: { [STEP_A]: [png()] } }),
    )

    const images = vi.mocked(generateAnalysis).mock.calls[0][1]
    expect(images.map((i) => i.step ?? null)).toEqual([null, { number: 1, status: "fail" }])
    expect(usageRows[0].image_count).toBe(2)
  })
})

describe("submitTestResult and a closed test case", () => {
  const HOUR = 60 * 60 * 1000
  const closedAt = new Date(Date.now() - HOUR).toISOString()
  const withToken = (token?: string) => {
    const fd = formData()
    if (token) fd.set("startToken", token)
    return fd
  }
  const issued = (msBeforeClose: number) => startToken(MISSION_ID, TESTER_ID, Date.parse(closedAt) - msBeforeClose)

  beforeEach(() => vi.stubEnv("SIGNING_SECRET", "test-secret"))

  /** Refused, and before the rate limit and any upload — a refusal costs neither. */
  async function expectRefused(fd: FormData, rpc: ReturnType<typeof mocks>) {
    const result = await submitTestResult(fd)
    expect(result).toEqual({ success: false, error: expect.stringMatching(/closed before you started/) })
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(uploadToStorage).not.toHaveBeenCalled()
    expect(rpc).toHaveLength(0)
  }

  it("accepts a report on a live test case, as before, with or without a token", async () => {
    mocks()
    expect((await submitTestResult(withToken())).success).toBe(true)
    mocks({ isActive: null })
    expect((await submitTestResult(withToken())).success).toBe(true)
  })

  it("accepts work started before the close and sent inside the grace", async () => {
    const rpc = mocks({ isActive: false, closedAt })
    expect((await submitTestResult(withToken(issued(10 * 60 * 1000)))).success).toBe(true)
    expect(rpc).toHaveLength(1)
  })

  it("refuses a token issued after the close", async () => {
    const rpc = mocks({ isActive: false, closedAt })
    await expectRefused(withToken(issued(-1000)), rpc)
  })

  it("refuses work sent after the grace", async () => {
    const longAgo = new Date(Date.now() - CLOSED_GRACE - HOUR).toISOString()
    const rpc = mocks({ isActive: false, closedAt: longAgo })
    await expectRefused(withToken(startToken(MISSION_ID, TESTER_ID, Date.parse(longAgo) - HOUR)), rpc)
  })

  it("refuses when the close time is unknown — closed before it was recorded", async () => {
    const rpc = mocks({ isActive: false, closedAt: null })
    await expectRefused(withToken(issued(HOUR)), rpc)
  })

  it("refuses with no token, a tampered one, or one for another tester", async () => {
    const good = issued(HOUR)
    const tampered = good.slice(0, -1) + (good.endsWith("a") ? "b" : "a")
    const otherTester = startToken(MISSION_ID, OWNER_ID, Date.parse(closedAt) - HOUR)
    for (const fd of [withToken(), withToken(tampered), withToken(otherTester)]) {
      vi.clearAllMocks()
      await expectRefused(fd, mocks({ isActive: false, closedAt }))
    }
  })

  it("refuses a draft that was never published", async () => {
    // No token is ever issued for one; is_active false and closed_at null.
    const rpc = mocks({ isActive: false, closedAt: null })
    await expectRefused(withToken(), rpc)
  })

  it("never reads the allowance to decide", async () => {
    mocks({ isActive: false, closedAt })
    await submitTestResult(withToken())
    expect(reportBalance).not.toHaveBeenCalled()
  })
})
