import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { estimateCostUsd, recordAiUsage } from "@/lib/aiUsage"
import { createAdminClient } from "@/lib/supabase/admin"

const MODEL = "gemini-3-flash-preview"

describe("estimateCostUsd", () => {
  it("prices a million of each at the map's rates", () => {
    expect(estimateCostUsd(MODEL, 1_000_000, 1_000_000)).toBe(3.5)
  })

  it("prices a realistic call exactly", () => {
    // 2400 × 0.5/1M + 350 × 3/1M = 0.0012 + 0.00105
    expect(estimateCostUsd(MODEL, 2400, 350)).toBe(0.00225)
  })

  it("treats a missing count as unknown, not free", () => {
    expect(estimateCostUsd(MODEL, null, 350)).toBeNull()
    expect(estimateCostUsd(MODEL, 2400, null)).toBeNull()
  })

  it("treats a model with no rate as unknown, not free", () => {
    expect(estimateCostUsd("some-future-model", 2400, 350)).toBeNull()
  })
})

describe("recordAiUsage", () => {
  const base = {
    testResultId: "r",
    projectId: "p",
    profileId: "o",
    model: MODEL,
    imageCount: 2,
  }

  let inserts: Record<string, unknown>[]
  beforeEach(() => {
    inserts = []
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          inserts.push(row)
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as ReturnType<typeof createAdminClient>)
  })

  it("stores tokens and the cost computed at write time", async () => {
    await recordAiUsage({ ...base, status: "succeeded", usage: { inputTokens: 2400, outputTokens: 350 } })
    expect(inserts).toEqual([
      expect.objectContaining({
        input_tokens: 2400,
        output_tokens: 350,
        estimated_cost_usd: 0.00225,
        image_count: 2,
        status: "succeeded",
        error: null,
      }),
    ])
  })

  it("stores null tokens and cost when usage is absent", async () => {
    await recordAiUsage({ ...base, status: "succeeded", usage: undefined })
    expect(inserts[0]).toMatchObject({ input_tokens: null, output_tokens: null, estimated_cost_usd: null })
  })

  it("stores a failure with its message and no tokens", async () => {
    await recordAiUsage({ ...base, status: "failed", error: new Error("gemini down") })
    expect(inserts[0]).toMatchObject({ status: "failed", error: "gemini down", estimated_cost_usd: null })
  })

  it("resolves when the insert returns an error", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({ insert: () => Promise.resolve({ error: { message: "relation does not exist" } }) }),
    } as unknown as ReturnType<typeof createAdminClient>)
    await expect(recordAiUsage({ ...base, status: "succeeded", usage: undefined })).resolves.toBeUndefined()
  })

  it("resolves when the client throws", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("no service key")
    })
    await expect(recordAiUsage({ ...base, status: "failed", error: "x" })).resolves.toBeUndefined()
  })
})
