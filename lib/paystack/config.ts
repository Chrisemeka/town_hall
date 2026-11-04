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

export function paystackConfigured(): boolean {
  return Boolean(paystackKey() && planCodeFor("starter") && planCodeFor("pro"))
}
