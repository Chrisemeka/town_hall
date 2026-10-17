import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/*
 * A loading.tsx covers its own segment and every nested one without its own,
 * so a page added without a skeleton silently shows its parent's — which is
 * how ten app pages ended up showing My Projects' project cards while they
 * loaded. Every page in the app shell mirrors its own first paint.
 */
const GROUPS = ["app/(developer)", "app/(tester)"]

// A page with a real reason to show its parent's skeleton, and that reason.
// Expect none.
const ALLOWED = new Set<string>([])

function pageDirs(dir: string): string[] {
  const here = existsSync(join(dir, "page.tsx")) ? [dir] : []
  return here.concat(
    readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "__tests__")
      .flatMap((d) => pageDirs(join(dir, d.name))),
  )
}

describe("loading coverage", () => {
  const dirs = GROUPS.flatMap(pageDirs).map((d) => d.replaceAll("\\", "/"))

  it("finds the app pages", () => {
    expect(dirs.length).toBeGreaterThan(10)
  })

  it.each(dirs)("%s has its own loading.tsx", (dir) => {
    expect(
      ALLOWED.has(dir) || existsSync(join(dir, "loading.tsx")),
      `${dir} has a page.tsx but no loading.tsx of its own — it would inherit its parent's skeleton (or none). Add one that mirrors the page.`,
    ).toBe(true)
  })
})
