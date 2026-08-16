// Role-based route gating for the Builder / Tester account split.
//
// Kept as a pure function with no imports so middleware, server components, and
// scripts/access.test.mts all reach the same decision from the same code. This
// is access control, not UI routing — if it disagrees with itself in two places
// that is a hole, so there is only one place.

export type AccountType = "builder" | "tester"

export const CHOOSE_ACCOUNT_PATH = "/choose-account"
export const ACCOUNT_COOKIE = "th_account"

/** Builder-only surfaces: projects, mission authoring, feedback review. */
const BUILDER_PREFIXES = ["/dashboard"]

/**
 * Tester-only surfaces. `/explore` and `/mission` are in here because they
 * exist purely to find and complete missions — that is the tester's job, so
 * under separate account types they are not a builder's to visit.
 */
const TESTER_PREFIXES = ["/tester", "/explore", "/mission"]

/**
 * Reachable from either account type: they are per-person, not per-account.
 * Admin lives here too — `requireAdmin()` in lib/auth.ts owns that check, and
 * an admin's account type is irrelevant to it.
 */
const SHARED_PREFIXES = [
  "/settings",
  "/guidelines",
  "/terms-accept",
  "/admin",
  CHOOSE_ACCOUNT_PATH,
]

/** Same matching rule middleware already used for `protectedPrefixes`. */
function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

function underAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => underPrefix(pathname, p))
}

/**
 * Where a signed-in account lands after auth, and where it gets bounced to.
 *
 * A tester lands on /explore, not /tester: /explore is the community feed with
 * missions to pick up, while /tester is the personal surface, which for someone
 * who has just verified is empty. /tester stays reachable from the sidebar —
 * it is just not the front door.
 */
export function homeFor(account: AccountType): string {
  return account === "tester" ? "/explore" : "/dashboard"
}

export type AccessResult =
  | { allow: true }
  | { allow: false; redirect: string }

/**
 * Decides whether `account` may see `pathname`.
 *
 * `account` is the *active* account type, already validated against the
 * database — never the raw cookie. A null account means the user is
 * authenticated but has not created any account record yet.
 */
export function accessFor(pathname: string, account: AccountType | null): AccessResult {
  // Shared surfaces resolve first so /choose-account can never redirect to
  // itself, and so a user with no account yet can still accept terms.
  if (underAny(pathname, SHARED_PREFIXES)) return { allow: true }

  const isBuilderRoute = underAny(pathname, BUILDER_PREFIXES)
  const isTesterRoute = underAny(pathname, TESTER_PREFIXES)

  // Anything not claimed by either role is public or unscoped — leave it alone.
  if (!isBuilderRoute && !isTesterRoute) return { allow: true }

  // Signed in, but hasn't picked an account type yet.
  if (account === null) return { allow: false, redirect: CHOOSE_ACCOUNT_PATH }

  const allowed = account === "builder" ? isBuilderRoute : isTesterRoute
  return allowed ? { allow: true } : { allow: false, redirect: homeFor(account) }
}
