# SPEC: Three Tiers — Starter, and the Naira Price Fix

**Status:** Implemented on `feat/starter-tier`
**Branch:** `feat/starter-tier` (stacked on `fix/pdf-screenshots`, not yet merged)
**Source:** `docs/TWNHALL_THREE_TIERS_PROMPT.md`; numbers from
`docs/Twnhall_Cohort_Compensation_Model.md` §7.1 (revision of 22 October 2026)
**Migration:** none — confirmed below
**Risk:** low–medium. `lib/plans.ts` feeds the allowance, so a wrong
`monthlyReports` gives away paid cohort supply; it is asserted per tier.

## Summary

Community (free), **Starter** (₦15,000 · ~$11, 5 reports a month), Pro
(₦30,000 · ~$22, 10 reports). Pro was "$19/month · ₦10–12k" — the naira half
quoted less than half the dollar price ($19 at ₦1,350 = ₦25,650). That fix is
commit 1 on its own.

| Tier | Price | `monthlyReports` | `testersPerMission` | `activeMissions` |
|---|---|---|---|---|
| Community | Free | 0 (grant 3 + earned) | 5 | 2 |
| Starter | ₦15,000 · ~$11 | 5 | 5 | 3 |
| Pro | ₦30,000 · ~$22 | 10 | 5 | 5 |

## Findings reported before editing

**Migration.** `accounts.plan_id` is `text`, nullable, no CHECK — in
`20260924_01` and untouched by any later migration (`set_account_field` in
`20261001_01` writes `p_value` as given). `planIdSchema` (`z.enum(PLAN_IDS)`)
is the only gate, so adding `starter` to `PLAN_IDS` is the whole change.

**Existing Pro accounts.** `accounts` on 2026-10-22: `pro` 0, `starter` 0,
`community` 0, `null` 55. Nobody was sold Pro at $19, so nobody is repriced.

**Naira figures in the app.** Only `lib/plans.ts` quoted a price. Other `₦`
uses are the admin payout sheet (`/admin/payouts`, cohort pay — not a price), a
comment in `lib/payouts.ts`/`lib/allowance.ts`, and the PDF font note. No email
or guide quotes a price; `emails/` and the welcome copy in `lib/setup.ts` never
name a plan.

**Two-plan assumptions.**

| Where | What assumed two | Now |
|---|---|---|
| `lib/plans.ts` `otherPlan()` | `id === "pro" ? community : pro` | `otherPlans()` — every tier you are not on, cheapest first |
| `components/settings/PlanSection.tsx` | one "other" card; `planId === "pro"` for the contact line | your plan first (full width), the other two after; `!== "community"` |
| `components/admin/UserPlanControl.tsx` | option label `id === "pro" ? "Pro" : "Community"` | `planFor(id).name` |
| `app/(admin)/admin/users/page.tsx` | change-log label, same ternary | `planFor(planIdFor(v)).name` |
| `app/(public)/pricing/page.tsx` | two cards, two-value `ROWS`, two-column compare, `featured` Pro, price parsed by splitting a string | `TIERS` from `PLAN_IDS`, `ROWS.values[]`, three columns, nothing featured, price read as written |
| `AllowanceNotice`, `/contact`, `/about`, `/terms`, `/privacy` | "Pro" as the only paid plan | "Starter or Pro" |

## Price storage

`Plan.price: { naira, dollars } | null` — both written by hand, null on
Community. The rate (₦1,350 = $1) and the date it was checked sit in a comment
at the top of `lib/plans.ts`. `priceLine()` prints "₦30,000 / month · ~$22";
the pricing card shows the naira figure large and the dollar in the note.
Nothing converts a currency, and `pricing.test.ts` fails on a price literal in
the page source.

## Layout — 360px to desktop

- **/pricing cards:** stacked below 1024 in a 560px column, cheapest first, so
  on a phone the order is the reading order and nothing scrolls sideways.
  Three across from `lg`. At 840 three cards would be ~250px each.
- **Compare plans:** below 840 a list — the feature, then one `dl` row per plan
  (name left, value right). From 840 the four-column table (`min-w-[640px]`,
  still inside `overflow-x-auto`).
- **Settings → Plan:** "Your plan" is always the first card and spans the row;
  the other two follow, stacked below 1024, side by side from it.
- **Motion:** the existing `Reveal` (Design.md §9, page reveal) — the three
  cards are steps 0, 1, 2 and the "no checkout" line step 3. No new motion.

## Copy decisions

- Starter's summary is written for a solo founder or small team shipping
  steadily, one round a month; Pro's for teams shipping weekly — two rounds,
  test, fix, then test the fix.
- No featured tier and no "best value": both cost ₦3,000 a report (§7.3). The
  Pro card lost its accent border for the same reason.
- Starter lists "Unlimited AI insights", like Pro. The AI-insight line is
  content only on every tier and the doc does not set a Starter figure.
- Calls to action: "Ask about Starter" / "Ask about Pro" → `/contact`.

## Tests

- `allowance.test.ts` — plan_id `null`/`community`/`starter`/`pro` → monthly 0/0/5/10.
- `allowanceDb.test.ts` — Starter publishes 5, then the next publish is `empty`;
  Starter refused at 3 active missions.
- `plans.test.ts` — numbers, prices, equal price per report, `otherPlans()`.
- `pricing.test.ts` — three tiers in order, prices exactly as written, no price
  literal in the page, no "best value"; `PlanSection` on each tier.
- `admin-users.test.ts` — Starter written by id; Community still null.
- `vocabulary.test.mts` — `planIdFor("starter")`.

## Out of scope

Checkout, overage pricing, Community's grant, enforcing AI insights.
