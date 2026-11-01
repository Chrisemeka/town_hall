"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireAccount } from "@/lib/auth"
import { renderedAtSchema } from "@/lib/validation/schemas"

/**
 * Clears the Available Test Cases counter up to when the page was rendered —
 * not clicked: anything published between the render and the mount stays new,
 * because the tester has not seen it. Called on mount by MarkMissionsSeen,
 * never during the page render, which a link prefetch can trigger for a page
 * nobody opened.
 *
 * Only ever forward, and never past now: a client claiming a future time is
 * clamped. The conditional update makes "forward only" atomic without an RPC.
 */
export async function markMissionsSeen(renderedAt: string): Promise<void> {
  const { userId } = await requireAccount("tester")
  const parsed = renderedAtSchema.safeParse(renderedAt)
  if (!parsed.success) return

  const at = new Date(Math.min(Date.parse(parsed.data), Date.now())).toISOString()
  const { error } = await createAdminClient()
    .from("accounts")
    .update({ missions_seen_at: at })
    .eq("user_id", userId)
    .eq("type", "tester")
    .lt("missions_seen_at", at)
  if (error) console.error("[markMissionsSeen] update failed:", error.message)
}
