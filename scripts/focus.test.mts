// The two decisions inside the first-error focus hook, and the one inside the
// audit log's completeness check.
//
// vitest.config.mts runs with environment: "node" and this repo has no jsdom,
// so the DOM plumbing between these — getElementsByName, scrollIntoView, focus
// — is not exercised here. That is deliberate: it is four API calls with no
// branching left in it, and the branching that can be wrong is all below.
//
// The audit log's completeness rule is the other half of this and lives in
// components/tester/__tests__/auditLogSteps.test.ts, under vitest — it is
// exported from a .tsx, which plain node can neither strip nor resolve "@/" for.
// Run with: npm test

import assert from "node:assert/strict"
import { errorId, firstInDocumentOrder, prefersReducedMotion } from "../lib/focus.ts"

/* ── document order ──────────────────────────────────────────────────── */

/**
 * A stand-in for an element that knows where it sits.
 *
 * compareDocumentPosition returns DOCUMENT_POSITION_PRECEDING (2) when the
 * argument comes before the receiver, which is the only bit the function reads.
 */
const node = (at: number) => ({
  at,
  compareDocumentPosition(other: { at: number }): number {
    return other.at < at ? 2 : 4
  },
})

const a = node(1)
const b = node(2)
const c = node(3)

// FOC-01 — the case the whole function exists for. Zod hands the errors back in
// schema order; the page renders them in its own. Taking the array's first
// element would scroll the user past their first mistake.
assert.equal(firstInDocumentOrder([b, a]), a, "later-in-array but earlier in document wins")
assert.equal(firstInDocumentOrder([c, a, b]), a)
assert.equal(firstInDocumentOrder([a, b, c]), a, "already in order stays in order")

// FOC-02 / FOC-03 — the degenerate inputs.
assert.equal(firstInDocumentOrder([]), null, "nothing resolved is null, not a throw")
assert.equal(firstInDocumentOrder([b]), b, "one node is that node")

/* ── reduced motion ──────────────────────────────────────────────────── */

const realWindow = (globalThis as { window?: unknown }).window

function withMatchMedia(matches: boolean | null) {
  if (matches === null) {
    delete (globalThis as { window?: unknown }).window
    return
  }
  ;(globalThis as { window?: unknown }).window = {
    matchMedia: (query: string) => {
      assert.equal(query, "(prefers-reduced-motion: reduce)", "asks the standard query")
      return { matches }
    },
  }
}

// FOC-04 / FOC-05 — the behaviour the caller picks is never hard-coded.
withMatchMedia(true)
assert.equal(prefersReducedMotion(), true)
withMatchMedia(false)
assert.equal(prefersReducedMotion(), false)

// FOC-06 — imported on the server, where there is no window. Must answer, not
// throw: this module is reachable from a component that renders on both sides.
withMatchMedia(null)
assert.equal(prefersReducedMotion(), false, "no window is not reduced motion, and not a crash")

// A window with no matchMedia at all — older browsers, and jsdom-shaped stubs.
;(globalThis as { window?: unknown }).window = {}
assert.equal(prefersReducedMotion(), false)

if (realWindow === undefined) delete (globalThis as { window?: unknown }).window
else (globalThis as { window?: unknown }).window = realWindow

/* ── the id convention ───────────────────────────────────────────────── */

// FOC-07 — one owner for the string that ties a message to its input.
assert.equal(errorId("task_description"), "task_description-error")
assert.equal(errorId("entries.3.actual_result"), "entries.3.actual_result-error")

console.log("focus.test.mts — ok")
