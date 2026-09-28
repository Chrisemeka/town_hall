import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  ACCOUNT_COOKIE,
  CHOOSE_ACCOUNT_PATH,
  CONFIRM_EMAIL_PATH,
  homeFor,
  verifyPathFor,
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

type AccountRow = { type: AccountType; verification_completed_at: string | null }

/**
 * The account rows this person holds, read with the service-role client.
 *
 * Verification comes back on the same read rather than in a follow-up query —
 * this runs on every protected page render, and the caller always wants both.
 */
export async function accountRowsFor(userId: string): Promise<AccountRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("accounts")
    .select("type, verification_completed_at")
    .eq("user_id", userId)
  return (data ?? []).map((a) => ({
    type: a.type as AccountType,
    verification_completed_at: a.verification_completed_at as string | null,
  }))
}

/** Account types this person holds, read with the service-role client. */
export async function accountTypesFor(userId: string): Promise<AccountType[]> {
  return (await accountRowsFor(userId)).map((a) => a.type)
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
  /** Whether the *active* account has cleared the verification gate. */
  verified: boolean
  /**
   * Whether Supabase has seen this address proven. Read off the user rather
   * than a column of ours — auth.users.email_confirmed_at is the source of
   * truth and there is deliberately no second copy of it.
   */
  emailConfirmed: boolean
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const rows = await accountRowsFor(user.id)
  const types = rows.map((a) => a.type)
  const preferred = (await cookies()).get(ACCOUNT_COOKIE)?.value as AccountType | undefined

  const active =
    preferred && types.includes(preferred)
      ? preferred
      : types.includes("builder")
        ? "builder"
        : (types[0] ?? null)

  // Per-role: holding a verified builder account says nothing about the tester
  // account this request is acting as.
  const verified = !!rows.find((a) => a.type === active)?.verification_completed_at

  return {
    userId: user.id,
    active,
    types,
    verified,
    emailConfirmed: !!user.email_confirmed_at,
  }
}

/**
 * Identity half of the account guard: signed in, holds an account, and it is
 * the one being asked for. Deliberately not exported — the verification gate
 * below is the other half, and code that skips it should have to say so by
 * name rather than by reaching for a helper that quietly omits it.
 */
async function resolveAccountOrRedirect(type: AccountType) {
  const resolved = await getActiveAccount()
  if (!resolved) redirect("/")
  // The in-page half of the email gate, and it goes first because it is first
  // in the chain — before terms, before the account even resolves. middleware.ts
  // gates the same thing at URL level; per CLAUDE.md neither layer stands alone,
  // and this is the one that survives someone editing the matcher.
  if (!resolved.emailConfirmed) redirect(CONFIRM_EMAIL_PATH)
  if (resolved.active === null) redirect(CHOOSE_ACCOUNT_PATH)
  if (resolved.active !== type) redirect(homeFor(resolved.active))
  return resolved
}

/**
 * Page/action guard mirroring `requireAdmin()`. Middleware gates these routes
 * too, but middleware's matcher is config — this is the check that survives
 * someone editing it, and it is what server actions rely on.
 *
 * The verification gate is applied here unconditionally and has no opt-out
 * parameter: a surface that wants past it has to stop calling this function,
 * which is a visible change at the call site rather than an argument someone
 * can add without anyone noticing.
 */
export async function requireAccount(type: AccountType): Promise<{ userId: string }> {
  const resolved = await resolveAccountOrRedirect(type)
  if (!resolved.verified) redirect(verifyPathFor(type))
  return { userId: resolved.userId }
}

/**
 * Asserts the caller owns the project they are about to write to.
 *
 * This exists because the mission actions moved to the service-role client, and
 * service role bypasses RLS. Until that move, `projects` and `missions` carried
 * owner-scoped RLS policies that silently reduced a cross-tenant write to zero
 * rows — those actions never had an ownership check in code, they leaned on the
 * database for it. Moving the client without moving that check would have
 * traded a working guarantee for nothing.
 *
 * Reads with the service-role client on purpose: an anon read here would be
 * subject to the same policies being bypassed, so a project the caller cannot
 * see would look identical to one that does not exist, and the guard would
 * throw the wrong reason.
 *
 * Throws rather than returning a result. Every caller treats "not yours" as
 * unreachable rather than as a form error, and a thrown error cannot be
 * accidentally ignored the way a returned one can.
 */
export async function requireProjectOwner(projectId: string, userId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: project, error } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!project) throw new Error("Project not found")
  if (project.owner_id !== userId) throw new Error("Not authorized")
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
): Promise<{ userId: string; verified: boolean }> {
  const resolved = await resolveAccountOrRedirect(type)
  // `verified` is returned rather than acted on: the verify page needs it to
  // bounce someone who is already through (the in-page half of that check), and
  // it is already loaded here, so asking for it again would be a second query.
  return { userId: resolved.userId, verified: resolved.verified }
}
