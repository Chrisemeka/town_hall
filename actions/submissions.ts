"use server"

import { createClient } from "@/lib/supabase/server"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import { revalidatePath } from "next/cache"

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

  const projectOwnerId = Array.isArray(mission?.projects) 
    ? mission.projects[0]?.owner_id 
    : mission?.projects?.owner_id;

  if (projectOwnerId === user.id) {
    return { success: false, error: "Developers cannot submit a test for your own project." };
  }

  // 3. Upload to Supabase Storage
  const fileName = `${user.id}/${Date.now()}-${file.name}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("screenshots")
    .upload(fileName, file)

  if (uploadError) throw new Error("Upload failed")

  // Get the Public URL for Gemini to "see"
  const { data: { publicUrl } } = supabase.storage
    .from("screenshots")
    .getPublicUrl(fileName)

  // 4. Call Gemini 1.5 Flash for Vision Analysis
  const { text } = await generateText({
    model: google("gemini-3-flash-preview"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `You are an expert QA Engineer. Analyze this screenshot based on the user's comment: "${comment}". 
          Provide a concise, jargon-free summary of 2-3 bullet points highlighting key observations: obvious bugs, UX friction, or positive aspects. Be direct and easy for a developer to read at a glance.
          Also, categorize the user's sentiment as one word ONLY at the very end of your response: POSITIVE, NEUTRAL, or FRUSTRATED.` },
          { type: "image", image: publicUrl },
        ],
      },
    ],
  })

  // 5. Save to Database
  const sentiment = text.includes("FRUSTRATED") ? "FRUSTRATED" : text.includes("POSITIVE") ? "POSITIVE" : "NEUTRAL"
  
  const { error: dbError } = await supabase.from("test_results").insert({
    mission_id: missionId,
    tester_id: user.id,
    screenshot_url: publicUrl,
    tester_comment: comment,
    ai_summary: text.replace(sentiment, "").replace(/[*#]/g, "").trim(), // Remove the sentiment word and markdown formatting from summary
    ai_sentiment: sentiment,
  })

  if (dbError) throw new Error(dbError.message)

  revalidatePath("/dashboard")
  return { success: true }
}