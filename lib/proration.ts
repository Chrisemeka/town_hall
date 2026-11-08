// proration-v1 (SPEC-paystack-plan-changes §2.1), for the upgrade sheet's
// estimate only. The refund itself is computed by settle_upgrade in SQL and
// stored with every term; nothing here is ever sent to Paystack. Both are
// tested against the spec's table, and if they ever disagree the stored row wins.
//
// Pure, and the dates are Africa/Lagos through Intl — never the server's zone,
// never a fixed offset.

const LAGOS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" })

/** "2026-11-14": the calendar date of an instant in Africa/Lagos. */
export function lagosDay(instant: Date | string): string {
  return LAGOS_DAY.format(typeof instant === "string" ? new Date(instant) : instant)
}

/** Whole days from one "YYYY-MM-DD" to another. */
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

export type UpgradeRefund = { refundableDays: number; daysInPeriod: number; amountNgn: number }

/**
 * The unused Starter days after the upgrade day, at the daily rate paid, rounded
 * down. The period is [start, end): the end is the next billing date. An
 * upgrade day outside the period refunds nothing.
 */
export function upgradeRefund(input: { periodStart: string; periodEnd: string; upgradeAt: Date | string; baseNgn: number }): UpgradeRefund {
  const start = lagosDay(input.periodStart)
  const end = lagosDay(input.periodEnd)
  const on = lagosDay(input.upgradeAt)
  const daysInPeriod = daysBetween(start, end)
  if (daysInPeriod <= 0 || on < start || on >= end || input.baseNgn <= 0) return { refundableDays: 0, daysInPeriod, amountNgn: 0 }
  const refundableDays = daysBetween(on, end) - 1
  return { refundableDays, daysInPeriod, amountNgn: Math.floor((input.baseNgn * refundableDays) / daysInPeriod) }
}
