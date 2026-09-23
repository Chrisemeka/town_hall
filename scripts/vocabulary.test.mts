// The verification vocabularies are typed as `[string, ...string[]]` so Zod can
// build enums from them, and one of them (TIMEZONES) is filled by the runtime
// rather than by us. If that runtime call ever returns nothing, the cast is a
// lie and z.enum() throws at import time — which takes the whole app down at
// boot, not at the point of use. These assertions are what makes that loud.
// Run with: npm test

import assert from "node:assert/strict"
import {
  COUNTRIES,
  DEVICE_TARGETS,
  ENTRY_STATUSES,
  ENTRY_STATUS_HINTS,
  PROJECT_CATEGORIES,
  SKILLS,
  TEST_CATEGORIES,
  TIMEZONES,
  countryName,
  deviceTargetLabel,
  entryStatusLabel,
  testCategoryLabel,
  PLAN_IDS,
  DEFAULT_PLAN,
  planIdFor,
} from "../lib/vocabulary.ts"

const noDuplicates = (list: readonly string[], label: string) =>
  assert.equal(new Set(list).size, list.length, `${label} contains a duplicate`)

/* ── the casts must be true ──────────────────────────────────────────── */

assert.ok(COUNTRIES.length > 0, "COUNTRIES is empty — z.enum would throw at import")
assert.ok(TIMEZONES.length > 0, "Intl.supportedValuesOf('timeZone') returned nothing on this runtime")
assert.ok(SKILLS.length > 0, "SKILLS is empty")

/* ── countries ───────────────────────────────────────────────────────── */

noDuplicates(COUNTRIES, "COUNTRIES")
assert.equal(COUNTRIES.length, 249, "ISO 3166-1 has 249 officially assigned alpha-2 codes")

for (const code of COUNTRIES) {
  assert.match(code, /^[A-Z]{2}$/, `${code} is not an ISO 3166-1 alpha-2 code`)
}

for (const code of ["NG", "US", "GB", "IN", "KE", "ZA"]) {
  assert.ok(COUNTRIES.includes(code), `${code} should be selectable`)
}

// Not just that it returns something — that the platform actually has region
// data. Without it every option in the dropdown renders as its own raw code.
assert.equal(countryName("NG"), "Nigeria")

// Catches a typo in the 249-code literal: an unassigned code still passes the
// /^[A-Z]{2}$/ check above, but ICU resolves it to "Unknown Region" — which is
// what the dropdown would then show.
for (const code of COUNTRIES) {
  const name = countryName(code)
  assert.notEqual(name, "Unknown Region", `${code} is not an assigned ISO 3166-1 code`)
  assert.notEqual(name, code, `${code} has no display name on this runtime`)
}

/* ── timezones ───────────────────────────────────────────────────────── */

noDuplicates(TIMEZONES, "TIMEZONES")
for (const zone of ["Africa/Lagos", "America/New_York", "Europe/London"]) {
  assert.ok(TIMEZONES.includes(zone), `${zone} should be a valid timezone choice`)
}

// The reason UTC is appended by hand: whatever the browser auto-detects has to
// be selectable, and on a machine with no region set that is literally "UTC".
assert.ok(TIMEZONES.includes("UTC"), "UTC must be selectable")
assert.ok(
  TIMEZONES.includes(Intl.DateTimeFormat().resolvedOptions().timeZone),
  "this runtime's own timezone is not in the list the form would validate against",
)
assert.deepEqual(TIMEZONES, [...TIMEZONES].sort(), "TIMEZONES must stay sorted for the dropdown")

/* ── skills ──────────────────────────────────────────────────────────── */

noDuplicates(SKILLS, "SKILLS")

console.log("verification vocabulary: all assertions passed")

/* ── project categories ──────────────────────────────────────────────── */

assert.ok(PROJECT_CATEGORIES.length > 0, "PROJECT_CATEGORIES is empty — z.enum would throw at import")
noDuplicates(PROJECT_CATEGORIES, "PROJECT_CATEGORIES")

for (const category of PROJECT_CATEGORIES) {
  assert.equal(category, category.trim(), `"${category}" has surrounding whitespace`)
  assert.ok(category.length > 0, "PROJECT_CATEGORIES contains an empty string")
}

// "Other" is what stops a builder whose category is missing from picking a wrong
// one, and it reads as a catch-all only while it sits at the bottom of the list.
assert.ok(PROJECT_CATEGORIES.includes("Other"), "PROJECT_CATEGORIES must offer an 'Other' catch-all")
assert.equal(
  PROJECT_CATEGORIES[PROJECT_CATEGORIES.length - 1],
  "Other",
  "'Other' must be last — it is the fallback, not a peer",
)

console.log("project categories: all assertions passed")

/* ── test categories and device targets ──────────────────────────────── */

for (const [list, label] of [
  [TEST_CATEGORIES, "TEST_CATEGORIES"],
  [DEVICE_TARGETS, "DEVICE_TARGETS"],
] as const) {
  assert.ok(list.length > 0, `${label} is empty — z.enum would throw at import`)
  noDuplicates(list, label)
  for (const value of list) {
    // Stored values, not display copy: a space or capital here means the
    // migration and the schema are writing different things than the UI reads.
    assert.match(value, /^[a-z][a-z_]*$/, `${label} value "${value}" is not snake_case`)
  }
}

// A value with no label renders as its raw slug, which is the kind of thing
// that ships to production looking like a typo.
for (const value of TEST_CATEGORIES) {
  assert.notEqual(testCategoryLabel(value), value, `${value} has no human label`)
}
for (const value of DEVICE_TARGETS) {
  assert.notEqual(deviceTargetLabel(value), value, `${value} has no human label`)
}

// The migration writes these three literals. If the vocabulary is renamed
// without a follow-up migration, the rows it already wrote stop matching.
for (const value of ["process_flow", "component", "ui_design"]) {
  assert.ok(
    (TEST_CATEGORIES as readonly string[]).includes(value),
    `"${value}" is written by 20260905_02_mission_test_cases.sql and must stay in TEST_CATEGORIES`,
  )
}

console.log("test categories + device targets: all assertions passed")

/* ── audit-log entry statuses ────────────────────────────────────────── */

assert.ok(ENTRY_STATUSES.length > 0, "ENTRY_STATUSES is empty — z.enum would throw at import")
noDuplicates(ENTRY_STATUSES, "ENTRY_STATUSES")

for (const value of ENTRY_STATUSES) {
  assert.match(value, /^[a-z][a-z_]*$/, `ENTRY_STATUSES value "${value}" is not snake_case`)
  assert.notEqual(entryStatusLabel(value), value, `${value} has no human label`)
}

// "fail" is the value the conditional validation keys off — a rename without a
// matching schema change would quietly stop requiring the issue fields.
assert.ok(
  (ENTRY_STATUSES as readonly string[]).includes("fail"),
  "'fail' is what auditEntrySchema requires issue_summary and steps_to_reproduce for",
)


/* ── entry status hints ──────────────────────────────────────────────── */

// Shown to the tester in the tooltip beside the choice. A status with no hint
// renders as a blank line next to its label, which reads as a bug rather than
// as missing copy.
for (const status of ENTRY_STATUSES) {
  const hint = ENTRY_STATUS_HINTS[status]
  assert.ok(hint && hint.trim().length > 0, `${status} has no hint`)
  assert.ok(hint.length < 80, `${status}'s hint is too long for a tooltip line`)
}
assert.equal(
  Object.keys(ENTRY_STATUS_HINTS).length,
  ENTRY_STATUSES.length,
  "ENTRY_STATUS_HINTS has an entry for a status that does not exist",
)


/* ── plan ids ────────────────────────────────────────────────────────── */

// The column is nullable and null means Community, so planIdFor has to answer
// for a row that has never been touched as well as for one that has.
assert.equal(planIdFor(null), DEFAULT_PLAN, "an unassigned account is on the free plan")
assert.equal(planIdFor(undefined), DEFAULT_PLAN)
assert.equal(planIdFor(""), DEFAULT_PLAN)
assert.equal(planIdFor("community"), "community")
assert.equal(planIdFor("pro"), "pro")

// There is no CHECK constraint on the column — Zod is the only thing standing
// between a typo and the database — so a value that is not in the vocabulary
// must read as the default rather than as itself.
assert.equal(planIdFor("enterprise"), DEFAULT_PLAN, "an unknown plan is not a plan")
assert.equal(planIdFor("PRO"), DEFAULT_PLAN, "exact match only")

assert.ok(
  (PLAN_IDS as readonly string[]).includes(DEFAULT_PLAN),
  "the default has to be one of the plans it defaults to",
)

console.log("plan ids: all assertions passed")

console.log("entry statuses: all assertions passed")
