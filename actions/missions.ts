"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  createMissionSchema,
  updateMissionSchema,
  toFieldErrors,
  type CreateMissionInput,
  type UpdateMissionInput,
  type FieldErrors,
} from "@/lib/validation/schemas"

export type CreateMissionState =
  | null
  | {
      error?: string
      fieldErrors?: FieldErrors<CreateMissionInput>
    }

export type UpdateMissionState =
  | null
  | {
      error?: string
      fieldErrors?: FieldErrors<UpdateMissionInput>
    }

export async function createMission(
  _prevState: CreateMissionState,
  formData: FormData,
): Promise<CreateMissionState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const parsed = createMissionSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    task_description: formData.get("task_description"),
    intent: formData.get("intent"),
  })

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<CreateMissionInput>(parsed.error),
    }
  }

  const { projectId, title, task_description, intent } = parsed.data
  const is_active = intent === "publish"

  const { error } = await supabase
    .from("missions")
    .insert({ project_id: projectId, title, task_description, is_active })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${projectId}`)
  redirect(`/dashboard/${projectId}`)
}

export async function updateMission(
  _prevState: UpdateMissionState,
  formData: FormData,
): Promise<UpdateMissionState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const parsed = updateMissionSchema.safeParse({
    missionId: formData.get("missionId"),
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    task_description: formData.get("task_description"),
    intent: formData.get("intent"),
  })

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<UpdateMissionInput>(parsed.error),
    }
  }

  const { missionId, projectId, title, task_description, intent } = parsed.data
  const is_active = intent === "publish"

  const { error } = await supabase
    .from("missions")
    .update({ title, task_description, is_active })
    .eq("id", missionId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${projectId}`)
  revalidatePath(`/dashboard/${projectId}/mission/${missionId}`)
  redirect(`/dashboard/${projectId}/mission/${missionId}`)
}

export async function deleteMission(missionId: string, projectId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase
    .from("missions")
    .delete()
    .eq("id", missionId)

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/${projectId}`)
  // Redirect server-side so the now-deleted mission page never re-renders
  // (which would otherwise flash the 404/not-found UI before the client navigates).
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
