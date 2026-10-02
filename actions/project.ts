"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAccount, requireProjectOwner } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { checkRateLimit } from "@/lib/rateLimitDb"
import { tooManyMessage } from "@/lib/rateLimit"
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

  // Submitting a project is Builder-only. No try/catch wraps this action, so a
  // redirect out to the tester's home is safe here.
  await requireAccount("builder")

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    app_url: formData.get("app_url"),
    description: formData.get("description"),
    category: formData.get("category"),
  })

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<ProjectInput>(parsed.error),
    }
  }

  const { name, app_url, description, category } = parsed.data

  const rate = await checkRateLimit(["project:account", user.id])
  if (!rate.ok) return { error: tooManyMessage(rate.retryAfter) }

  // Service role, with owner_id pinned to the caller: there is no existing row
  // to check ownership against on a create, so the guarantee is that a builder
  // can only ever create a project owned by themselves.
  const { data, error } = await createAdminClient()
    .from("projects")
    .insert({
      name,
      description,
      app_url,
      category,
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

  await requireAccount("builder")

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    app_url: formData.get("app_url"),
    description: formData.get("description"),
    category: formData.get("category"),
  })

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<ProjectInput>(parsed.error),
    }
  }

  const { name, app_url, description, category } = parsed.data

  // Service role bypasses RLS, so ownership is checked here rather than by the
  // database. Until this moved, updateProject had no ownership check in code at
  // all — an owner-scoped RLS policy silently reduced a foreign write to zero
  // rows, and that policy is what this branch removes.
  await requireProjectOwner(projectId, user.id)

  const { error } = await createAdminClient()
    .from("projects")
    .update({ name, app_url, description, category })
    .eq("id", projectId)
    .eq("owner_id", user.id)

  if (error) {
    console.error("Error updating project:", error.message)
    return { error: error.message }
  }

  revalidatePath(`/dashboard/${projectId}`)
  redirect(`/dashboard/${projectId}`)
}
