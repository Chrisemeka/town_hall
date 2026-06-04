"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"

export async function flagProject(projectId: string, reason: string) {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new Error("Flag reason must be at least 3 characters.")
  if (trimmed.length > 500) throw new Error("Flag reason must be 500 characters or fewer.")

  const { admin, adminUserId } = await requireAdmin()
  const { error } = await admin
    .from("projects")
    .update({
      flagged_at: new Date().toISOString(),
      flag_reason: trimmed,
      flagged_by: adminUserId,
    })
    .eq("id", projectId)
  if (error) throw new Error(error.message)

  revalidatePath("/admin/projects")
  revalidatePath("/explore")
  revalidatePath("/explore/missions")
  revalidatePath(`/dashboard/${projectId}`)
}

export async function unflagProject(projectId: string) {
  const { admin } = await requireAdmin()
  const { error } = await admin
    .from("projects")
    .update({ flagged_at: null, flag_reason: null, flagged_by: null })
    .eq("id", projectId)
  if (error) throw new Error(error.message)

  revalidatePath("/admin/projects")
  revalidatePath("/explore")
  revalidatePath("/explore/missions")
  revalidatePath(`/dashboard/${projectId}`)
}

function storagePathFromPublicUrl(url: string): string | null {
  const marker = "/screenshots/"
  const i = url.indexOf(marker)
  if (i === -1) return null
  return url.slice(i + marker.length)
}

export async function removeProject(projectId: string) {
  const { admin } = await requireAdmin()

  const { data: missions } = await admin
    .from("missions")
    .select("id")
    .eq("project_id", projectId)

  const missionIds = (missions ?? []).map((m: { id: string }) => m.id)

  // Collect screenshot URLs from every test_result we're about to delete,
  // so we can clean Storage after the cascade succeeds.
  let screenshotPaths: string[] = []
  if (missionIds.length > 0) {
    const { data: results, error: fetchErr } = await admin
      .from("test_results")
      .select("screenshot_url")
      .in("mission_id", missionIds)
    if (fetchErr) throw new Error(fetchErr.message)

    screenshotPaths = (results ?? [])
      .map((r: { screenshot_url: string | null }) =>
        r.screenshot_url ? storagePathFromPublicUrl(r.screenshot_url) : null,
      )
      .filter((p): p is string => !!p)

    const { error: trErr } = await admin.from("test_results").delete().in("mission_id", missionIds)
    if (trErr) throw new Error(trErr.message)
    const { error: misErr } = await admin.from("missions").delete().eq("project_id", projectId)
    if (misErr) throw new Error(misErr.message)
  }

  const { error } = await admin.from("projects").delete().eq("id", projectId)
  if (error) throw new Error(error.message)

  // Best-effort Storage cleanup. If this fails, the DB is already consistent —
  // we log but don't roll back, because a stale file is the lesser evil.
  if (screenshotPaths.length > 0) {
    const { error: storageErr } = await admin.storage.from("screenshots").remove(screenshotPaths)
    if (storageErr) {
      console.error("[removeProject] storage cleanup failed:", storageErr.message)
    }
  }

  revalidatePath("/admin/projects")
  revalidatePath("/admin")
  revalidatePath("/admin/missions")
  revalidatePath("/admin/submissions")
  revalidatePath("/admin/ai-reports")
  revalidatePath("/explore")
  revalidatePath("/explore/missions")
}
