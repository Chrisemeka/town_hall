// Role-based route gating — the highest-risk part of the Builder/Tester split,
// because it is access control rather than UI routing. Run with: npm test
// (node strips the types, no test framework needed)

import assert from "node:assert/strict"
import {
  CHOOSE_ACCOUNT_PATH,
  accessFor,
  homeFor,
  isRoleScoped,
  isVerifyPath,
  verifyPathFor,
  type AccountType,
} from "../lib/access.ts"

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
for (const path of ["/settings", "/guidelines", "/terms-accept", "/admin", "/admin/users"]) {
  for (const account of ["builder", "tester", null] as const) {
    assert.equal(allowed(path, account), true, `${path} should stay open to ${account}`)
  }
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
for (const path of ["/settings", CHOOSE_ACCOUNT_PATH, "/terms-accept", "/guidelines", "/admin", "/", "/terms"]) {
  assert.equal(isRoleScoped(path), false, `${path} must stay reachable while unverified`)
}

/* ── verification gate: the composition terminates ───────────────────── */

// Loops don't come from any single rule, they come from the rules pointing at
// each other. This walks the same decision middleware.ts makes, following
// redirects until they stop, and fails if a path is ever visited twice.
function nextHop(pathname: string, account: AccountType | null, verified: boolean): string | null {
  if (account && isRoleScoped(pathname)) {
    const verifyPath = verifyPathFor(account)
    if (!verified && pathname !== verifyPath) return verifyPath
    if (verified && isVerifyPath(pathname)) return homeFor(account)
  }
  const access = accessFor(pathname, account)
  return access.allow ? null : access.redirect
}

function settlesAt(start: string, account: AccountType | null, verified: boolean): string {
  const seen = [start]
  let path = start
  for (let i = 0; i < 10; i++) {
    const next = nextHop(path, account, verified)
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
for (const path of ["/settings", CHOOSE_ACCOUNT_PATH, "/guidelines", "/terms-accept"]) {
  assert.equal(settlesAt(path, "tester", false), path, `${path} must stay reachable while unverified`)
}

// No account yet: the picker still resolves first, and the gate stays out of it.
assert.equal(settlesAt("/dashboard", null, false), CHOOSE_ACCOUNT_PATH)
assert.equal(settlesAt(CHOOSE_ACCOUNT_PATH, null, false), CHOOSE_ACCOUNT_PATH)

console.log("access gating: all assertions passed")
