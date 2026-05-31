import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendFeedbackNotification } from "@/lib/mail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Supabase Database Webhook payload shape (INSERT events).
// The webhook fires on row insert into `test_results` (Twnhall's submissions
// table). Configure it in Supabase Dashboard → Database → Webhooks with header
// `x-webhook-secret: <WEBHOOK_SECRET>`.
type WebhookPayload = {
  type?: string
  table?: string
  record?: {
    id?: string
    mission_id?: string
    tester_id?: string
    tester_comment?: string | null
    ai_summary?: string | null
  }
}

function truncate(input: string, max = 240): string {
  const s = input.trim()
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}

export async function POST(req: Request) {
  const expected = process.env.WEBHOOK_SECRET
  if (!expected) {
    console.error("[webhook/submission] WEBHOOK_SECRET not configured")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const presented = req.headers.get("x-webhook-secret")
  if (!presented || presented !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = (await req.json()) as WebhookPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (payload.type && payload.type !== "INSERT") {
    return NextResponse.json({ success: true, skipped: "not an INSERT" })
  }

  const record = payload.record
  if (!record?.id || !record.mission_id || !record.tester_id) {
    return NextResponse.json(
      { error: "Missing required fields on record" },
      { status: 400 },
    )
  }

  try {
    const admin = createAdminClient()

    const { data: mission, error: missionErr } = await admin
      .from("missions")
      .select("id, title, project_id")
      .eq("id", record.mission_id)
      .maybeSingle()
    if (missionErr) throw new Error(`mission lookup: ${missionErr.message}`)
    if (!mission) {
      console.warn("[webhook/submission] mission not found", record.mission_id)
      return NextResponse.json({ success: true, skipped: "mission missing" })
    }

    const { data: project, error: projectErr } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", mission.project_id)
      .maybeSingle()
    if (projectErr) throw new Error(`project lookup: ${projectErr.message}`)
    if (!project?.owner_id) {
      console.warn("[webhook/submission] project/owner missing", mission.project_id)
      return NextResponse.json({ success: true, skipped: "owner missing" })
    }

    const [ownerRes, testerRes, submissionRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", project.owner_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("id, full_name")
        .eq("id", record.tester_id)
        .maybeSingle(),
      admin
        .from("test_results")
        .select("id, ai_summary, tester_comment")
        .eq("id", record.id)
        .maybeSingle(),
    ])

    if (ownerRes.error) throw new Error(`owner lookup: ${ownerRes.error.message}`)
    if (testerRes.error) throw new Error(`tester lookup: ${testerRes.error.message}`)

    const ownerEmail = ownerRes.data?.email
    if (!ownerEmail) {
      console.warn("[webhook/submission] owner has no email", project.owner_id)
      return NextResponse.json({ success: true, skipped: "no owner email" })
    }

    const submission = submissionRes.data ?? {
      ai_summary: record.ai_summary ?? "",
      tester_comment: record.tester_comment ?? "",
    }
    const rawSummary =
      (submission.ai_summary && submission.ai_summary.trim()) ||
      (submission.tester_comment && submission.tester_comment.trim()) ||
      ""

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000"
    const feedbackUrl = `${baseUrl}/dashboard/${mission.project_id}/mission/${mission.id}`

    await sendFeedbackNotification({
      to: ownerEmail,
      ownerName: ownerRes.data?.full_name || "",
      testerName: testerRes.data?.full_name || "A tester",
      projectName: project.name ?? "your project",
      missionTitle: mission.title ?? "your mission",
      submissionSummary: truncate(rawSummary),
      feedbackUrl,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[webhook/submission] failed:", err)
    return NextResponse.json(
      { error: "Internal error processing webhook" },
      { status: 500 },
    )
  }
}
