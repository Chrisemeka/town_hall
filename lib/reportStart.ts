import "server-only"

import { sign, verifySigned } from "@/lib/signing"

// The start token: proof that a tester was shown the report form while the
// test case was live. /mission/[id] issues one only when it renders the form
// for a live test case; submitTestResult reads it when the test case has since
// closed, so a tester who was mid-test when the last slot filled still gets
// their report in (spec decision 1). Someone who opens the page after the
// close sees the panel and never gets a token.

const PURPOSE = "report-start:"

/** How long after closing a report already started still goes through (decision 2). */
export const CLOSED_GRACE = 24 * 60 * 60 * 1000

/** `<issuedAt ms>.<signature>`, bound to this mission and this tester. */
export function startToken(missionId: string, testerId: string, issuedAt = Date.now()): string {
  return `${issuedAt}.${sign(PURPOSE, `${missionId}:${testerId}:${issuedAt}`)}`
}

/** When the token was issued, or null if it isn't a good token for this mission and tester. */
export function verifyStartToken(token: unknown, missionId: string, testerId: string): number | null {
  if (typeof token !== "string") return null
  const [at, signature, ...rest] = token.split(".")
  if (rest.length || !/^\d{1,16}$/.test(at ?? "")) return null
  return verifySigned(PURPOSE, `${missionId}:${testerId}:${at}`, signature ?? "") ? Number(at) : null
}

/**
 * Whether a closed test case still takes this report. All three hold, or no:
 * a good token (issuedAt), issued before the close, arriving inside the grace.
 * closed_at null — closed before it was recorded, or a draft never published —
 * is no grace at all. A pause and a fill are the same rule (decision 3).
 */
export function graceAllows(issuedAt: number | null, closedAt: string | null, now = Date.now()): boolean {
  if (issuedAt === null || !closedAt) return false
  const closed = Date.parse(closedAt)
  return issuedAt < closed && now - closed <= CLOSED_GRACE
}
