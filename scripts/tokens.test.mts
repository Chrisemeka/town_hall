// Asserts the theme refactor stayed done. Run with: npm test
// (node strips the types, no test framework needed)
//
// A 76-file rename is exactly where one missed file renders dark-on-dark and
// nobody notices for a month — and the dangerous half is not the obvious one.
// Every accent in the palette fails as TEXT on Bone:
//
//   Voltage #E8FF47  1.02:1      Mint  #3FFFA2  1.20:1
//   Sky     #47B8FF  2.02:1      Ember #FF4F4F  2.97:1
//
// against Design.md's 4.5:1 for a label and WCAG 1.4.11's 3:1 for a control
// boundary. A stray `text-voltage` does not look broken in dark mode, which is
// where it will be reviewed. This is what catches it instead.
//
// Blunt string-matching, in the spirit of scripts/guides.test.mts.

import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/* ── what is banned, and as which utility ────────────────────────────── */

/**
 * A literal is banned as a surface, text, border, ring or divide. It is NOT
 * banned as a fill — see ALLOWED below. Keyed by the colour, valued by the
 * prefixes that make it ink rather than fill.
 */
const BANNED: Record<string, string[]> = {
  obsidian: ["bg", "text", "border", "divide", "ring-offset"],
  graphite: ["bg", "text", "border", "divide", "ring-offset"],
  iron: ["bg", "text", "border", "divide", "ring-offset"],
  chalk: ["bg", "text", "border", "divide", "ring-offset"],
  ash: ["bg", "text", "border", "divide", "ring-offset"],
  bone: ["bg", "text", "border", "divide", "ring-offset"],
  midnight: ["bg", "text", "border", "divide", "ring-offset"],
  // The accent family: ink only. `bg-` is the fill half and stays.
  voltage: ["text", "border", "ring", "divide"],
  mint: ["text", "border", "ring", "divide"],
  ember: ["text", "border", "ring", "divide"],
  sky: ["text", "border", "ring", "divide"],
  forest: ["text", "border", "ring", "divide"],
}

/**
 * Allowed, and why each one is.
 *
 *   bg-voltage / bg-mint / bg-ember / bg-sky  the fill half of the accent
 *     rule: the same colour in both themes, always carrying Obsidian text
 *     (17.3 / 14.7 / 6.0 / 8.8 to 1).
 *   bg-voltage-dark  the hover on a Voltage fill.
 *   text-obsidian    the text that sits on one of those fills.
 *   accent-voltage   the native checkbox accent-color, not a Tailwind colour.
 *   bg-black         drawer and tour scrims, which are dark on both themes on
 *                    purpose and carry a ponytail: comment saying so.
 */
const ALLOWED = [
  /\bbg-voltage-dark\b/,
  /\bbg-(voltage|mint|ember|sky)(\/\[?[\d.]+%?\]?)?\b/,
  /\btext-obsidian\b/,
  /\baccent-voltage\b/,
  /\bbg-black(\/\d+)?\b/,
]

/** Files that define the tokens, or that no theme reaches. */
const SKIP_FILES = [
  "globals.css",
  // Email clients do not honour a site's theme, and those templates are
  // already dark-on-dark by choice.
  `${"emails"}/`,
]

const ROOTS = ["app", "components"]
const EXTS = [".tsx", ".ts"]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXTS.some((e) => full.endsWith(e))) out.push(full)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(r)).filter(
  (f) => !SKIP_FILES.some((s) => f.replace(/\\/g, "/").includes(s)),
)

assert.ok(files.length > 100, `expected to scan the app, found ${files.length} files`)

/* ── the scan ────────────────────────────────────────────────────────── */

const offences: string[] = []

for (const file of files) {
  const source = readFileSync(file, "utf8")

  source.split("\n").forEach((line, i) => {
    // A line that has opted out explicitly, with a reason, is not an offence.
    if (line.includes("ponytail:")) return

    for (const [colour, prefixes] of Object.entries(BANNED)) {
      for (const prefix of prefixes) {
        // Not preceded by a word char or hyphen, so `bg-voltage` does not
        // match inside `bg-voltage-dark`, and not followed by one either.
        const re = new RegExp(`(?<![\\w-])${prefix}-${colour}(?![\\w-])`, "g")
        for (const hit of line.matchAll(re)) {
          const text = hit[0]
          if (ALLOWED.some((a) => a.test(text))) continue
          offences.push(`${file}:${i + 1}  ${text}`)
        }
      }
    }
  })
}

assert.deepEqual(
  offences,
  [],
  `literal palette tokens used as surface, text, border or ring:\n  ${offences.join("\n  ")}\n` +
    `\nUse the semantic token instead — surface, surface-raised, ink, ink-muted,\n` +
    `line, accent-ink, danger-ink, success-ink, info-ink. A fill keeps the\n` +
    `literal; ink never does.`,
)

/* ── vocabulary from a design system that is not ours ────────────────── */

// A class naming a token that does not exist compiles to nothing, so it fails
// silently and looks fine in review. Two components were written against
// Material Design names — surface-variant, error-container, outline-variant,
// secondary — and had been rendering unstyled for months because Tailwind has
// no way to warn about a colour it has never heard of.
//
// A tripwire, not a proof: it catches the vocabulary that actually leaked in
// rather than validating every class against the token list, which would mean
// an allowlist of every Tailwind keyword and a stream of false positives. If a
// third system's names ever appear, add them here.
const FOREIGN = [
  "surface-variant",
  "surface-container",
  "on-surface",
  "on-primary",
  "outline-variant",
  "error-container",
  "primary-container",
  "secondary-container",
  "inverse-surface",
]

const foreign: string[] = []
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const name of FOREIGN) {
        const re = new RegExp(
          `(?<![\\w-])(bg|text|border|ring|divide|fill|stroke)-${name}(?![\\w-])`,
        )
        if (re.test(line)) foreign.push(`${file}:${i + 1}  ${name}`)
      }
    })
}

assert.deepEqual(
  foreign,
  [],
  "classes naming tokens this codebase does not define — they compile to " +
    `nothing:\n  ${foreign.join("\n  ")}`,
)

/* ── the attribute is set once, and in the right place ───────────────── */

const setsTheme = files.filter((f) =>
  readFileSync(f, "utf8").split("\n").some(
    (l) => l.includes("data-theme=") && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"),
  ),
)

assert.deepEqual(
  setsTheme.map((f) => f.replace(/\\/g, "/")),
  ["app/layout.tsx"],
  "data-theme belongs on <html> in the root layout and nowhere else — two " +
    "nested attributes agreeing is harmless until the day they disagree",
)

console.log(`tokens.test.mts — ${files.length} files clean`)
