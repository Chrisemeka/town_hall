import "server-only"

// Plan codes differ between test and live mode: Preview and local use test
// plans, Production uses live ones. That's why they're env vars, not constants.

export const paystackKey = (): string => process.env.PAYSTACK_SECRET_KEY ?? ""

export function planCodeFor(planId: "starter" | "pro"): string {
  return (planId === "starter" ? process.env.PAYSTACK_PLAN_STARTER : process.env.PAYSTACK_PLAN_PRO) ?? ""
}

export function planIdForCode(code: string | null): "starter" | "pro" | null {
  if (!code) return null
  if (code === process.env.PAYSTACK_PLAN_STARTER) return "starter"
  if (code === process.env.PAYSTACK_PLAN_PRO) return "pro"
  return null
}

/** Shown in Settings, so nobody on a preview mistakes it for the real thing. */
export const paystackTestMode = (): boolean => paystackKey().startsWith("sk_test_")

export function paystackConfigured(): boolean {
  return Boolean(paystackKey() && planCodeFor("starter") && planCodeFor("pro"))
}

/**
 * Paystack's collection limit for a Starter Business, an account not yet
 * registered with CAC (docs/Twnhall_Paystack_MSA_Review.md, "Not CAC-registered").
 * Past it Paystack stops taking payments and every renewal fails. Checked
 * against the pre-approval on 4 Nov 2026; re-check Paystack's support article
 * on Starter Business limits before relying on it.
 */
export const STARTER_BUSINESS_CAP_NGN = 8_000_000
