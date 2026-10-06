// Which tester a report came from, as a number a builder can see.
//
// Pure and import-free, in the shape of lib/reciprocity.ts. A builder never
// sees who a tester is (CLAUDE.md, Tester anonymity) — but fifteen rows across
// three missions still need grouping, so each report gets its tester's number
// WITHIN ITS MISSION. "Tester 1" on mission A and "Tester 1" on mission B are
// different people, and nothing should imply otherwise.
//
// The mission page, the feedback list, the CSV export and (later) the shared
// report all number through this, so the same report has the same number on
// every surface.

export type NumberableReport = { id: string; mission_id: string; created_at: string }

/**
 * Report id → its tester's number on that mission, from 1, oldest first.
 *
 * One report per tester per mission (submit_audit_log, 20260930_02), so within
 * a mission a number is a person. Identical timestamps break on id ascending:
 * arbitrary, but fixed, so two reads of the same data give the same numbers.
 *
 * ponytail: a deleted submission renumbers the later ones on its mission.
 * Nothing deletes a single submission today; if that changes, store the number.
 */
export function testerNumbers(reports: readonly NumberableReport[]): Map<string, number> {
  const sorted = [...reports].sort(
    (a, b) => cmp(a.mission_id, b.mission_id) || cmp(a.created_at, b.created_at) || cmp(a.id, b.id),
  )
  const numbers = new Map<string, number>()
  let mission = ""
  let n = 0
  for (const r of sorted) {
    n = r.mission_id === mission ? n + 1 : 1
    mission = r.mission_id
    numbers.set(r.id, n)
  }
  return numbers
}

/**
 * Code-unit order, not localeCompare — the locale collator ignores "+" and ".",
 * which misorders "10:00:00+00:00" against "10:00:00.5+00:00". created_at
 * compares as text because PostgREST's timestamps share one offset and format,
 * and a Date would drop the microseconds that separate near-ties.
 */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** How a number reads on screen and in the CSV. */
export function testerLabel(n: number | undefined): string {
  return n ? `Tester ${n}` : "Tester"
}
