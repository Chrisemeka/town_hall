// The guides restate rules that live in schemas, and prose drifts silently
// where a type would not. This reads the guide sources and asserts the claims
// that would be wrong if a schema moved underneath them. Run with: npm test
//
// It is string containment over a source file, which is blunt and will need
// touching when the copy is reworded. That is the point: rewording copy should
// have to notice it is restating a schema.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  ENTRY_STATUS_HINTS,
  TEST_CATEGORY_BLURBS,
  DEVICE_TARGETS,
  deviceTargetLabel,
} from "../lib/vocabulary.ts"
import {
  ENTRY_TEXT_MAX,
  MAX_SCREENSHOTS,
  MAX_SCREENSHOT_BYTES,
  PROJECT_SUMMARY_MAX,
  STEP_ACTION_MAX,
} from "../lib/validation/schemas.ts"

const builder = readFileSync("app/(public)/guides/builder/page.tsx", "utf8")
const tester = readFileSync("app/(public)/guides/tester/page.tsx", "utf8")

// JSX wraps prose across lines, so a sentence in the source is not a sentence
// on one line. Collapse whitespace before matching anything that reads as a
// sentence; the raw source is still what identifier checks look at.
const flat = (src: string) => src.replace(/\s+/g, " ")
const builderProse = flat(builder)
const testerProse = flat(tester)

/* ── the vocabulary is read, not retyped ─────────────────────────────── */

// Both guides render the status hints from lib/vocabulary.ts. If someone
// inlines the strings, this still passes — what it catches is a guide that
// stops mentioning them at all, or a hint that gets reworded in only one place.
for (const [status, hint] of Object.entries(ENTRY_STATUS_HINTS)) {
  assert.ok(
    tester.includes("ENTRY_STATUS_HINTS") || tester.includes(hint),
    `tester guide must carry the ${status} hint`,
  )
}
assert.ok(
  builder.includes("ENTRY_STATUS_HINTS"),
  "builder guide must explain the three statuses to whoever reads the log",
)
assert.ok(
  builder.includes("TEST_CATEGORY_BLURBS"),
  "builder guide must describe the three test categories",
)
for (const blurb of Object.values(TEST_CATEGORY_BLURBS)) {
  assert.ok(blurb.length > 0)
}
assert.ok(
  builder.includes("DEVICE_TARGETS") && builder.includes("deviceTargetLabel"),
  "builder guide must list the device targets from the vocabulary",
)
// "both" is its own answer, not the union of the other two — the guide says so.
assert.equal(deviceTargetLabel("both"), "Mobile & Desktop")
assert.equal(DEVICE_TARGETS.length, 3)

/* ── the numbers come from the constants that enforce them ───────────── */

for (const [name, source] of [
  ["PROJECT_SUMMARY_MAX", builder],
  ["STEP_ACTION_MAX", builder],
  ["STEP_EXPECTED_MAX", builder],
  ["ENTRY_TEXT_MAX", tester],
  ["MAX_SCREENSHOTS", tester],
  ["MAX_SCREENSHOT_BYTES", tester],
] as const) {
  assert.ok(
    source.includes(name),
    `${name} must be imported into the guide, not typed as a literal`,
  )
}

// And a literal of the current value must NOT be sitting beside it, which is
// how these drift: someone imports the constant and then also writes "200".
for (const [value, source, label] of [
  [PROJECT_SUMMARY_MAX, builder, "project summary cap"],
  [STEP_ACTION_MAX, builder, "step action cap"],
  [ENTRY_TEXT_MAX, tester, "entry text cap"],
  [MAX_SCREENSHOTS, tester, "screenshot count"],
] as const) {
  const prose = source.replace(/^import[\s\S]*?from ".*"$/gm, "")
  assert.ok(
    !new RegExp(`[^\\w-]${value}[^\\w%]`).test(prose),
    `${label}: ${value} is written out as a literal somewhere it should be {${value}}`,
  )
}

assert.equal(MAX_SCREENSHOT_BYTES / (1024 * 1024), 5)

/* ── what a fail and a blocked step owe ──────────────────────────────── */

// auditEntrySchema requires all three of these on a fail AND on a blocked step.
// CLAUDE.md names the schema and firstIncompleteEntry as a pair that moves
// together; this page is now a third place stating the same rule.
for (const field of [
  "What actually happened",
  "Summary of the issue",
  "Steps to reproduce",
]) {
  assert.ok(tester.includes(field), `tester guide must name "${field}"`)
}

// Blocked is not a lighter failure. If the guide stops saying so, a tester who
// could not reach a step files it as a fail and the builder hunts a bug in a
// feature nobody opened.
assert.ok(
  /[Bb]locked is not a (softer|lighter|milder)/.test(testerProse),
  "tester guide must say blocked is not a softer fail",
)
assert.ok(
  /[Bb]locked is not a (softer|lighter|milder)/.test(builderProse),
  "builder guide must say blocked is not a milder failure",
)

// A pass owes nothing but its status.
assert.ok(
  /passing step (asks nothing|carries nothing)/.test(testerProse + builderProse),
  "the guides must say a pass owes nothing else",
)

/* ── the claim most likely to be written from memory ─────────────────── */

// 20260908_01 took expected_result off the tester's form: it was prefilled from
// the builder's own wording and came back unchanged ten times out of eleven.
// A guide that describes it as a field the tester fills is describing the old
// product.
for (const [name, prose] of [
  ["tester", testerProse],
  ["builder", builderProse],
] as const) {
  assert.ok(
    !/you (are asked to |must |should )?(re)?state the expected result/i.test(prose),
    `${name} guide must not describe an expected-result field the tester fills`,
  )
}
assert.ok(
  /never asked to restate it/i.test(testerProse),
  "tester guide should say explicitly that restating the expectation is not asked",
)

/* ── the field the mission form does not have ────────────────────────── */

// missions.testers_needed is read by the tester page but written by neither
// createMission nor updateMission. Until that changes, the builder guide must
// not describe choosing a tester count.
assert.ok(
  !/how many testers (do you|you) (want|need)|choose .{0,20}testers|set the number of testers/i.test(
    builderProse,
  ),
  "builder guide must not describe picking a tester count — the form has no such field",
)

console.log("guides.test.mts — all assertions passed")
