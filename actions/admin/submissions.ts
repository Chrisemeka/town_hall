"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { storagePathsFor } from "@/lib/utils/screenshots"

export async function deleteSubmission(submissionId: string) {
  const { admin } = await requireAdmin()

  const { data: submission, error: fetchErr } = await admin
    .from("test_results")
    .select("id, screenshot_url, screenshot_urls, mission_id")
    .eq("id", submissionId)
    .maybeSingle()

  if (fetchErr) throw new Error(fetchErr.message)
  if (!submission) throw new Error("Submission not found")

  const { error: delErr } = await admin
    .from("test_results")
    .delete()
    .eq("id", submissionId)
  if (delErr) throw new Error(delErr.message)

  const paths = storagePathsFor([submission])
  if (paths.length > 0) {
    const { error: storageErr } = await admin.storage.from("screenshots").remove(paths)
    if (storageErr) {
      console.error("[deleteSubmission] storage cleanup failed:", storageErr.message)
    }
  }

  revalidatePath("/admin/submissions")
  revalidatePath("/admin/missions")
  if (submission.mission_id) {
    revalidatePath(`/admin/missions/${submission.mission_id}`)
  }
}
