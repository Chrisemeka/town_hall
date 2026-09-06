// Where a global-search result opens, per account type.
//
// Separate from the component so scripts/access.test.mts can cross every href
// this produces against accessFor() — the bug it exists to prevent was a search
// that always pointed at /dashboard, so a tester clicking any result was
// bounced straight to /explore by the very gate that test covers.
//
// Relative and extensioned like lib/access.ts, for the same reason: the test
// runs under plain node, which resolves neither the "@/" alias nor an
// extensionless specifier.
import type { AccountType } from "./access.ts"

export type SearchTarget =
  | { kind: "project"; id: string }
  | { kind: "mission"; id: string; projectId: string }

export function searchHref(account: AccountType, target: SearchTarget): string {
  if (account === "tester") {
    return target.kind === "project" ? `/explore/project/${target.id}` : `/mission/${target.id}`
  }
  return target.kind === "project"
    ? `/dashboard/${target.id}`
    : `/dashboard/${target.projectId}/mission/${target.id}`
}
