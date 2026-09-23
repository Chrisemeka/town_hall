// The two tiers, as content.
//
// Static TypeScript rather than a table, the same reasoning as
// lib/testTemplates.ts: this is copy the team edits, not user data, and a
// table would mean a migration every time a line changes.
//
// Source: docs/Twnhall_Monetisation_Plan_v4.docx §3 — the same source
// app/(public)/pricing/page.tsx renders, so the settings page and the pricing
// page cannot disagree about what Pro includes.
//
// NOTHING HERE IS ENFORCED. There is no report counter, no per-mission tester
// ceiling and no active-mission limit anywhere in the app. These lines
// describe the shape of the offer; `accounts.plan_id` records which one an
// account is on. If you are about to read a number here in order to block
// something, that is tier enforcement — separate work, with its own
// sequencing, and the migration comment on plan_id says the same thing.

import type { PlanId } from "@/lib/vocabulary"

export type Plan = {
  id: PlanId
  name: string
  /** What it costs, as a line rather than a number — there is no checkout. */
  price: string
  summary: string
  /** Verbatim from the plan's §3 table, in its order. */
  includes: readonly string[]
}

export const PLANS: Record<PlanId, Plan> = {
  community: {
    id: "community",
    name: "Community",
    price: "Free",
    summary:
      "For builders who test as well as ship. Everything you need, paid for by taking part.",
    includes: [
      "Unlimited projects",
      "5 tester reports a month",
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
    includes: [
      "Unlimited projects",
      "20 tester reports a month",
      "+1 report for every report you write as a tester",
      "Up to 8 testers on a mission",
      "5 active missions at once",
      "Unlimited AI insights",
      "CSV export",
      "Shareable formatted report",
      "Priority in the tester queue",
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
