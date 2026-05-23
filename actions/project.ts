"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  projectSchema,
  toFieldErrors,
  type ProjectInput,
  type FieldErrors,
} from "@/lib/validation/schemas"

export type ProjectActionState =
  | null
  | {
      error?: string
      fieldErrors?: FieldErrors<ProjectInput>
    }

export async function createProject(
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    app_url: formData.get("app_url"),
    description: formData.get("description"),
  })

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<ProjectInput>(parsed.error),
    }
  }

  const { name, app_url, description } = parsed.data

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      description,
      app_url,
      owner_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating project:", error.message)
    return { error: error.message }
  }

  revalidatePath("/dashboard")
  redirect(`/dashboard/${data.id}`)
}

export async function updateProject(
  projectId: string,
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    app_url: formData.get("app_url"),
    description: formData.get("description"),
  })

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<ProjectInput>(parsed.error),
    }
  }

  const { name, app_url, description } = parsed.data

  const { error } = await supabase
    .from("projects")
    .update({ name, app_url, description })
    .eq("id", projectId)

  if (error) {
    console.error("Error updating project:", error.message)
    return { error: error.message }
  }

  revalidatePath(`/dashboard/${projectId}`)
  redirect(`/dashboard/${projectId}`)
}
