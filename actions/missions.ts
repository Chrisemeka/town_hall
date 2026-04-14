"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createMission(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const projectId = formData.get("projectId") as string
  const title = formData.get("title") as string
  const task_description = formData.get("task_description") as string

  const { data, error } = await supabase
    .from("missions")
    .insert({
      project_id: projectId,
      title,
      task_description,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/${projectId}`)
  redirect(`/dashboard/${projectId}`)
}

export async function toggleMissionStatus(missionId: string, projectId: string, newStatus: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase
    .from("missions")
    .update({ is_active: newStatus })
    .eq("id", missionId)

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/${projectId}`)
  revalidatePath(`/dashboard/${projectId}/mission/${missionId}`)
  revalidatePath(`/explore`)
}