// Fixed costs and the exchange rate, written by hand with the date they were
// checked — the same rule as the prices in lib/plans.ts. A silently wrong
// constant is worse than an obviously old one: re-check when the date is old.

/** Infra, per month (compensation doc §11). Checked 22 October 2026. */
export const INFRA_USD_MONTHLY = 76

/**
 * ₦ per $1, checked 22 October 2026 (compensation doc, FX basis). Shown beside
 * every converted figure. Revisit pricing if it moves more than 10% (§7.6).
 */
export const FX = { ngnPerUsd: 1350, checked: "22 Oct 2026" } as const

export const usdToNgn = (usd: number) => usd * FX.ngnPerUsd

/**
 * Cash in the bank, ₦, for runway. Null until someone writes the figure in
 * with the date — the page says so rather than inventing a runway.
 */
export const CASH_ON_HAND: { ngn: number; checked: string } | null = null
