"use server"

import { createClient, uploadToStorage, getPublicUrl } from "@/lib/supabase/server"
import { generateAnalysis, parseSentiment } from "@/lib/ai"
import { revalidatePath } from "next/cache"
import { getOwnerId } from "@/lib/utils/project";


export async function submitTestResult(formData: FormData) {
  const supabase = await createClient()
  
  // 1. Get User and Form Data
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const missionId = formData.get("missionId") as string
  const comment = formData.get("comment") as string
  const file = formData.get("screenshot") as File

  // 2. Check if the user is trying to submit a test for their own project
  const { data: missionData, error: missionError } = await supabase
  .from("missions")
  .select(`
    project_id,
    projects (
      owner_id
    )
  `)
  .eq("id", missionId)
  .single();

  const mission = missionData as any; 

  const projectOwnerId = getOwnerId(mission?.projects);

  if (projectOwnerId === user.id) {
    return { success: false, error: "Developers cannot submit a test for your own project." };
  }

  const uploadData = await uploadToStorage(supabase, file, user.id);

  const publicUrl = getPublicUrl(supabase, uploadData.path);
  
  const { text } = await generateAnalysis(comment, publicUrl)

  const sentiment = parseSentiment(text)

  const { error: dbError } = await supabase.from("test_results").insert({
    mission_id: missionId,
    tester_id: user.id,
    screenshot_url: publicUrl,
    tester_comment: comment,
    ai_summary: text.replace(sentiment, "").replace(/[*#]/g, "").trim(), 
    ai_sentiment: sentiment,
  })

  if (dbError) throw new Error(dbError.message)

  revalidatePath("/dashboard")
  return { success: true }
}