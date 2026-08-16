// Role-based route gating for the Builder / Tester account split.
//
// Kept as a pure function with no imports so middleware, server components, and
// scripts/access.test.mts all reach the same decision from the same code. This
// is access control, not UI routing — if it disagrees with itself in two places
// that is a hole, so there is only one place.

export type AccountType = "builder" | "tester"

export const CHOOSE_ACCOUNT_PATH = "/choose-account"
export const ACCOUNT_COOKIE = "th_account"
export const VERIFY_PREFIX = "/verify"

/** Where an account that has not cleared the verification gate has to go. */
export function verifyPathFor(account: AccountType): string {
  return `${VERIFY_PREFIX}/${account}`
}

/** Builder-only surfaces: projects, mission authoring, feedback review. */
const BUILDER_PREFIXES = ["/dashboard", verifyPathFor("builder")]

/**
 * Tester-only surfaces. `/explore` and `/mission` are in here because they
 * exist purely to find and complete missions — that is the tester's job, so
 * under separate account types they are not a builder's to visit.
 */
const TESTER_PREFIXES = ["/tester", "/explore", "/mission", verifyPathFor("tester")]

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

/** True for the gate's own pages, which the gate itself must never redirect. */
export function isVerifyPath(pathname: string): boolean {
  return underPrefix(pathname, VERIFY_PREFIX)
}

/**
 * True for surfaces that belong to one role — and therefore exactly where the
 * verification gate applies.
 *
 * DO NOT widen this to "every protected route". It reads like an oversight and
 * it is not; three separate things break if you do.
 *
 * 1. It traps the user. The shared surfaces are per-person, not per-role:
 *    /settings holds account deletion and /choose-account is how someone adds
 *    or switches a role. Gate those and an unverified tester can neither leave
 *    nor become a builder — their only exit is completing a flow they may have
 *    opened by accident. /terms-accept is worse: it is itself a gate, so
 *    gating it means the two gates point at each other.
 *
 * 2. It desynchronises the two enforcement layers. requireAccount() guards
 *    role-scoped surfaces and nothing else — /settings and /choose-account do
 *    not call it at all. A wider URL-level gate would make middleware stricter
 *    than the in-page check, which is the exact disagreement the two-layer
 *    pattern in CLAUDE.md exists to prevent.
 *
 * 3. It is per-role by construction. "Is this person verified" is not a
 *    question with one answer — the same person can be a verified builder and
 *    an unverified tester at once. On a surface belonging to neither role
 *    there is no role to ask about.
 *
 * The spec's acceptance criterion reads "any protected route", which is where
 * the temptation comes from. Role-scoped is the reading that leaves the user a
 * way out; it was reviewed and chosen deliberately, not missed.
 */
export function isRoleScoped(pathname: string): boolean {
  if (underAny(pathname, SHARED_PREFIXES)) return false
  return underAny(pathname, BUILDER_PREFIXES) || underAny(pathname, TESTER_PREFIXES)
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
 *
 * Note what this deliberately does not know: whether the account has cleared
 * the verification gate. This answers "may this role be here", and
 * /verify/[role] is scoped to its role like any other surface — so an account
 * is always allowed at its own verify page, and the gate can never lock a user
 * out of the gate. Whether they are *sent* there is a separate question, owned
 * by middleware.ts and requireAccount(), because only they can read the
 * timestamp.
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
