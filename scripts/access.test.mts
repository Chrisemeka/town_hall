// Role-based route gating — the highest-risk part of the Builder/Tester split,
// because it is access control rather than UI routing. Run with: npm test
// (node strips the types, no test framework needed)

import assert from "node:assert/strict"
import { CHOOSE_ACCOUNT_PATH, accessFor, homeFor, type AccountType } from "../lib/access.ts"

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
  assert.equal(redirectFor(path, "tester"), "/tester", `tester must be bounced off ${path}`)
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
assert.equal(homeFor("tester"), "/tester")

// A denial must never point at a route the same account would also be denied,
// or the redirect loops.
for (const account of ["builder", "tester"] as const) {
  assert.equal(allowed(homeFor(account), account), true, `${account} must be allowed at its own home`)
}

console.log("access gating: all assertions passed")
