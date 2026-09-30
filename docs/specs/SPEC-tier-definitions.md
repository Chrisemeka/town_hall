# SPEC: Tier Definitions

**Status:** Implemented on `feat/tier-definitions`
**Branch:** `feat/tier-definitions`
**Base:** `main` (at `2aaf99b`, which includes `fix/account-switch-choose-account-phone`)
**Depends on:** Nothing.
**Blocks:** `feat/report-allowance` (PR 2) reads the numbers this PR puts in `lib/plans.ts`.
**Source:** `docs/TWNHALL_ALLOWANCE_COHORT_PROMPT.md`, PR 1; numbers from
`docs/Twnhall_Cohort_Compensation_Model.md` §7 and §8
**Migration:** none
**Risk:** none — copy only. Nothing is enforced before or after this PR.

## Summary

`lib/plans.ts` and `/pricing` still describe the v4 offer. This PR moves both to
the cohort-model numbers — Pro 10 reports a month and up to 5 testers, Community
3 reports to start then +1 per report written — and makes the two surfaces read
one source so they cannot drift again.

## The finding that changes the brief

The brief says the pricing page and the settings Plan tab "read the same
source". **They do not.** `components/settings/PlanSection.tsx` reads
`PLANS[...].includes` from `lib/plans.ts`; `app/(public)/pricing/page.tsx`
carries its own copy of every number — the `metadata.description`, the two tier
cards' blurbs and the `ROWS` comparison table. Today they happen to agree. A
snapshot test over `lib/plans.ts` would pass while `/pricing` still said 20.

So the numbers move into `lib/plans.ts` as data, and `/pricing` renders from it.

## Non-goals

- No enforcement. No counter, no balance, no ceiling. That is PR 2.
- No change to the price. $19 / ₦10–12k stays.
- No change to AI insights, CSV export or active-mission counts.
- No change to `PlanSection`'s layout or its `/contact` call to action.

## §1 — `lib/plans.ts`

Add the numbers as fields, next to the copy that states them:

```ts
export type Plan = {
  id: PlanId
  name: string
  price: string
  summary: string
  /** Reports that arrive each calendar month. 0 on Community. */
  monthlyReports: number
  testersPerMission: number
  activeMissions: number
  includes: readonly string[]
}

/** One-time, per profile. Content here; PR 2 is what grants it. */
export const SIGNUP_GRANT = 3
```

`includes` stays hand-written strings — copy the team edits — and a test (§4)
holds each line to the number beside it.

### 1.1 — Pro

| Field | From | To |
|---|---|---|
| Price | `$19/month · ₦10–12k` | unchanged |
| Tester reports | 20 a month | **10 a month** |
| Testers per mission | Up to 8 | **Up to 5** |
| Active missions | 5 | unchanged |
| Priority in the tester queue | listed | **removed** — no queue exists |
| Shareable formatted report | listed | **removed** — see below |

### 1.2 — Community

| Field | From | To |
|---|---|---|
| Tester reports | 5 a month | **3 reports to get you started** |
| Earned | +1 per report you write as a tester | unchanged (Pro keeps it too) |
| Testers per mission | Up to 5 | unchanged |
| Active missions | 2 | unchanged |

### 1.3 — Also removed: "Shareable formatted report"

Not in the brief. Compensation doc §7 still names it as a Pro differentiator,
so this is not a product decision to drop it — it is that **nothing builds it
yet**. The only two hits for it are `lib/plans.ts` and `/pricing`, and the
pricing page's own rule is "nothing unshipped is listed". It comes off here and
goes back on in the PR that ships it (`feat/shareable-report`, its own spec,
after PR 2 — gating it to Pro reads `plan_id`, which is tier enforcement).

"Priority in the tester queue" is the same case with a longer road: it needs
the invitation model (compensation doc §4), which is deferred. Removed here per
the brief and doc §7's first option.

### 1.4 — The header warning

Stays, reworded to name the branch that retires it:

> NOTHING HERE IS ENFORCED — until `feat/report-allowance` lands. […] That
> branch deletes this paragraph and replaces it with a pointer to
> `lib/allowance.ts`.

## §2 — `/pricing`

- `ROWS` is built from `PLANS` for the three numeric rows. Row changes:
  - "Tester reports per month" → **"Tester reports"**: Community
    `"3 to start"`, Pro `"10 a month"`.
  - "Earn extra reports by testing" — unchanged.
  - "Testers per mission" → `Up to ${testersPerMission}` for each.
  - "Shareable report" and "Priority in the tester queue" rows removed.
- Community card: *"Three tester reports to get you started, then one more for
  every report you write as a tester."*
- Pro card: *"Ten tester reports a month — two full rounds of five testers."*
  (Replaces the tester-queue sentence.)
- `metadata.description`: *"Community is free: three tester reports to start,
  and one more for every report you write. Pro is $19/month for ten a month."*
- The "Why five testers" section stands; it is now also why Pro is five.
- The file's header comment gets the same "until `feat/report-allowance`" edit.

`PlanSection.tsx` needs no change — it already renders `includes`. Its
"Hitting your limit" line stays; there is still nothing to hit until PR 2.

## §3 — Other stale copies

`lib/settingsTabs.ts:28` quotes "5 tester reports a month" as an example in a
comment; it becomes "10 tester reports a month". The historical specs
and prompts in `docs/` are left alone — they record what was decided at the time.

## §4 — Tests

**`lib/__tests__/plans.test.ts`** (new)

| Assertion | Why |
|---|---|
| Pro: 10 monthly, 5 per mission, 5 active; Community: 0, 5, 2; `SIGNUP_GRANT` 3 | the numbers, directly |
| every `includes` line naming a count agrees with the numeric field | the strings cannot drift from the data |
| no plan's `includes` mentions "priority" or "queue" | the removed promise stays removed |
| `planFor` / `otherPlan` unchanged | regression |

The pricing rows are derived from `PLANS`, so they are covered by construction
rather than by rendering a server component that imports `signInWithGoogle`.

## §5 — Files

**New**
```
lib/__tests__/plans.test.ts
docs/specs/SPEC-tier-definitions.md
```

**Edited**
```
lib/plans.ts                     numbers as fields, new copy, header reworded
app/(public)/pricing/page.tsx    render from PLANS; new copy
lib/settingsTabs.ts              one example number in a comment
CLAUDE.md                        lib/plans.ts's source is the compensation doc
```

## Acceptance criteria

1. `/pricing` and `/settings?tab=plan` show Pro 10/month, up to 5 testers;
   Community 3 to start, +1 earned.
2. No surface mentions a tester queue.
3. `/pricing`'s numbers come from `lib/plans.ts`.
4. Header warnings still say nothing is enforced, naming `feat/report-allowance`.
5. `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

## Commit sequence

1. `docs(spec): tier definitions`
2. `feat(plans): move tiers to the cohort-model numbers`
3. `feat(pricing): render tier numbers from lib/plans`
4. `test(plans): hold copy to the numbers it states`
5. `docs: point CLAUDE.md at the compensation model`

## Notes for PR 2 and PR 3 (not in scope here)

- **Compensation doc §5 vs the brief's §2.5.** The doc says a mission "cannot
  be staffed below" five testers; the brief caps a Community publish to as few
  as the balance allows (e.g. 3). PR 2's spec has to pick one — likely the
  brief, since the doc's floor is about cohort staffing, not reciprocity.
- **PR 3 §3.5 is mostly built.** `setUserPlan` (`actions/admin/users.ts`) and
  `components/admin/UserPlanControl.tsx` already set and clear `plan_id`, with
  tests. What is missing is the "who changed what and when" log. PR 3 shrinks
  to adding that.
- **Shadow metering is implemented**, on `feat/ai-shadow-metering`, not yet
  merged. The brief calls it unimplemented; it is not a dependency either way.
