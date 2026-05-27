import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { AppShell } from "./AppShell"

export async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let avatarUrl: string | null = null
  let displayName: string | null = null
  let seenTours: string[] = []

  if (user) {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("avatar_url, full_name, seen_tours")
      .eq("id", user.id)
      .maybeSingle()

    avatarUrl =
      (profile?.avatar_url as string | null) ??
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined) ??
      null

    displayName =
      (profile?.full_name as string | null) ??
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      null

    seenTours = (profile?.seen_tours as string[] | null) ?? []
  }

  return (
    <AppShell avatarUrl={avatarUrl} displayName={displayName} seenTours={seenTours}>
      {children}
    </AppShell>
  )
}
