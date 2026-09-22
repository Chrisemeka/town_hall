// Theme cookie resolution. The cookie is attacker-controlled text that ends up
// in an HTML attribute, so what matters here is that nothing but "dark" or
// "light" can ever come out. Run with: npm test
// (node strips the types, no test framework needed)

import assert from "node:assert/strict"
import { THEME_COOKIE, otherTheme, readTheme } from "../lib/theme.ts"

/* ── the two real values ─────────────────────────────────────────────── */

assert.equal(readTheme("dark"), "dark")
assert.equal(readTheme("light"), "light")

/* ── the default is light, not the OS preference ─────────────────────── */

// No cookie at all — a first visit. If this ever returns "dark", someone has
// added a prefers-color-scheme fallback that lib/theme.ts says not to add.
assert.equal(readTheme(undefined), "light")
assert.equal(readTheme(""), "light")

/* ── anything else resolves to the default, never passes through ─────── */

for (const junk of [
  "DARK",              // exact match only — no case folding
  " dark",             // no trimming
  "dark ",
  "purple",
  "light; --data-theme=dark",
  '" onload="alert(1)', // the reason this function exists
  "__proto__",
]) {
  assert.equal(readTheme(junk), "light", `"${junk}" must resolve to the default`)
}

/* ── the toggle's destination ────────────────────────────────────────── */

assert.equal(otherTheme("light"), "dark")
assert.equal(otherTheme("dark"), "light")

// Round trip: whatever readTheme returns, otherTheme flips it, and that flipped
// value is itself a valid cookie value. This is the toggle's whole contract.
for (const start of ["dark", "light", undefined, "nonsense"]) {
  const theme = readTheme(start)
  assert.equal(readTheme(otherTheme(theme)), otherTheme(theme))
}

assert.equal(THEME_COOKIE, "th_theme")

console.log("theme.test.mts — all assertions passed")
