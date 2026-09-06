/**
 * A mission posted inside the last 24h gets the "new" flag on Tester Home.
 *
 * Lived in lib/tester.ts alongside the earnings and rank helpers until payments
 * were removed. It was the only thing in that file with nothing to do with
 * money or reputation, so it moved here rather than leaving a file called
 * "tester reputation and earnings" holding one date check.
 */
export function isNewMission(createdAt: string, now: number = Date.now()): boolean {
  return now - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000
}
