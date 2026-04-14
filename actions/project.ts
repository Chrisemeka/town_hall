"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createProject(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const app_url = formData.get("app_url") as string

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