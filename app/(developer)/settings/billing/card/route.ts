import { redirect } from "next/navigation"
import { requireAccount } from "@/lib/auth"
import { manageLink } from "@/lib/paystack/client"
import { createAdminClient } from "@/lib/supabase/admin"

// Settings → Plan's "Update card" (SPEC-paystack-plan-changes §5). Paystack's
// own page, where the builder changes the card or cancels; its links expire,
// so one is fetched fresh on every click and never stored or emailed. The card
// details go to Paystack, never through here.

export async function GET(): Promise<Response> {
  const { userId } = await requireAccount("builder")
  const { data: active } = await createAdminClient()
    .from("subscriptions")
    .select("provider_subscription_id")
    .eq("profile_id", userId)
    .eq("status", "active")
    .eq("source", "paystack")
    .maybeSingle()
  const link = active?.provider_subscription_id ? await manageLink(active.provider_subscription_id) : null
  if (!link?.ok || !link.data.startsWith("https://")) redirect("/settings?tab=plan&billing=card_failed")
  return new Response(null, { status: 303, headers: { Location: link.data, "Cache-Control": "no-store" } })
}
