import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Asserts that the current session belongs to an admin.
 *
 * Identity is re-derived from the session cookie (never trusted from the
 * client) and the `role` is read with the service-role client so RLS on
 * `profiles` can't interfere. Throws "Not authenticated" / "Not authorized"
 * on failure — callers either let it propagate or convert it to a result.
 *
 * Returns the service-role `admin` client plus the admin's `user` and a
 * convenience `adminUserId` for the common case of attributing a write.
 */
export async function requireAdmin() {
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
  return { admin, user, adminUserId: user.id }
}
