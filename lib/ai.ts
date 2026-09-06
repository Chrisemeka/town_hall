import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const townhallModel = google('gemini-3-flash-preview');

/** What the analysis is given: the audit log, plus whatever else was typed. */
export type AnalysisInput = {
  comment: string
  entries: {
    step_action: string
    step_expected: string
    status: string
    actual_result: string
    expected_result: string
    issue_summary?: string
    steps_to_reproduce?: string
  }[]
}

/** The audit log as text the model can reason over, one block per step. */
function renderEntries(entries: AnalysisInput["entries"]): string {
  return entries
    .map((e, i) => {
      const lines = [
        `Step ${i + 1} — ${e.status.toUpperCase()}`,
        `  Asked to: ${e.step_action}`,
        `  Builder expected: ${e.step_expected}`,
        `  Tester expected: ${e.expected_result}`,
        `  What happened: ${e.actual_result}`,
      ]
      if (e.issue_summary) lines.push(`  Issue: ${e.issue_summary}`)
      if (e.steps_to_reproduce) lines.push(`  Reproduce: ${e.steps_to_reproduce}`)
      return lines.join("\n")
    })
    .join("\n\n")
}

/**
 * The analysis prompt.
 *
 * Takes the structured log where there is one, and falls back to the bare
 * comment where there is not — the submissions written before the audit log
 * have only a comment, and re-analysing one of those must still work.
 *
 * The summary should be better than it was, not just different: it now knows
 * which steps failed and how, so it leads with that instead of paraphrasing.
 * Sentiment weighs the pass/fail distribution rather than tone alone — a
 * politely-worded log where four of five steps failed is not neutral.
 */
export const ANALYSIS_PROMPT = (input: AnalysisInput, imageCount: number) => {
  const shots =
    imageCount > 1
      ? `There are ${imageCount} screenshots, in the order the tester captured them — read them as one journey.`
      : imageCount === 1
        ? "There is one screenshot."
        : "There are no screenshots."

  const body = input.entries.length
    ? `The tester worked through the builder's test case and answered each step:

${renderEntries(input.entries)}

${input.comment ? `They also added: "${input.comment}"` : "They added no extra comment."}

Lead with what failed and why it matters. Name the specific steps. If everything
passed, say so plainly rather than inventing concerns.`
    : `The tester left this feedback: "${input.comment}"`

  return `You are an expert QA engineer summarising one tester's report for the
developer who built the product. Be concise, concrete and jargon-free.

${shots}

${body}

End your response with exactly one of POSITIVE, NEUTRAL or FRUSTRATED on its own
line, judging the tester's overall experience. Weigh how much actually worked,
not only how politely it was written.`
}

export const generateAnalysis = async (
  input: AnalysisInput,
  images: { data: Uint8Array; mediaType: string }[],
) => {
  const { text } = await generateText({
    model: townhallModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: ANALYSIS_PROMPT(input, images.length) },
          // Inline the screenshot bytes so the model doesn't have to fetch the
          // images back out of Supabase Storage over the network.
          ...images.map((image) => ({
            type: "image" as const,
            image: image.data,
            mediaType: image.mediaType,
          })),
        ],
      },
    ],
  })
  return { text }
}

export const parseSentiment = (analysis: string): "POSITIVE" | "NEUTRAL" | "FRUSTRATED" => {
  if (analysis.includes("FRUSTRATED")) return "FRUSTRATED";
  if (analysis.includes("POSITIVE")) return "POSITIVE";
  return "NEUTRAL";
};