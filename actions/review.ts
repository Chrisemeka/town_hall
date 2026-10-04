"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
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
  })

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<ReviewInput>(parsed.error),
    }
  }

  const { resultId, action, rating } = parsed.data
  const admin = createAdminClient()

  const { data, error: readError } = await admin
    .from("test_results")
    .select("id, status, mission_id, missions(project_id, projects(owner_id))")
    .eq("id", resultId)
    .maybeSingle()

  const row = data as unknown as {
    id: string
    status: string | null
    mission_id: string
    missions:
      | { project_id: string; projects: { owner_id: string } | { owner_id: string }[] | null }
      | { project_id: string; projects: { owner_id: string } | { owner_id: string }[] | null }[]
      | null
  } | null

  if (readError || !row) {
    return { success: false, error: "That submission no longer exists." }
  }

  // Re-derive ownership from the submission itself — never from the form.
  const mission = one(row.missions)
  if (one(mission?.projects)?.owner_id !== userId) {
    return { success: false, error: "You can only review submissions on your own projects." }
  }

  const current = toStatus(row.status)
  const next = nextStatus(current, action)

  if (next === null) {
    return { success: false, error: "This submission is already approved." }
  }

  // review_note is cleared, not dropped: legacy changes_requested rows carry one.
  const patch = { status: next, rating, review_note: null, reviewed_at: new Date().toISOString() }

  const { error: writeError } = await admin
    .from("test_results")
    .update(patch)
    .eq("id", resultId)

  if (writeError) {
    console.error("[reviewSubmission] update failed:", writeError.message)
    return { success: false, error: "Could not save your review. Please try again." }
  }

  revalidatePath(`/dashboard/${mission?.project_id}/mission/${row.mission_id}`)
  revalidatePath("/dashboard/feedback")
  // The tester's home reads status and rating straight off this row.
  revalidatePath("/tester")

  return { success: true }
}
