import "server-only"

import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendNotice } from "@/lib/mail"

// ponytail: the NEXT_PUBLIC_APP_URL pattern the cron and the admin actions use.
export const site = () => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"

/** Runs after the response where there is one; a cron or a test just awaits nothing. */
export function later(fn: () => Promise<unknown>): void {
  try {
    after(() => fn().then(() => undefined))
  } catch {
    void fn()
  }
}

/** One email to a builder about their subscription, after the response. Never throws. */
export function emailBuilder(profileId: string, template: string, notice: { subject: string; body: string }): void {
  later(async () => {
    const { data: who } = await createAdminClient().from("profiles").select("full_name, email").eq("id", profileId).maybeSingle()
    if (!who?.email) return
    await sendNotice({
      to: who.email,
      template,
      recipientName: (who.full_name ?? "").split(/\s+/)[0] ?? "",
      subject: notice.subject,
      messageBody: notice.body,
      ctaLabel: "See your plan",
      ctaUrl: `${site()}/settings?tab=plan`,
    })
  })
}
