"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendApprovalNotification } from "@/lib/mail"
import { requireAccount } from "@/lib/auth"
import { one } from "@/lib/utils/project"
import { nextStatus, toStatus } from "@/lib/review"
import {
  reviewSchema,
  toFieldErrors,
  type ReviewInput,
  type FieldErrors,
} from "@/lib/validation/schemas"

export type ReviewState =
  | null
  | { success: true }
  | { success: false; error: string; fieldErrors?: FieldErrors<ReviewInput> }

/**
 * Builder approves and rates a tester submission.
 *
 * Writes go through the service-role client rather than an RLS policy on
 * purpose: RLS can gate *rows* but not *columns*, so a builder UPDATE policy on
 * test_results would also let a builder rewrite the tester's own comment. Here
 * the column set is fixed in code and ownership is proven first.
 */
export async function reviewSubmission(
  _prevState: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  // Tester accounts can't reach this at all, regardless of what they own.
  const { userId } = await requireAccount("builder")

  const parsed = reviewSchema.safeParse({
    resultId: formData.get("resultId"),
    action: formData.get("action"),
    rating: formData.get("rating") ?? undefined,
    reviewNote: formData.get("reviewNote") ?? undefined,
  })

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<ReviewInput>(parsed.error),
    }
  }

  const { resultId, action, rating, reviewNote } = parsed.data
  const admin = createAdminClient()

  const { data, error: readError } = await admin
    .from("test_results")
    .select("id, status, mission_id, tester_id, missions(title, project_id, projects(owner_id, name))")
    .eq("id", resultId)
    .maybeSingle()

  type Project = { owner_id: string; name: string | null }
  type Mission = { title: string | null; project_id: string; projects: Project | Project[] | null }
  const row = data as unknown as {
    id: string
    status: string | null
    mission_id: string
    tester_id: string
    missions: Mission | Mission[] | null
  } | null

  if (readError || !row) {
    return { success: false, error: "That submission no longer exists." }
  }

  // Re-derive ownership from the submission itself — never from the form.
  const mission = one(row.missions)
  const project = one(mission?.projects)
  if (project?.owner_id !== userId) {
    return { success: false, error: "You can only review submissions on your own projects." }
  }

  const current = toStatus(row.status)
  const next = nextStatus(current, action)

  if (next === null) {
    return { success: false, error: "This submission is already approved." }
  }

  // The approval note, or null — which also clears the note a legacy
  // changes_requested row carried.
  const patch = { status: next, rating, review_note: reviewNote, reviewed_at: new Date().toISOString() }

  // The neq is the state machine enforced on the write: two approvals racing
  // past the read above both reach here, and only one gets a row back. That
  // row is what authorises the email, so it cannot go out twice.
  const { data: approved, error: writeError } = await admin
    .from("test_results")
    .update(patch)
    .eq("id", resultId)
    .neq("status", "approved")
    .select("id")

  if (writeError) {
    console.error("[reviewSubmission] update failed:", writeError.message)
    return { success: false, error: "Could not save your review. Please try again." }
  }

  if ((approved?.length ?? 0) === 0) {
    return { success: false, error: "This submission is already approved." }
  }

  // From the action, not a webhook: an UPDATE webhook would also fire on the
  // ai_summary write every submission gets seconds after it lands. after() so
  // the builder does not wait on SMTP. The send swallows its own failures and
  // the lookup is wrapped here — the approval is saved, and nothing below may
  // turn that into an error.
  const missionTitle = mission?.title ?? "your mission"
  const projectName = project?.name ?? "the project"
  after(async () => {
    try {
      // Same lookup the submission webhook uses for the owner's address.
      const { data: tester, error } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", row.tester_id)
        .maybeSingle()
      if (error || !tester?.email) {
        console.warn("[reviewSubmission] no tester email; approval mail skipped", error?.message ?? "")
        return
      }
      await sendApprovalNotification({
        to: tester.email,
        name: tester.full_name ?? "",
        projectName,
        missionTitle,
        // reviewSchema refuses an approval without one.
        rating: rating as number,
        reviewNote,
        reportsUrl: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"}/tester`,
      })
    } catch (err) {
      console.error("[reviewSubmission] approval mail failed:", err)
    }
  })

  revalidatePath(`/dashboard/${mission?.project_id}/mission/${row.mission_id}`)
  revalidatePath("/dashboard/feedback")
  // The tester's home reads status and rating straight off this row.
  revalidatePath("/tester")

  return { success: true }
}
