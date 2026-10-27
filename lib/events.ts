import "server-only"

// In-app activity the database records nowhere else. Spec:
// docs/specs/SPEC-admin-revamp.md, Phase 0.
//
// Only what no row already records. Signups, gates, projects, publishes,
// reports and reviews all carry their own timestamps and are READ, never
// duplicated here — a second copy is a second thing to disagree.
//
// Same contract as recordAiUsage(): a side effect that can never cost the
// request it describes. recordEvent swallows everything and returns void.

import { after } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

export const EVENT_NAMES = [
  "auth.login",
  "auth.logout",
  "auth.password_reset_requested",
  "account.switched",
  "allowance.capped",
  "allowance.refused",
  "allowance.missed_credit",
  "export.csv",
  "export.pdf",
  "rate_limit.hit",
  "rate_limit.store_degraded",
  "email.sent",
  "email.failed",
  "error.server",
  "plan.changed",
] as const

export type EventName = (typeof EVENT_NAMES)[number]

const eventSchema = z.object({
  name: z.enum(EVENT_NAMES),
  profileId: z.string().uuid().nullish(),
  accountType: z.enum(["builder", "tester"]).nullish(),
  subjectType: z.string().max(40).nullish(),
  subjectId: z.string().uuid().nullish(),
  props: z.record(z.string(), z.unknown()).optional(),
})

export type AppEvent = z.input<typeof eventSchema>

/** Writes one app_events row. Never throws. */
export async function recordEvent(event: AppEvent): Promise<void> {
  try {
    const parsed = eventSchema.safeParse(event)
    if (!parsed.success) {
      console.error("[recordEvent] refused:", event.name, parsed.error.issues[0]?.message)
      return
    }
    const e = parsed.data
    const { error } = await createAdminClient()
      .from("app_events")
      .insert({
        name: e.name,
        profile_id: e.profileId ?? null,
        account_type: e.accountType ?? null,
        subject_type: e.subjectType ?? null,
        subject_id: e.subjectId ?? null,
        props: e.props ?? {},
      })
    if (error) console.error("[recordEvent] insert failed:", e.name, error.message)
  } catch (err) {
    console.error("[recordEvent] unexpected error:", err)
  }
}

/**
 * recordEvent after the response, so the user never waits on it. Outside a
 * request (a test, a script) after() throws, and the write runs unawaited.
 */
export function recordEventLater(event: AppEvent): void {
  try {
    after(() => recordEvent(event))
  } catch {
    void recordEvent(event)
  }
}
