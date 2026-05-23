"use server"

import { createClient, uploadToStorage, getPublicUrl } from "@/lib/supabase/server"
import { generateAnalysis, parseSentiment } from "@/lib/ai"
import { revalidatePath } from "next/cache"
import { getOwnerId } from "@/lib/utils/project";
import {
  submissionSchema,
  screenshotSchema,
  toFieldErrors,
  type SubmissionInput,
  type FieldErrors,
} from "@/lib/validation/schemas"

export type SubmissionFieldErrors = FieldErrors<
  SubmissionInput & { screenshot: File }
>

export type SubmissionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: SubmissionFieldErrors }

export async function submitTestResult(formData: FormData): Promise<SubmissionResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "You must be logged in to submit feedback." }

    const parsed = submissionSchema.safeParse({
      missionId: formData.get("missionId"),
      comment: formData.get("comment"),
    })
    const fileParsed = screenshotSchema.safeParse(formData.get("screenshot"))

    if (!parsed.success || !fileParsed.success) {
      const fieldErrors: SubmissionFieldErrors = {}
      if (!parsed.success) {
        Object.assign(fieldErrors, toFieldErrors<SubmissionInput>(parsed.error))
      }
      if (!fileParsed.success) {
        // screenshotSchema is a top-level instance check, so errors land at the
        // root rather than under a field key — collect messages directly.
        fieldErrors.screenshot = fileParsed.error.issues.map((i) => i.message)
      }
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors,
      }
    }

    const { missionId, comment } = parsed.data
    const file = fileParsed.data

    const { data: missionData } = await supabase
      .from("missions")
      .select(`
        project_id,
        projects (
          owner_id
        )
      `)
      .eq("id", missionId)
      .single()

    const mission = missionData as unknown as {
      project_id: string
      projects: { owner_id: string } | { owner_id: string }[] | null
    } | null

    const projectOwnerId = getOwnerId(mission?.projects)
    if (projectOwnerId === user.id) {
      return { success: false, error: "Developers cannot submit a test for your own project." }
    }

    const uploadData = await uploadToStorage(supabase, file, user.id)
    const publicUrl = getPublicUrl(supabase, uploadData.path)

    let aiSummary = ""
    let sentiment: "POSITIVE" | "NEUTRAL" | "FRUSTRATED" = "NEUTRAL"
    try {
      const { text } = await generateAnalysis(comment, publicUrl)
      sentiment = parseSentiment(text)
      aiSummary = text.replace(sentiment, "").replace(/[*#]/g, "").trim()
    } catch {
      // AI analysis is non-critical — proceed without it
    }

    const { error: dbError } = await supabase.from("test_results").insert({
      mission_id: missionId,
      tester_id: user.id,
      screenshot_url: publicUrl,
      tester_comment: comment,
      ai_summary: aiSummary,
      ai_sentiment: sentiment,
    })

    if (dbError) return { success: false, error: "Failed to save your feedback. Please try again." }

    revalidatePath("/dashboard")
    revalidatePath("/explore")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
    return { success: false, error: message }
  }
}
