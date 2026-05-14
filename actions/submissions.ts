"use server"

import { createClient, uploadToStorage, getPublicUrl } from "@/lib/supabase/server"
import { generateAnalysis, parseSentiment } from "@/lib/ai"
import { revalidatePath } from "next/cache"
import { getOwnerId } from "@/lib/utils/project";


export async function submitTestResult(formData: FormData) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "You must be logged in to submit feedback." }

    const missionId = formData.get("missionId") as string
    const comment = formData.get("comment") as string
    const file = formData.get("screenshot") as File

    const { data: missionData } = await supabase
      .from("missions")
      .select(`
        project_id,
        projects (
          owner_id
        )
      `)
      .eq("id", missionId)
      .single()

    const mission = missionData as any

    const projectOwnerId = getOwnerId(mission?.projects)
    if (projectOwnerId === user.id) {
      return { success: false, error: "Developers cannot submit a test for your own project." }
    }

    const uploadData = await uploadToStorage(supabase, file, user.id)
    const publicUrl = getPublicUrl(supabase, uploadData.path)

    let aiSummary = ""
    let sentiment: "POSITIVE" | "NEUTRAL" | "FRUSTRATED" = "NEUTRAL"
    try {
      const { text } = await generateAnalysis(comment, publicUrl)
      sentiment = parseSentiment(text)
      aiSummary = text.replace(sentiment, "").replace(/[*#]/g, "").trim()
    } catch {
      // AI analysis is non-critical — proceed without it
    }

    const { error: dbError } = await supabase.from("test_results").insert({
      mission_id: missionId,
      tester_id: user.id,
      screenshot_url: publicUrl,
      tester_comment: comment,
      ai_summary: aiSummary,
      ai_sentiment: sentiment,
    })

    if (dbError) return { success: false, error: "Failed to save your feedback. Please try again." }

    revalidatePath("/dashboard")
    revalidatePath("/explore")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? "An unexpected error occurred. Please try again." }
  }
}