"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendAdminBroadcast } from "@/lib/mail"

const broadcastSchema = z
  .object({
    subject: z.string().trim().min(3, "Subject must be at least 3 characters.").max(150),
    messageBody: z.string().trim().min(10, "Message must be at least 10 characters.").max(5000),
    ctaLabel: z.string().trim().max(40).optional().or(z.literal("")),
    ctaUrl: z
      .string()
      .trim()
      .url("CTA URL must be a valid URL.")
      .optional()
      .or(z.literal("")),
    targetType: z.enum(["all", "single"]),
    targetEmail: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  })
  .refine(
    (data) => data.targetType !== "single" || !!data.targetEmail,
    { message: "Recipient email is required.", path: ["targetEmail"] },
  )
  .refine(
    (data) => {
      const hasLabel = !!(data.ctaLabel && data.ctaLabel.length)
      const hasUrl = !!(data.ctaUrl && data.ctaUrl.length)
      return hasLabel === hasUrl
    },
    { message: "Provide both a CTA label and URL, or leave both empty.", path: ["ctaUrl"] },
  )

export type BroadcastInput = z.input<typeof broadcastSchema>

export type BroadcastResult =
  | { success: true; count: number }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") throw new Error("Not authorized")
  return { admin, adminUser: user }
}

export async function broadcastAdminEmail(input: BroadcastInput): Promise<BroadcastResult> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    ({ admin } = await requireAdmin())
  } catch (err) {
    return { success: false, error: (err as Error).message ?? "Unauthorized" }
  }

  const parsed = broadcastSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }

  const { subject, messageBody, ctaLabel, ctaUrl, targetType, targetEmail } = parsed.data

  type Recipient = { email: string; fullName: string }
  let recipients: Recipient[] = []

  if (targetType === "single") {
    const email = (targetEmail ?? "").trim()
    if (!email) return { success: false, error: "Recipient email is required." }

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .ilike("email", email)
      .maybeSingle()

    recipients = [{ email, fullName: profile?.full_name ?? "" }]
  } else {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("email, full_name")
      .not("email", "is", null)
    if (error) return { success: false, error: error.message }

    const seen = new Set<string>()
    for (const p of profiles ?? []) {
      const email = (p as { email: string | null }).email
      if (!email) continue
      const key = email.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      recipients.push({ email, fullName: (p as { full_name: string | null }).full_name ?? "" })
    }
  }

  if (recipients.length === 0) {
    return { success: false, error: "No recipients found." }
  }

  // Group by personalised greeting. Single-user always sends one personalised
  // mail; "all users" send personalised when a full_name exists, otherwise
  // batch under a shared "there" greeting.
  const groups = new Map<string, string[]>()
  for (const r of recipients) {
    const greeting = r.fullName?.trim() || "there"
    const list = groups.get(greeting) ?? []
    list.push(r.email)
    groups.set(greeting, list)
  }

  const cleanLabel = ctaLabel?.trim() ? ctaLabel.trim() : undefined
  const cleanUrl = ctaUrl?.trim() ? ctaUrl.trim() : undefined

  let totalSent = 0
  for (const [greeting, emails] of groups) {
    const { sent } = await sendAdminBroadcast({
      to: emails,
      recipientName: greeting,
      subject,
      messageBody,
      ctaLabel: cleanLabel,
      ctaUrl: cleanUrl,
    })
    totalSent += sent
  }

  return { success: true, count: totalSent }
}
