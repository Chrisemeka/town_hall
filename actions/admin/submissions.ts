"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"

function storagePathFromPublicUrl(url: string): string | null {
  const marker = "/screenshots/"
  const i = url.indexOf(marker)
  if (i === -1) return null
  return url.slice(i + marker.length)
}

export async function deleteSubmission(submissionId: string) {
  const { admin } = await requireAdmin()

  const { data: submission, error: fetchErr } = await admin
    .from("test_results")
    .select("id, screenshot_url, mission_id")
    .eq("id", submissionId)
    .maybeSingle()

  if (fetchErr) throw new Error(fetchErr.message)
  if (!submission) throw new Error("Submission not found")

  const { error: delErr } = await admin
    .from("test_results")
    .delete()
    .eq("id", submissionId)
  if (delErr) throw new Error(delErr.message)

  if (submission.screenshot_url) {
    const path = storagePathFromPublicUrl(submission.screenshot_url)
    if (path) {
      const { error: storageErr } = await admin.storage.from("screenshots").remove([path])
      if (storageErr) {
        console.error("[deleteSubmission] storage cleanup failed:", storageErr.message)
      }
    }
  }

  revalidatePath("/admin/submissions")
  revalidatePath("/admin/missions")
  if (submission.mission_id) {
    revalidatePath(`/admin/missions/${submission.mission_id}`)
  }
}
