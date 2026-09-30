"use server"

import { createClient, uploadToStorage, getPublicUrl } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAnalysis, parseSentiment, townhallModel } from "@/lib/ai"
import { recordAiUsage } from "@/lib/aiUsage"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { getOwnerId } from "@/lib/utils/project";
import { getActiveAccount } from "@/lib/auth"
import { reportLanded } from "@/lib/allowanceDb"
import {
  auditLogSchemaFor,
  storedTestStepsSchema,
  submissionSchema,
  screenshotsSchema,
  toFieldErrors,
  type SubmissionInput,
  type FieldErrors,
} from "@/lib/validation/schemas"

export type SubmissionFieldErrors = FieldErrors<
  SubmissionInput & { screenshots: File[] }
>

export type SubmissionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: SubmissionFieldErrors }

export async function submitTestResult(formData: FormData): Promise<SubmissionResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "You must be logged in to submit feedback." }

    // Submitting feedback is the Tester account's job. Middleware gates the page
    // this posts from, but the action is the thing that actually writes — so the
    // check lives here too, where every caller passes through.
    //
    // Deliberately not requireAccount(): that redirects, and the catch below
    // would swallow the NEXT_REDIRECT into a generic failure. A returned error
    // is the better outcome here anyway — the form can show it.
    const account = await getActiveAccount()
    if (account?.active !== "tester") {
      return { success: false, error: "Switch to your Tester account to submit feedback." }
    }

    const parsed = submissionSchema.safeParse({
      missionId: formData.get("missionId"),
      comment: formData.get("comment"),
      entries: formData.get("entries") ?? "[]",
    })
    const filesParsed = screenshotsSchema.safeParse(formData.getAll("screenshots"))

    if (!parsed.success || !filesParsed.success) {
      const fieldErrors: SubmissionFieldErrors = {}
      if (!parsed.success) {
        Object.assign(fieldErrors, toFieldErrors<SubmissionInput>(parsed.error))
      }
      if (!filesParsed.success) {
        // screenshotsSchema validates each file in place, so issues land at the
        // array root (count limits) or at an index (a bad file) — flatten both,
        // naming the offending image so the tester knows which one to fix.
        fieldErrors.screenshots = filesParsed.error.issues.map((i) =>
          typeof i.path[0] === "number" ? `Screenshot ${i.path[0] + 1} — ${i.message}` : i.message,
        )
      }
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors,
      }
    }

    const { missionId, comment, entries } = parsed.data
    const files = filesParsed.data

    const { data: missionData } = await supabase
      .from("missions")
      .select(`
        project_id,
        test_steps,
        category,
        projects (
          owner_id
        )
      `)
      .eq("id", missionId)
      .single()

    const mission = missionData as unknown as {
      project_id: string
      test_steps: unknown
      category: string | null
      projects: { owner_id: string } | { owner_id: string }[] | null
    } | null

    const projectOwnerId = getOwnerId(mission?.projects)
    if (projectOwnerId === user.id) {
      return { success: false, error: "Developers cannot submit a test for your own project." }
    }

    // The entries carry their own step text, because that snapshot is what the
    // audit log records. That makes it worth checking against the live mission
    // once, here: after the write nothing can falsify a snapshot, so a tester
    // filing against steps that do not exist would be unanswerable later.
    const liveSteps = storedTestStepsSchema.safeParse(mission?.test_steps)
    const stepIds = new Set(liveSteps.success ? liveSteps.data.map((s) => s.id) : [])

    if (entries.length > 0) {
      if (entries.length !== stepIds.size) {
        return {
          success: false,
          error: "This mission changed while you were testing. Reload and try again.",
        }
      }
      const unknownStep = entries.find((e) => !stepIds.has(e.step_id))
      if (unknownStep) {
        return {
          success: false,
          error: "This mission changed while you were testing. Reload and try again.",
        }
      }
    }

    // The category's own rule, which only the mission row can supply: a
    // ui_design step owes a description at every status, pass included. Runs
    // before the upload so a refused log costs no storage. `entries` is passed
    // on unchanged — this only judges it, so the RPC's argument shape is the
    // same for every category.
    const judged = auditLogSchemaFor(mission?.category).safeParse(entries)
    if (!judged.success) {
      const issue = judged.error.issues[0]
      const step = typeof issue.path[0] === "number" ? issue.path[0] + 1 : null
      return {
        success: false,
        error: step ? `Step ${step}: ${issue.message}` : issue.message,
      }
    }

    // Upload in parallel, preserving the tester's ordering in the result array.
    const publicUrls = await Promise.all(
      files.map(async (file) => {
        const uploadData = await uploadToStorage(supabase, file, user.id)
        return getPublicUrl(supabase, uploadData.path)
      }),
    )

    // One row plus N entries, atomically. A plpgsql body is one transaction, so
    // a failure partway through the entries rolls the parent back with it —
    // sequential inserts would leave a submission that looks complete with half
    // its audit log missing.
    //
    // Service role: the function is security definer and execution is granted
    // to service_role alone, so it is not reachable from the browser.
    //
    // The RPC returns the new id, which is why this no longer mints one
    // client-side to dodge a returning select.
    const { data: resultId, error: dbError } = await createAdminClient().rpc("submit_audit_log", {
      p_mission_id: missionId,
      p_tester_id: user.id,
      p_screenshot_urls: publicUrls,
      p_tester_comment: comment ?? "",
      p_entries: entries,
    })

    if (dbError || !resultId) {
      console.error("[submitTestResult] submit_audit_log failed:", dbError)
      return { success: false, error: "Failed to save your feedback. Please try again." }
    }

    // The submission is committed. The tester's earned credit, and the mission
    // closing itself once full, happen after it and cannot undo it:
    // reportLanded never throws. Nothing before this point reads the allowance —
    // a submission is never refused by it, at any balance.
    await reportLanded(resultId)
    // Read the screenshot bytes now (while the in-memory Files are in scope) so
    // the analysis can inline them instead of refetching the public URLs.
    const images = await Promise.all(
      files.map(async (file) => ({
        data: new Uint8Array(await file.arrayBuffer()),
        mediaType: file.type,
      })),
    )
    // Who and what each analysis was for, for the cost record. Denormalised on
    // purpose: the row must outlive the submission.
    const metered = {
      testResultId: resultId,
      projectId: mission?.project_id ?? null,
      profileId: projectOwnerId ?? null,
      imageCount: images.length,
    }
    after(async () => {
      let recorded = false
      try {
        const { text, usage, model } = await generateAnalysis({ comment: comment ?? "", entries }, images)
        // ponytail: metering follows the Gemini call. When analysis moves from
        // automatic to builder-triggered, this moves with it. recordAiUsage
        // never throws, so it cannot cost the ai_summary update below.
        await recordAiUsage({ ...metered, model, status: "succeeded", usage })
        recorded = true
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
        // A failure after the Gemini call (the ai_summary update throwing) was
        // still a paid, successful analysis — record a failure only if the
        // call itself never produced one.
        if (!recorded) {
          await recordAiUsage({ ...metered, model: townhallModel.modelId, status: "failed", error: err })
        }
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
