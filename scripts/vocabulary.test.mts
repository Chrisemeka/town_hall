// The verification vocabularies are typed as `[string, ...string[]]` so Zod can
// build enums from them, and one of them (TIMEZONES) is filled by the runtime
// rather than by us. If that runtime call ever returns nothing, the cast is a
// lie and z.enum() throws at import time — which takes the whole app down at
// boot, not at the point of use. These assertions are what makes that loud.
// Run with: npm test

import assert from "node:assert/strict"
import { COUNTRIES, SKILLS, TIMEZONES, countryName } from "../lib/vocabulary.ts"

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
