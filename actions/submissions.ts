"use server"

import { createClient, uploadToStorage, getPublicUrl } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAnalysis, parseSentiment } from "@/lib/ai"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
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

    // Generate the row id up front so we can reference it in the background
    // update without selecting it back — testers have INSERT but not SELECT
    // rights on test_results under RLS, so a returning select would fail even
    // though the insert succeeds.
    const resultId = crypto.randomUUID()

    // Insert immediately with placeholder analysis so the tester gets a fast
    // response. The AI summary is non-critical enrichment and is generated
    // off the critical path below — see the after() block.
    const { error: dbError } = await supabase
      .from("test_results")
      .insert({
        id: resultId,
        mission_id: missionId,
        tester_id: user.id,
        screenshot_url: publicUrl,
        tester_comment: comment,
        ai_summary: "",
        ai_sentiment: "NEUTRAL",
      })

    if (dbError) {
      return { success: false, error: "Failed to save your feedback. Please try again." }
    }
    // Read the screenshot bytes now (while the in-memory File is in scope) so
    // the analysis can inline them instead of refetching publicUrl.
    const imageBytes = new Uint8Array(await file.arrayBuffer())
    const imageMediaType = file.type
    after(async () => {
      try {
        const { text } = await generateAnalysis(comment, {
          data: imageBytes,
          mediaType: imageMediaType,
        })
        const sentiment = parseSentiment(text)
        const aiSummary = text.replace(sentiment, "").replace(/[*#]/g, "").trim()

        const admin = createAdminClient()
        const { error: updateError } = await admin
          .from("test_results")
          .update({ ai_summary: aiSummary, ai_sentiment: sentiment })
          .eq("id", resultId)
        if (updateError) {
          console.error("[submitTestResult] ai_summary update failed:", updateError)
        }
      } catch (err) {
        // AI analysis is non-critical — the row already exists without it.
        console.error("[submitTestResult] background analysis failed:", err)
      }
    })

    revalidatePath("/dashboard")
    revalidatePath("/explore")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
    return { success: false, error: message }
  }
}
