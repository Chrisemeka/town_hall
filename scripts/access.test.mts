// Role-based route gating — the highest-risk part of the Builder/Tester split,
// because it is access control rather than UI routing. Run with: npm test
// (node strips the types, no test framework needed)

import assert from "node:assert/strict"
import {
  CHOOSE_ACCOUNT_PATH,
  CONFIRM_EMAIL_PATH,
  RESET_PASSWORD_PATH,
  accessFor,
  isEmailGateExempt,
  homeFor,
  isRoleScoped,
  isVerifyPath,
  verifyPathFor,
  type AccountType,
} from "../lib/access.ts"
import { searchHref, type SearchTarget } from "../lib/searchHref.ts"

const allowed = (path: string, account: AccountType | null) => accessFor(path, account).allow

function redirectFor(path: string, account: AccountType | null): string {
  const result = accessFor(path, account)
  assert.equal(result.allow, false, `${path} should have been denied for ${account}`)
  return (result as { allow: false; redirect: string }).redirect
}

/* ── builder-only surfaces ───────────────────────────────────────────── */

const BUILDER_ONLY = [
  "/dashboard",
  "/dashboard/missions",
  "/dashboard/feedback",
  "/dashboard/new",
  "/dashboard/abc-123",
  "/dashboard/abc-123/mission/new",
  "/dashboard/abc-123/mission/def-456",
  "/dashboard/abc-123/mission/def-456/edit",
]

for (const path of BUILDER_ONLY) {
  assert.equal(allowed(path, "builder"), true, `builder should reach ${path}`)
  assert.equal(redirectFor(path, "tester"), "/explore", `tester must be bounced off ${path}`)
}

/* ── tester-only surfaces ────────────────────────────────────────────── */

const TESTER_ONLY = [
  "/tester",
  "/explore",
  "/explore/missions",
  "/explore/project/abc-123",
  "/mission/abc-123",
]

for (const path of TESTER_ONLY) {
  assert.equal(allowed(path, "tester"), true, `tester should reach ${path}`)
  assert.equal(redirectFor(path, "builder"), "/dashboard", `builder must be bounced off ${path}`)
}

/* ── no account yet ──────────────────────────────────────────────────── */

// Authenticated but hasn't picked a type: every role-scoped route funnels to
// the picker, and the picker itself must stay reachable or that is a loop.
for (const path of [...BUILDER_ONLY, ...TESTER_ONLY]) {
  assert.equal(redirectFor(path, null), CHOOSE_ACCOUNT_PATH, `${path} should send an accountless user to the picker`)
}
assert.equal(allowed(CHOOSE_ACCOUNT_PATH, null), true, "the picker must not redirect to itself")
assert.equal(allowed(CHOOSE_ACCOUNT_PATH, "builder"), true)
assert.equal(allowed(CHOOSE_ACCOUNT_PATH, "tester"), true)

/* ── shared surfaces ─────────────────────────────────────────────────── */

// Per-person, not per-account — both types keep reaching these, and so does a
// user with no account yet (they still have to be able to accept terms).
for (const path of ["/settings", "/guides", "/terms-accept", "/admin", "/admin/users", CONFIRM_EMAIL_PATH]) {
  for (const account of ["builder", "tester", null] as const) {
    assert.equal(allowed(path, account), true, `${path} should stay open to ${account}`)
  }
}

/* ── public marketing surfaces ───────────────────────────────────────── */

// These are reachable by everyone, signed in or not. There is no "public list"
// in lib/access.ts and deliberately so — accessFor() allows anything no role
// prefix claims, so a list would be a second source of truth reaching the same
// answer. This loop is what pins the behaviour instead: if someone later files
// /guides under a role prefix, or widens middleware's protectedPrefixes to
// match one of these, it fails here.
const PUBLIC_PAGES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  RESET_PASSWORD_PATH,
  "/pricing",
  "/guides",
  "/guides/builder",
  "/guides/tester",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
]

for (const path of PUBLIC_PAGES) {
  for (const account of ["builder", "tester", null] as const) {
    assert.equal(allowed(path, account), true, `${path} must stay public for ${account}`)
  }
  // Public pages are not role-scoped, so the verification gate never fires on
  // them — a half-verified builder can still read the pricing page.
  assert.equal(isRoleScoped(path), false, `${path} must not be gated`)
}

/* ── public / unscoped ───────────────────────────────────────────────── */

for (const path of ["/", "/terms", "/privacy", "/not-a-real-page"]) {
  for (const account of ["builder", "tester", null] as const) {
    assert.equal(allowed(path, account), true, `${path} is unscoped and should be left alone`)
  }
}

/* ── prefix matching is segment-aware ────────────────────────────────── */

// The bug this guards: a naive startsWith() would make "/missions" match the
// "/mission" prefix, and "/dashboardsomething" match "/dashboard" — silently
// pulling unrelated paths into a role scope.
assert.equal(allowed("/missions", "builder"), true, "/missions must not match the /mission prefix")
assert.equal(allowed("/dashboardxyz", "tester"), true, "/dashboardxyz must not match the /dashboard prefix")
assert.equal(allowed("/testers", "builder"), true, "/testers must not match the /tester prefix")
assert.equal(allowed("/explorer", "builder"), true, "/explorer must not match the /explore prefix")

// ...while the real nested paths still do match.
assert.equal(allowed("/mission/abc", "builder"), false)
assert.equal(allowed("/dashboard/abc", "tester"), false)

/* ── homeFor ─────────────────────────────────────────────────────────── */

assert.equal(homeFor("builder"), "/dashboard")
assert.equal(homeFor("tester"), "/explore")

// /tester is still a real tester surface — dropping it out of homeFor must not
// quietly drop it out of the tester's reach.
assert.equal(allowed("/tester", "tester"), true, "/tester must stay reachable")

// A denial must never point at a route the same account would also be denied,
// or the redirect loops.
for (const account of ["builder", "tester"] as const) {
  assert.equal(allowed(homeFor(account), account), true, `${account} must be allowed at its own home`)
}

/* ── verification gate: which paths it covers ────────────────────────── */

assert.equal(verifyPathFor("tester"), "/verify/tester")
assert.equal(verifyPathFor("builder"), "/verify/builder")

// The gate must never lock a user out of the gate.
assert.equal(allowed("/verify/tester", "tester"), true, "a tester must reach their own verify page")
assert.equal(allowed("/verify/builder", "builder"), true, "a builder must reach their own verify page")

// The other role's verify page is not yours, verified or not.
assert.equal(redirectFor("/verify/tester", "builder"), "/dashboard")
assert.equal(redirectFor("/verify/builder", "tester"), "/explore")

// No account yet means there is no role to verify — pick one first.
assert.equal(redirectFor("/verify/tester", null), CHOOSE_ACCOUNT_PATH)

// Same segment-aware matching as everything else here.
assert.equal(isVerifyPath("/verify"), true)
assert.equal(isVerifyPath("/verify/tester"), true)
assert.equal(isVerifyPath("/verifyxyz"), false, "/verifyxyz must not match the /verify prefix")

// The gate applies to role-scoped surfaces and nothing else. The shared ones
// are the escape hatches: leaving, switching role, and accepting terms all have
// to stay reachable while unverified.
for (const path of ["/dashboard", "/explore", "/tester", "/mission/abc", "/verify/tester", "/verify/builder"]) {
  assert.equal(isRoleScoped(path), true, `${path} should be gated`)
}
for (const path of ["/settings", CHOOSE_ACCOUNT_PATH, "/terms-accept", "/guides", "/admin", "/", "/terms", CONFIRM_EMAIL_PATH, RESET_PASSWORD_PATH]) {
  assert.equal(isRoleScoped(path), false, `${path} must stay reachable while unverified`)
}

/* ── email gate: the first link in the chain ─────────────────────────── */

// /confirm-email must be reachable with NO session. With "Confirm email" on,
// signUp() returns a user and no session, so the person landing here out of
// signup is anonymous — protecting the page bounces them to the landing page
// at the exact moment it is meant to help. This caught a real bug.
assert.equal(allowed(CONFIRM_EMAIL_PATH, null), true, "signup lands here with no session")
assert.equal(allowed(RESET_PASSWORD_PATH, null), true, "a recovery link may open logged out")
for (const path of ["/login", "/signup", "/forgot-password"]) {
  assert.equal(allowed(path, null), true, `${path} must be reachable anonymously`)
}


// The email gate runs before terms, before the account picker, before
// verification. Two pages have to survive it, and for different reasons.
assert.equal(isEmailGateExempt(CONFIRM_EMAIL_PATH), true, "the gate must not gate its own page")
assert.equal(
  isEmailGateExempt(RESET_PASSWORD_PATH),
  true,
  "a recovery session may be unconfirmed; bouncing it strands the user mid-reset",
)

// Everything else is subject to it, including the later gates' own pages —
// an unconfirmed address has no business in the verification flow, which would
// otherwise end with a verified account on an unproven address.
for (const path of [
  "/dashboard",
  "/explore",
  "/tester",
  "/mission/abc",
  "/settings",
  "/terms-accept",
  CHOOSE_ACCOUNT_PATH,
  "/verify/tester",
  "/verify/builder",
  "/admin",
]) {
  assert.equal(isEmailGateExempt(path), false, `${path} must be behind the email gate`)
}

// Segment-aware, like every other matcher here.
assert.equal(isEmailGateExempt("/confirm-emailx"), false)
assert.equal(isEmailGateExempt("/reset-passwordx"), false)
assert.equal(isEmailGateExempt("/confirm-email/anything"), true)

/* ── verification gate: the composition terminates ───────────────────── */

// Loops don't come from any single rule, they come from the rules pointing at
// each other. This walks the same decision middleware.ts makes, following
// redirects until they stop, and fails if a path is ever visited twice.
function nextHop(
  pathname: string,
  account: AccountType | null,
  verified: boolean,
  emailConfirmed = true,
): string | null {
  // First link in the chain, and it outranks every gate below — mirrors the
  // order in middleware.ts and in resolveAccountOrRedirect().
  if (!emailConfirmed && !isEmailGateExempt(pathname)) return CONFIRM_EMAIL_PATH
  if (account && isRoleScoped(pathname)) {
    const verifyPath = verifyPathFor(account)
    if (!verified && pathname !== verifyPath) return verifyPath
    if (verified && isVerifyPath(pathname)) return homeFor(account)
  }
  const access = accessFor(pathname, account)
  return access.allow ? null : access.redirect
}

function settlesAt(
  start: string,
  account: AccountType | null,
  verified: boolean,
  emailConfirmed = true,
): string {
  const seen = [start]
  let path = start
  for (let i = 0; i < 10; i++) {
    const next = nextHop(path, account, verified, emailConfirmed)
    if (next === null) return path
    assert.ok(!seen.includes(next), `redirect loop: ${[...seen, next].join(" -> ")}`)
    seen.push(next)
    path = next
  }
  assert.fail(`never settled from ${start}: ${seen.join(" -> ")}`)
}

const GATED = ["/dashboard", "/dashboard/abc-123", "/explore", "/tester", "/mission/abc-123"]

// Unverified: everything role-scoped funnels to that role's verify page...
for (const path of [...GATED, "/verify/builder", "/verify/tester"]) {
  assert.equal(settlesAt(path, "tester", false), "/verify/tester", `unverified tester from ${path}`)
  assert.equal(settlesAt(path, "builder", false), "/verify/builder", `unverified builder from ${path}`)
}

// ...and the verify page itself is where it stops, which is the whole point.
assert.equal(settlesAt("/verify/tester", "tester", false), "/verify/tester")
assert.equal(settlesAt("/verify/builder", "builder", false), "/verify/builder")

// Verified: the flow is not somewhere to go back to.
assert.equal(settlesAt("/verify/tester", "tester", true), "/explore")
assert.equal(settlesAt("/verify/builder", "builder", true), "/dashboard")
assert.equal(settlesAt("/verify/builder", "tester", true), "/explore")

// Verified users are otherwise untouched by the gate.
for (const path of ["/explore", "/tester", "/mission/abc-123"]) {
  assert.equal(settlesAt(path, "tester", true), path, `verified tester should stay on ${path}`)
}
assert.equal(settlesAt("/dashboard", "builder", true), "/dashboard")

// Unverified users are not trapped: they can still leave or change role.
for (const path of ["/settings", CHOOSE_ACCOUNT_PATH, "/guides", "/terms-accept"]) {
  assert.equal(settlesAt(path, "tester", false), path, `${path} must stay reachable while unverified`)
}

// No account yet: the picker still resolves first, and the gate stays out of it.
assert.equal(settlesAt("/dashboard", null, false), CHOOSE_ACCOUNT_PATH)
assert.equal(settlesAt(CHOOSE_ACCOUNT_PATH, null, false), CHOOSE_ACCOUNT_PATH)

/* ── global search opens somewhere the account is allowed ────────────── */

// The bug this covers: the search sent every result to /dashboard, so a tester
// clicking one was denied by the rule above and bounced to /explore. Asserting
// the strings would have passed just as happily — the invariant is that the
// href survives accessFor for the account that produced it.
const TARGETS: SearchTarget[] = [
  { kind: "project", id: "11111111-1111-4111-8111-111111111111" },
  { kind: "mission", id: "22222222-2222-4222-8222-222222222222", projectId: "33333333-3333-4333-8333-333333333333" },
]

for (const account of ["builder", "tester"] as AccountType[]) {
  for (const target of TARGETS) {
    const href = searchHref(account, target)
    assert.ok(
      allowed(href, account),
      `a ${account} searching a ${target.kind} was sent to ${href}, which accessFor denies`,
    )
    assert.ok(
      !allowed(href, account === "builder" ? "tester" : "builder"),
      `${href} is meant to be ${account}-only, so the other role must not reach it`,
    )
  }
}

assert.equal(searchHref("tester", TARGETS[0]), "/explore/project/11111111-1111-4111-8111-111111111111")
assert.equal(searchHref("tester", TARGETS[1]), "/mission/22222222-2222-4222-8222-222222222222")
assert.equal(searchHref("builder", TARGETS[0]), "/dashboard/11111111-1111-4111-8111-111111111111")
assert.equal(
  searchHref("builder", TARGETS[1]),
  "/dashboard/33333333-3333-4333-8333-333333333333/mission/22222222-2222-4222-8222-222222222222",
)

console.log("access gating: all assertions passed")

/* ── the whole chain, with the email gate at the front ───────────────── */

// An unconfirmed address funnels to /confirm-email from everywhere, whatever
// state the later gates are in — and settles there rather than bouncing on.
for (const path of [...GATED, "/verify/tester", "/settings", CHOOSE_ACCOUNT_PATH, "/terms-accept"]) {
  assert.equal(
    settlesAt(path, "tester", false, false),
    CONFIRM_EMAIL_PATH,
    `unconfirmed tester from ${path}`,
  )
  assert.equal(
    settlesAt(path, null, false, false),
    CONFIRM_EMAIL_PATH,
    `unconfirmed with no account yet, from ${path}`,
  )
}

assert.equal(settlesAt(CONFIRM_EMAIL_PATH, "tester", false, false), CONFIRM_EMAIL_PATH)
assert.equal(settlesAt(RESET_PASSWORD_PATH, "tester", false, false), RESET_PASSWORD_PATH)

// Confirmed, and the chain behaves exactly as it did before this gate existed.
assert.equal(settlesAt("/dashboard", "builder", true, true), "/dashboard")
assert.equal(settlesAt("/dashboard", "builder", false, true), "/verify/builder")

console.log("email gate + access composition: all assertions passed")
