// Asserts a builder is never sent who tested. Run with: npm test
// (node strips the types, no test framework needed)
//
// The leak this guards against is invisible on screen. The mission page once
// read `test_results` with select("*") and handed each row to a client
// component, so every tester_id rode to the builder's browser in the RSC
// payload — nothing rendered it, and devtools showed it. A screenshot review
// will never catch the next one; a string match will.
//
// Blunt string-matching, in the spirit of scripts/tokens.test.mts. Admin is
// exempt by design: admins pay the cohort and need real identity.

import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, sep } from "node:path"

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : walk(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/**
 * Source with comments removed — the warnings written beside the fix name the
 * very things banned here. Block comments, and line comments that start a line;
 * a trailing one is left alone so a URL in a string survives.
 */
const code = (f: string) =>
  readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const isAdmin = (f: string) =>
  f.includes(`${sep}(admin)${sep}`) || f.includes(`${sep}admin${sep}`)

/** Every surface a builder can reach, or whose output a builder receives. */
const BUILDER_FACING = [
  ...walk(join("app", "(developer)")),
  ...walk("components").filter((f) => !isAdmin(f)),
  ...walk(join("app", "api", "export")),
  ...walk("emails"),
]

/**
 * The only tester_id on a builder surface, and why it is safe: /settings
 * counts the caller's OWN reports, filtering on their own id, server-side.
 */
const ALLOWED_TESTER_ID = [/admin\.from\("test_results"\)\.select\("status, rating"\)\.eq\("tester_id", user\.id\)/]

let failures = 0
function check(label: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (e) {
    failures++
    console.error(`  ✗ ${label}\n    ${(e as Error).message.split("\n").join("\n    ")}`)
  }
}

console.log("anonymity")

check("no builder-facing file names tester_id", () => {
  const hits: string[] = []
  for (const f of BUILDER_FACING) {
    code(f).split("\n").forEach((line) => {
      if (line.includes("tester_id") && !ALLOWED_TESTER_ID.some((re) => re.test(line))) {
        hits.push(`${f}  ${line.trim()}`)
      }
    })
  }
  assert.deepEqual(hits, [], "tester identity reached a builder surface")
})

check("no builder-facing file names testerName", () => {
  const hits = BUILDER_FACING.filter((f) => code(f).includes("testerName"))
  assert.deepEqual(hits, [])
})

check("nothing outside admin wildcards test_results or projects", () => {
  // A wildcard on a table with a person foreign key is the shape of this bug:
  // test_results.tester_id, projects.owner_id and projects.flagged_by.
  const WILDCARD = [
    /from\("test_results"\)\s*\.select\(\s*["'`][^"'`]*\*/,
    /from\("projects"\)\s*\.select\(\s*["'`][^"'`]*\*/,
    /\bprojects(!inner)?\s*\(\s*\*\s*\)/,
  ]
  const files = [...walk("app"), ...walk("components"), ...walk("lib"), ...walk("actions")]
    .filter((f) => !isAdmin(f))
  const hits = files.filter((f) => {
    const src = code(f)
    return WILDCARD.some((re) => re.test(src))
  })
  assert.deepEqual(hits, [])
})

check("the guard actually matches the bug it was written for", () => {
  // A scan that matches nothing passes forever.
  assert.ok(/from\("test_results"\)\s*\.select\(\s*["'`][^"'`]*\*/.test(
    `from("test_results")\n      .select("*, missions!inner(title, project_id)")`,
  ))
  assert.ok(/\bprojects(!inner)?\s*\(\s*\*\s*\)/.test(`select("*, projects(*)")`))
})

if (failures) {
  console.error(`\n${failures} failed`)
  process.exit(1)
}
