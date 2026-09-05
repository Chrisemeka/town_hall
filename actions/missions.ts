"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAccount, requireProjectOwner } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  createMissionSchema,
  updateMissionSchema,
  toCents,
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

  // Mission authoring is Builder-only. This stops a Tester account authoring
  // against a project the same person happens to own from their Builder side.
  await requireAccount("builder")

  const parsed = createMissionSchema.safeParse({
    projectId: formData.get("projectId"),
    template_id: formData.get("template_id") ?? undefined,
    title: formData.get("title"),
    task_description: formData.get("task_description"),
    intent: formData.get("intent"),
    payout: formData.get("payout"),
    category: formData.get("category"),
    device_target: formData.get("device_target"),
    test_steps: formData.get("test_steps"),
  })

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<CreateMissionInput>(parsed.error),
    }
  }

  const { projectId, template_id, title, task_description, intent, payout, category, device_target, test_steps } =
    parsed.data
  const is_active = intent === "publish"

  // Service role bypasses RLS, so ownership is checked here rather than by the
  // database. See requireProjectOwner() for why the move was made.
  await requireProjectOwner(projectId, user.id)

  const { error } = await createAdminClient()
    .from("missions")
    .insert({
      project_id: projectId,
      title,
      task_description,
      is_active,
      payout_cents: toCents(payout),
      category,
      device_target,
      test_steps,
      template_id,
    })
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

  await requireAccount("builder")

  const parsed = updateMissionSchema.safeParse({
    missionId: formData.get("missionId"),
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    task_description: formData.get("task_description"),
    intent: formData.get("intent"),
    payout: formData.get("payout"),
    category: formData.get("category"),
    device_target: formData.get("device_target"),
    test_steps: formData.get("test_steps"),
  })

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<UpdateMissionInput>(parsed.error),
    }
  }

  const { missionId, projectId, title, task_description, intent, payout, category, device_target, test_steps } =
    parsed.data
  const is_active = intent === "publish"

  await requireProjectOwner(projectId, user.id)

  // Explicit column list, and template_id is not in it: provenance is set once
  // at creation and an edit must not rewrite where a mission came from.
  const { error } = await createAdminClient()
    .from("missions")
    .update({
      title,
      task_description,
      is_active,
      payout_cents: toCents(payout),
      category,
      device_target,
      test_steps,
    })
    .eq("id", missionId)
    // Belt and braces with requireProjectOwner: the guard proves the caller owns
    // projectId, this proves the mission being written belongs to that project.
    .eq("project_id", projectId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${projectId}`)
  revalidatePath(`/dashboard/${projectId}/mission/${missionId}`)
  redirect(`/dashboard/${projectId}/mission/${missionId}`)
}

export async function deleteMission(missionId: string, projectId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  await requireAccount("builder")
  await requireProjectOwner(projectId, user.id)

  const { error } = await createAdminClient()
    .from("missions")
    .delete()
    .eq("id", missionId)
    .eq("project_id", projectId)

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

  await requireAccount("builder")
  await requireProjectOwner(projectId, user.id)

  const { error } = await createAdminClient()
    .from("missions")
    .update({ is_active: newStatus })
    .eq("id", missionId)
    .eq("project_id", projectId)

  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/${projectId}`)
  revalidatePath(`/dashboard/${projectId}/mission/${missionId}`)
  revalidatePath(`/explore`)
}
