"use server"

import { createClient, uploadToStorage, getPublicUrl } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAnalysis, parseSentiment, townhallModel } from "@/lib/ai"
import { recordAiUsage } from "@/lib/aiUsage"
import { revalidatePath } from "next/cache"
import type { z } from "zod"
import { after } from "next/server"
import { getOwnerId } from "@/lib/utils/project";
import { getActiveAccount } from "@/lib/auth"
import { reportLanded } from "@/lib/allowanceDb"
import { checkRateLimit } from "@/lib/rateLimitDb"
import { tooManyMessage } from "@/lib/rateLimit"
import { needsScreenshot, takesScreenshots } from "@/lib/vocabulary"
import {
  auditLogSchemaFor,
  storedTestStepsSchema,
  submissionSchema,
  screenshotSchema,
  screenshotsSchema,
  startedAtSchema,
  MAX_SCREENSHOTS,
  MAX_STEP_SCREENSHOTS,
  SCREENSHOT_REQUIRED,
  toFieldErrors,
  type SubmissionInput,
  type FieldErrors,
} from "@/lib/validation/schemas"

// `entries.<i>.screenshots` is a step's own upload control — the name the
// form gives it, so useFocusFirstError lands on it.
export type SubmissionFieldErrors = FieldErrors<
  SubmissionInput & { screenshots: File[] }
> & { [step: `entries.${number}.screenshots`]: string[] }

export type SubmissionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: SubmissionFieldErrors }

const ALREADY_SUBMITTED = "You've already submitted a report for this test case."

export async function submitTestResult(formData: FormData): Promise<SubmissionResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "You must be logged in to submit a test report." }

    // Submitting feedback is the Tester account's job. Middleware gates the page
    // this posts from, but the action is the thing that actually writes — so the
    // check lives here too, where every caller passes through.
    //
    // Deliberately not requireAccount(): that redirects, and the catch below
    // would swallow the NEXT_REDIRECT into a generic failure. A returned error
    // is the better outcome here anyway — the form can show it.
    const account = await getActiveAccount()
    if (account?.active !== "tester") {
      return { success: false, error: "Switch to your Tester account to submit a test report." }
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
      if (!filesParsed.success) fieldErrors.screenshots = fileIssues(filesParsed.error)
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors,
      }
    }

    const { missionId, comment, entries } = parsed.data
    const files = filesParsed.data

    // Service role: projects.owner_id is not readable by a signed-in user
    // (20261006_01), and the own-project refusal below needs it.
    const { data: missionData } = await createAdminClient()
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

    // One report per tester per mission. submit_audit_log enforces it under a
    // lock; this earlier read only saves the upload and gives the plain answer
    // before any storage is spent.
    const { data: existing } = await createAdminClient()
      .from("test_results")
      .select("id")
      .eq("mission_id", missionId)
      .eq("tester_id", user.id)
      .limit(1)
    if (existing?.length) return { success: false, error: ALREADY_SUBMITTED }

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
          error: "This test case changed while you were testing. Reload and try again.",
        }
      }
      const unknownStep = entries.find((e) => !stepIds.has(e.step_id))
      if (unknownStep) {
        return {
          success: false,
          error: "This test case changed while you were testing. Reload and try again.",
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

    // Step screenshots, judged before any upload so a refused report costs no
    // storage. Files arrive under screenshots.<step_id>; the server builds
    // every URL from them, and auditEntrySchema has no screenshot_urls key, so
    // a URL in the client's entries JSON is stripped and never reaches the RPC.
    const stepFiles = new Map<string, File[]>()
    for (const key of new Set(formData.keys())) {
      if (!key.startsWith("screenshots.")) continue
      if (!stepIds.has(key.slice("screenshots.".length))) {
        return { success: false, error: "This test case changed while you were testing. Reload and try again." }
      }
    }
    for (const [index, e] of entries.entries()) {
      const name = `entries.${index}.screenshots` as const
      const refuse = (message: string): SubmissionResult => ({
        success: false,
        error: `Step ${index + 1}: ${message}`,
        fieldErrors: { [name]: [message] },
      })
      const parsedFiles = screenshotSchema.array().safeParse(formData.getAll(`screenshots.${e.step_id}`))
      if (!parsedFiles.success) return refuse(fileIssues(parsedFiles.error)[0])
      const files = parsedFiles.data
      // The form never sends this; if it happens, the two sides have drifted.
      if (files.length && !takesScreenshots(e.status)) {
        return refuse("This step passed. Screenshots go on a step that didn't.")
      }
      if (files.length > MAX_STEP_SCREENSHOTS) {
        return refuse(`You can attach up to ${MAX_STEP_SCREENSHOTS} screenshots to a step.`)
      }
      if (!files.length && needsScreenshot(e.status)) {
        return refuse("Attach a screenshot of what went wrong.")
      }
      if (files.length) stepFiles.set(e.step_id, files)
    }
    // Every report carries at least one screenshot, on a step or on the report:
    // the proof of a visit. A step report with none attaches its final screen.
    const shotCount = files.length + [...stepFiles.values()].reduce((n, f) => n + f.length, 0)
    if (shotCount === 0) {
      const message = entries.length ? "Attach a screenshot of the final result." : SCREENSHOT_REQUIRED
      return { success: false, error: message, fieldErrors: { screenshots: [message] } }
    }
    if (shotCount > MAX_SCREENSHOTS) {
      const message = `You can attach up to ${MAX_SCREENSHOTS} screenshots to a report.`
      return { success: false, error: message, fieldErrors: { screenshots: [message] } }
    }

    // The abuse guard, not the allowance: nothing here reads the ledger. Fails
    // closed — each submission fires a Gemini call and, from a cohort tester,
    // a payable report. Checked last among the refusals and before the upload,
    // so a refused report costs no storage and a mistake costs no attempt. It
    // bounds uploads too: the only upload path is the one below, so screenshots
    // are capped at this limit times MAX_SCREENSHOTS.
    // ponytail: analysis rides on this limit because it runs in after(). When
    // generation becomes builder-triggered it needs its own key.
    const rate = await checkRateLimit(["submit:account", user.id])
    if (!rate.ok) return { success: false, error: tooManyMessage(rate.retryAfter) }

    // Upload in parallel, preserving the tester's ordering in each array.
    const upload = (list: File[]) =>
      Promise.all(
        list.map(async (file) => {
          const uploadData = await uploadToStorage(supabase, file, user.id)
          return getPublicUrl(supabase, uploadData.path)
        }),
      )
    const [publicUrls, stepUrls] = await Promise.all([
      upload(files),
      Promise.all(entries.map((e) => upload(stepFiles.get(e.step_id) ?? []))),
    ])

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
      p_entries: entries.map((e, i) => ({ ...e, screenshot_urls: stepUrls[i] })),
      p_started_at: startedAtSchema.parse(formData.get("startedAt")),
    })

    // 23505 from the function is the same rule, lost to a race — a double tap.
    if (dbError?.code === "23505") return { success: false, error: ALREADY_SUBMITTED }
    if (dbError || !resultId) {
      console.error("[submitTestResult] submit_audit_log failed:", dbError)
      return { success: false, error: "Failed to save your test report. Please try again." }
    }

    // The submission is committed. The tester's earned credit, and the mission
    // closing itself once full, happen after it and cannot undo it:
    // reportLanded never throws. Nothing before this point reads the allowance —
    // a submission is never refused by it, at any balance.
    await reportLanded(resultId)
    // Read the screenshot bytes now (while the in-memory Files are in scope) so
    // the analysis can inline them instead of refetching the public URLs.
    // Each step's images carry the step they show, so the model reads them
    // against it; report-level ones carry none.
    const images = await Promise.all(
      [
        ...files.map((file) => ({ file, step: null })),
        ...entries.flatMap((e, i) =>
          (stepFiles.get(e.step_id) ?? []).map((file) => ({ file, step: { number: i + 1, status: e.status } })),
        ),
      ].map(async ({ file, step }) => ({
        data: new Uint8Array(await file.arrayBuffer()),
        mediaType: file.type,
        step,
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

/**
 * screenshotSchema validates each file in place, so issues land at the array
 * root (count limits) or at an index (a bad file) — flatten both, naming the
 * offending image so the tester knows which one to fix.
 */
function fileIssues(error: z.ZodError): string[] {
  return error.issues.map((i) =>
    typeof i.path[0] === "number" ? `Screenshot ${i.path[0] + 1} — ${i.message}` : i.message,
  )
}
