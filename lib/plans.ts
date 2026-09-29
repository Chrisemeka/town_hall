// The two tiers, as content.
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

import type { PlanId } from "@/lib/vocabulary"

export type Plan = {
  id: PlanId
  name: string
  /** What it costs, as a line rather than a number — there is no checkout. */
  price: string
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
    price: "Free",
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
  pro: {
    id: "pro",
    name: "Pro",
    // The naira figure is a range on purpose: the plan flags its ₦1,400/$1
    // rate as months old, and a range does not go stale the way a computed
    // figure does.
    price: "$19/month · ₦10–12k",
    summary:
      "For teams with nobody to spare for testing — usually an agency, or a founder on their own.",
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

export function planFor(id: PlanId): Plan {
  return PLANS[id]
}

/** The tier someone is not on, which is the one worth describing to them. */
export function otherPlan(id: PlanId): Plan {
  return PLANS[id === "pro" ? "community" : "pro"]
}
