import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAccount } from "@/lib/auth"
import { CHOOSE_ACCOUNT_PATH, homeFor } from "@/lib/access"
import { AdminTopNav } from "@/components/admin/AdminTopNav"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") {
    // Bounce a non-admin to their own account's home — /explore is tester-only
    // now, so sending a Builder there would just bounce again.
    const resolved = await getActiveAccount()
    redirect(resolved?.active ? homeFor(resolved.active) : CHOOSE_ACCOUNT_PATH)
  }

  return (
    <div className="min-h-screen bg-obsidian text-chalk">
      <AdminTopNav />
      <main className="pt-[56px] min-h-screen w-full min-w-0 overflow-x-hidden">{children}</main>
    </div>
  )
}
