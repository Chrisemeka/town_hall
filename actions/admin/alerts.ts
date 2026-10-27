"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { ALERT_RULE_KEYS } from "@/lib/alerts/rules"

// Acknowledge, resolve, and the rule settings. Acknowledging stops the
// reminder emails without pretending the condition cleared; the next run
// resolves an alert by itself once it has. Resolving by hand is for an alert
// whose fix the next run cannot see yet.

const id = z.string().uuid()

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const { admin, adminUserId } = await requireAdmin()
  const parsed = id.parse(alertId)
  const { error } = await admin
    .from("alerts")
    .update({ status: "acknowledged", acknowledged_by: adminUserId, acknowledged_at: new Date().toISOString() })
    .eq("id", parsed)
    .eq("status", "open")
  if (error) throw new Error(error.message)
  revalidatePath("/admin", "layout")
}

export async function resolveAlert(alertId: string): Promise<void> {
  const { admin } = await requireAdmin()
  const parsed = id.parse(alertId)
  const { error } = await admin
    .from("alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", parsed)
    .neq("status", "resolved")
  if (error) throw new Error(error.message)
  revalidatePath("/admin", "layout")
}

const ruleSchema = z.object({
  key: z.enum(ALERT_RULE_KEYS),
  enabled: z.boolean(),
  email: z.boolean(),
  threshold: z.coerce.number().min(0).max(100_000_000),
  cooldown_minutes: z.coerce.number().int().min(10).max(60 * 24 * 30),
})

/** A plain form post from the Rules tab: checkboxes arrive as "on" or not at all. */
export async function updateAlertRule(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin()
  const parsed = ruleSchema.parse({
    key: formData.get("key"),
    enabled: formData.get("enabled") === "on",
    email: formData.get("email") === "on",
    threshold: formData.get("threshold"),
    cooldown_minutes: formData.get("cooldown_minutes"),
  })
  const { key, ...patch } = parsed
  const { error } = await admin.from("alert_rules").update(patch).eq("key", key)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/alerts")
}
