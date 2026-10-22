// The three tiers, as content.
//
// Static TypeScript rather than a table, the same reasoning as
// lib/testTemplates.ts: this is copy the team edits, not user data, and a
// table would mean a migration every time a line changes.
//
// Source: docs/Twnhall_Cohort_Compensation_Model.md §7 and §8, which supersede
// the monetisation plan v4's tier table. app/(public)/pricing/page.tsx renders
// its numbers from this file too, so the settings page and the pricing page
// cannot disagree about what Pro includes.
//
// ENFORCED at publish, by lib/allowance.ts (the arithmetic) and
// lib/allowanceDb.ts (the ledger): monthlyReports, testersPerMission,
// activeMissions and SIGNUP_GRANT are read there. Never at submission — see
// CLAUDE.md. The AI-insight line is still content only; nothing counts it.
//
// PRICES: naira first, dollar beside it, both written by hand. FX at the time
// of writing: ₦1,350 = $1, checked 22 October 2026 (compensation doc, FX
// basis). Never convert one into the other at render — a page that computes a
// price from a hardcoded rate is wrong a different way every time the rate
// moves. Check the pair by hand instead: "$19/month · ₦10–12k" sat on
// /pricing quoting less than half the dollar price. Revisit both if the rate
// moves more than 10% (§7.6).

import { PLAN_IDS, type PlanId } from "@/lib/vocabulary"

export type Plan = {
  id: PlanId
  name: string
  /** Per month, as written — there is no checkout. null on Community, which is free. */
  price: { naira: string; dollars: string } | null
  summary: string
  /** Reports that arrive each calendar month. 0 on Community. */
  monthlyReports: number
  testersPerMission: number
  activeMissions: number
  /** The tier's lines, in order. lib/__tests__/plans.test.ts holds them to the numbers above. */
  includes: readonly string[]
}

/** Reports every new profile starts with, once. Granted in createAccount; the ledger's unique index makes it once. */
export const SIGNUP_GRANT = 3

export const PLANS: Record<PlanId, Plan> = {
  community: {
    id: "community",
    name: "Community",
    price: null,
    summary:
      "For builders who test as well as ship. Everything you need, paid for by taking part.",
    monthlyReports: 0,
    testersPerMission: 5,
    activeMissions: 2,
    includes: [
      "Unlimited projects",
      "3 tester reports to get you started",
      "+1 report for every report you write as a tester",
      "Up to 5 testers on a mission",
      "2 active missions at once",
      "3 AI insights a month",
      "CSV export",
    ],
  },
  // Starter and Pro carry the same price per report on purpose — the tenth
  // report costs the cohort exactly what the first does, so there is no
  // volume discount and no "best value" (compensation doc §7.3). They differ
  // in size: one test round a month, or two.
  starter: {
    id: "starter",
    name: "Starter",
    price: { naira: "₦15,000", dollars: "~$11" },
    summary:
      "For a solo founder or a small team shipping steadily. One proper round of testing a month, five people on what you built.",
    monthlyReports: 5,
    testersPerMission: 5,
    activeMissions: 3,
    includes: [
      "Unlimited projects",
      "5 tester reports a month",
      "+1 report for every report you write as a tester",
      "Up to 5 testers on a mission",
      "3 active missions at once",
      "Unlimited AI insights",
      "CSV export",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: { naira: "₦30,000", dollars: "~$22" },
    summary:
      "For teams shipping every week, usually an agency. Two full rounds a month: test, fix, then test the fix.",
    monthlyReports: 10,
    testersPerMission: 5,
    activeMissions: 5,
    // No "shareable report" and no "priority in the tester queue": neither
    // exists, and a pricing line is a promise. feat/shareable-report puts the
    // first back when it ships; the second waits on the invitation model
    // (compensation doc §4).
    includes: [
      "Unlimited projects",
      "10 tester reports a month",
      "+1 report for every report you write as a tester",
      "Up to 5 testers on a mission",
      "5 active missions at once",
      "Unlimited AI insights",
      "CSV export",
    ],
  },
}

/** "₦30,000 / month · ~$22", or "Free". */
export function priceLine(plan: Plan): string {
  return plan.price ? `${plan.price.naira} / month · ${plan.price.dollars}` : "Free"
}

export function planFor(id: PlanId): Plan {
  return PLANS[id]
}

/** The tiers someone is not on, cheapest first — the ones worth describing to them. */
export function otherPlans(id: PlanId): Plan[] {
  return PLAN_IDS.filter((p) => p !== id).map((p) => PLANS[p])
}
