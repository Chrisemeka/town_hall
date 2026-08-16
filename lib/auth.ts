import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  ACCOUNT_COOKIE,
  CHOOSE_ACCOUNT_PATH,
  homeFor,
  type AccountType,
} from "@/lib/access"

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

/** Account types this person holds, read with the service-role client. */
export async function accountTypesFor(userId: string): Promise<AccountType[]> {
  const admin = createAdminClient()
  const { data } = await admin.from("accounts").select("type").eq("user_id", userId)
  return (data ?? []).map((a) => a.type as AccountType)
}

/**
 * Resolves which account the current request is acting as.
 *
 * The `th_account` cookie is a *preference*, never an authority — it is
 * unsigned, so it is intersected with the account rows that actually exist
 * before it is believed. A forged cookie resolves to a real account the user
 * holds, or to null.
 */
export async function getActiveAccount(): Promise<{
  userId: string
  active: AccountType | null
  types: AccountType[]
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const types = await accountTypesFor(user.id)
  const preferred = (await cookies()).get(ACCOUNT_COOKIE)?.value as AccountType | undefined

  const active =
    preferred && types.includes(preferred)
      ? preferred
      : types.includes("builder")
        ? "builder"
        : (types[0] ?? null)

  return { userId: user.id, active, types }
}

/**
 * Identity half of the account guard: signed in, holds an account, and it is
 * the one being asked for. Deliberately not exported — the verification gate
 * below is the other half, and code that skips it should have to say so by
 * name rather than by reaching for a helper that quietly omits it.
 */
async function resolveAccountOrRedirect(type: AccountType): Promise<{ userId: string }> {
  const resolved = await getActiveAccount()
  if (!resolved) redirect("/")
  if (resolved.active === null) redirect(CHOOSE_ACCOUNT_PATH)
  if (resolved.active !== type) redirect(homeFor(resolved.active))
  return { userId: resolved.userId }
}

/**
 * Page/action guard mirroring `requireAdmin()`. Middleware gates these routes
 * too, but middleware's matcher is config — this is the check that survives
 * someone editing it, and it is what server actions rely on.
 */
export async function requireAccount(type: AccountType): Promise<{ userId: string }> {
  return resolveAccountOrRedirect(type)
}

/**
 * `requireAccount()` minus the verification gate. This is NOT a bug, and it is
 * not a general-purpose escape hatch.
 *
 * The verification actions run *inside* /verify/[role]. Once `requireAccount()`
 * gains its gate (it redirects an unverified account to /verify/[role]), those
 * actions calling it would redirect the user to the page they are already on,
 * forever — the flow could never save a step, so the account could never become
 * verified, so the redirect could never stop. Something has to run before the
 * gate opens, and this is the only thing allowed to.
 *
 * Everything else goes through `requireAccount()`. If a new caller appears
 * here, the question to ask is why that surface runs before verification —
 * almost always the answer is that it shouldn't.
 */
export async function requireAccountForVerification(
  type: AccountType,
): Promise<{ userId: string }> {
  return resolveAccountOrRedirect(type)
}
