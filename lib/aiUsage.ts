// Shadow metering: what each AI analysis cost. Records, never limits.
//
// A cost record, NOT a quota ledger. Nothing here or in ai_usage_events is
// read to block, count down or charge anyone. If you are about to use it for
// that, that is tier enforcement — separate work, with its own sequencing.
// See docs/specs/SPEC-ai-shadow-metering.md.
//
// Separate from lib/ai.ts because that module builds the Google provider at
// import time and every test mocks it wholesale; the arithmetic here needs to
// be testable directly.

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * USD per 1M tokens, keyed by model id.
 *
 * Checked 2026-09-29 against Google's published Gemini API pricing. Published
 * rates go stale — a silently wrong constant is worse than an obviously old
 * one, so re-check when this date is old and update it with the numbers.
 */
export const AI_RATES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
}

/**
 * Cost of one call, computed at write time and stored — never at read time,
 * or a price change would rewrite what past analyses cost.
 *
 * Null when a count is missing or the model has no rate: unknown is not free.
 * No text/image split of the input total — the SDK already counts image
 * tokens in it, and image_count is stored alongside for the correlation.
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  const rate = AI_RATES_USD_PER_MTOK[model]
  if (!rate || inputTokens == null || outputTokens == null) return null
  // Rounded to the column's numeric(12,8) scale so the stored value is the
  // returned one, without float noise past the 8th place.
  return Number(((inputTokens * rate.input + outputTokens * rate.output) / 1_000_000).toFixed(8))
}

export type AiUsageEvent = {
  testResultId: string
  projectId: string | null
  profileId: string | null
  model: string
  imageCount: number
} & (
  | { status: "succeeded"; usage: { inputTokens?: number; outputTokens?: number } | undefined }
  | { status: "failed"; error: unknown }
)

const ERROR_MAX = 1000

/**
 * Writes one ai_usage_events row. Swallows every failure and returns void, the
 * same contract as sendWelcomeEmail: a side effect of a side effect, it must
 * never be the reason a submission or its ai_summary update is lost.
 */
export async function recordAiUsage(event: AiUsageEvent): Promise<void> {
  try {
    const input = event.status === "succeeded" ? (event.usage?.inputTokens ?? null) : null
    const output = event.status === "succeeded" ? (event.usage?.outputTokens ?? null) : null
    const error =
      event.status === "failed"
        ? (event.error instanceof Error ? event.error.message : String(event.error)).slice(0, ERROR_MAX)
        : null

    const { error: insertError } = await createAdminClient()
      .from("ai_usage_events")
      .insert({
        test_result_id: event.testResultId,
        project_id: event.projectId,
        profile_id: event.profileId,
        model: event.model,
        input_tokens: input,
        output_tokens: output,
        image_count: event.imageCount,
        estimated_cost_usd: estimateCostUsd(event.model, input, output),
        status: event.status,
        error,
      })
    if (insertError) console.error("[recordAiUsage] insert failed:", insertError)
  } catch (err) {
    console.error("[recordAiUsage] unexpected error:", err)
  }
}
