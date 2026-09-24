// What a person has given and what they have taken.
//
// Pure and import-free, in the shape of lib/access.ts and lib/review.ts: the
// arithmetic is the part worth testing, and it should be testable without a
// database or a browser.
//
// The monetisation plan calls the give/take ratio the highest-leverage number
// in the business and notes that nothing measures it. This is what measures it.
//
// Nothing here is a budget or an allowance. There is no monthly report count
// and no earned-report balance, because neither is enforced anywhere and a
// number that looks like an allowance — on a page that has a plan section next
// to it — will be read as one.

/** Counts, straight from `test_results`. */
export type ReciprocityInput = {
  /** Submissions this person wrote as a tester. */
  given: number
  /** Submissions received on missions belonging to their projects. */
  received: number
  /** Of `given`, how many the builder approved. */
  approved: number
  /** Every rating on their own submissions, nulls included. */
  ratings: (number | null)[]
}

export type Reciprocity = {
  given: number
  received: number
  approved: number
  /** null when there is nothing to divide by — render as "—", never as 0. */
  ratio: number | null
  /** null when nothing has been rated — render as "—", never as 0.0. */
  rating: number | null
  /** True when this person has neither given nor received anything. */
  empty: boolean
}

/**
 * Average of the ratings that exist. Null when nothing has been rated yet —
 * which must render as "—", never as 0.0, or an unrated tester looks terrible.
 *
 * Recovered verbatim from lib/tester.ts, which 846414a deleted along with the
 * earnings panel everything in that file existed for. The comment above came
 * with it: it is the lesson, not decoration.
 */
export function averageRating(ratings: (number | null)[]): number | null {
  const rated = ratings.filter((r): r is number => typeof r === "number")
  if (rated.length === 0) return null
  return rated.reduce((a, b) => a + b, 0) / rated.length
}

/**
 * Given divided by received.
 *
 * **Null when received is 0, not Infinity.** Someone who has written six
 * reports and received none has not achieved an infinite ratio; the question
 * does not have an answer yet. Same lesson as averageRating, and the same
 * rendering: "—".
 */
export function giveTakeRatio(given: number, received: number): number | null {
  if (received <= 0) return null
  return given / received
}

export function reciprocityFrom(input: ReciprocityInput): Reciprocity {
  const { given, received, approved, ratings } = input
  return {
    given,
    received,
    approved,
    ratio: giveTakeRatio(given, received),
    rating: averageRating(ratings),
    // Nothing given and nothing received is a new account, not a score of
    // zero. The section shows an empty state rather than a wall of noughts.
    empty: given === 0 && received === 0,
  }
}

/* ── rendering ───────────────────────────────────────────────────────── */

/** The one string an absent number renders as, everywhere. */
export const NO_VALUE = "—"

export function formatRatio(ratio: number | null): string {
  return ratio === null ? NO_VALUE : ratio.toFixed(1)
}

export function formatRating(rating: number | null): string {
  return rating === null ? NO_VALUE : `${rating.toFixed(1)} / 5`
}

/**
 * One line saying what the ratio means, because a bare number does not.
 *
 * Deliberately not a judgement. "0.4" is not a failing grade — a builder who
 * has received more than they have given is exactly who the paid tier is for,
 * and the copy should not make them feel caught.
 */
export function ratioCaption(r: Reciprocity): string {
  if (r.ratio === null) {
    return r.given > 0
      ? "You've tested for others. Nothing has come back on your own work yet."
      : "This fills in once you've given or received a report."
  }
  if (r.ratio >= 1) return "You've given at least as much as you've taken."
  return "You've received more than you've given. Testing for someone else evens it up."
}
