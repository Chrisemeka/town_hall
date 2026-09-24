# SPEC: Settings Sections and Sidebar Reorganisation

**Status:** Awaiting approval
**Branch:** `feat/settings-sections`
**Base:** `feat/dashboard-theme` — the doc says "main with PR 1 merged", but
nothing from Stage 3 is merged yet, so it keeps stacking
**Blocks:** `feat/feedback-export` (PR 3), which adds the fourth section
**Source:** `docs/TWNHALL_BUILDER_DASHBOARD_PROMPT.md` — PR 2
**Migration:** one, small
**Risk:** low-medium

## Summary

The sidebar's bottom section drops to three items and Sign out moves down into
it. What leaves goes into Settings, which grows from one form into four
sections: Profile, Give and take, Plan, Appearance. One migration —
`accounts.plan_id`, nullable, display and admin override only.

**Nothing is enforced.** No report counting, no mission caps, no blocked
actions. This PR records who is on which plan and shows it.

## Why they ship together

Items move *from* the sidebar *into* Settings. Split across two PRs there is an
intermediate state where "Add tester account" exists in neither place, and the
only way to add a role is to know the `/choose-account` URL.

## Non-goals

- **Tier enforcement of any kind.** §4 says this at length because it is the
  thing most likely to get half-built by accident.
- **The reputation panel.** `RANKS` and `rankFor` are recoverable from the same
  deleted file as `averageRating` (§3.4), and the monetisation plan calls a
  reputation-only panel its second most urgent item. It is not this PR — this
  PR surfaces the *numbers*, not ranks and badges.
- **A monthly report budget or earned-report balance.** Not countable today.
  §3.2.
- **Checkout.** Phase 3 in the plan, gated on builders asking to pay.
- **The tester dashboard's own revamp.** Out of scope for all of Stage 3.

## §1 — Sidebar and top nav

**The bottom section becomes exactly three items:** Settings, Replay page tour,
Sign out.

| Item | Today | After |
|---|---|---|
| Settings | sidebar | stays |
| Replay page tour | sidebar | stays |
| **Sign out** | `TopNav`, icon-only | **moves down into the sidebar** |
| **Switch to / Add tester account** | sidebar | → Settings, Profile (§2) |
| **How it works** | sidebar | → Settings (§1.2) |

`TopNav` keeps logo, search, the role's CTA and the avatar.

### 1.1 — The mobile path, which is the part that can go wrong

The sidebar collapses to a sheet on mobile, so **moving Sign out into it puts
logging out behind a menu that was not previously needed to leave.** Today
`TopNav` carries it at every width.

The QA checklist still has "back button reaches dashboard after logout"
outstanding. Making logout *harder to reach* while that is open is the wrong
order to do things in.

**So: Sign out moves into the sidebar's shared section — the one that renders
at every width — not into the desktop-only block.** Today the sidebar has two
blocks, `hidden md:block` and `md:hidden`, with Sign out duplicated into the
mobile one. After this it is one item in one place, reachable from the sheet on
mobile and the rail on desktop, and `TopNav` loses its copy. That is one
control, not three.

### 1.2 — "How it works" in Settings is worth questioning, not deciding silently

The brief moves it and then says to flag it. Flagging it:

**Settings is not where people look for documentation.** It is where they look
for their own account. A guide filed under Settings is a guide nobody opens.

Three options:

1. **Move it to Settings** as the brief says. Tidiest sidebar, least
   discoverable guide.
2. **Leave it in the sidebar.** Four items instead of three, and the brief's
   "exactly three" is not met.
3. **Move it to the public footer only** — where it already is, under Guides —
   and drop it from the app entirely. The link exists twice today.

**This spec builds (1)**, because it is what the brief asks and because option
3's argument ("it is already in the footer") is weaker than it sounds: the
footer is on the public site, and a signed-in builder on `/dashboard` never
sees it. But it is a judgement call about discoverability that wants an eye on
the rendered thing, so it is called out here rather than buried.

## §2 — Profile section

The existing `SettingsForm`, plus the account control that left the sidebar.

`SettingsForm` **already receives `hasTesterAccount`** — the data is there, only
the control is missing.

| State | Control | Action |
|---|---|---|
| Has a tester account | "Switch to tester account" | `switchAccount('tester')` |
| Does not | "Add tester account" | → `/choose-account` |

**The button copy has to say what happens next.** Adding a tester account lands
the user on `/verify/tester`, because `accounts.verification_completed_at` is
per-role and theirs is null. A button that says "Add tester account" and then
produces a profile form is a surprise; one that says *"you'll complete a short
tester profile first"* is not.

This is also the one place in the app where a builder can reach the tester side,
so it is not a decorative link.

## §3 — "Give and take"

**Named plainly.** Not "Reciprocity" — a word people have to translate. "Give
and take" describes the mechanic in the words a user would use.

### 3.1 — What it shows, all derivable today

| Metric | Source |
|---|---|
| Tests completed | `count(test_results where tester_id = me)` |
| Feedback received | `count(test_results)` joined `missions` → `projects where owner_id = me` |
| **Give / take ratio** | given ÷ received |
| Average rating | `avg(rating where tester_id = me and rating is not null)` |
| Approved submissions | the same count filtered to `status = 'approved'` |

**The ratio is the one that matters.** The monetisation plan calls it the
highest-leverage number in the business and notes that nothing measures it.
This section measures it — for the user, and for whoever is reading the
dashboard to decide what to build next.

### 3.2 — What it deliberately does not show

No monthly report budget, no earned-report balance. Both are tier enforcement,
sequenced as Phase 2 and gated on the tester cohort launching. A number that
looks like an allowance, on a page with a plan section next to it, will be read
as an allowance.

### 3.3 — Three edge cases, handled rather than discovered

- **No tester account.** A prompt to add one, not a wall of zeros. Someone who
  has never tested is not a tester with a score of nothing.
- **Received = 0.** The ratio is **undefined, not infinity**. Render `—`.
- **Nothing done at all.** A proper empty state, `DESIGN.md` §8.

`averageRating` carries the same rule and it is already written down in the
code being recovered: *"must render as '—', never as 0.0, or an unrated tester
looks terrible."*

### 3.4 — Recover, do not rewrite

`averageRating` was deleted in `846414a` ("take payment out of the review state
machine") along with the rest of `lib/tester.ts`, because everything in that
file existed for the earnings panel. It is recoverable:

```
git show 846414a^:lib/tester.ts
```

Take **`averageRating` only**. `RANKS`, `rankFor`, `formatMoney` and
`earningsFrom` stay deleted — the first two are the reputation panel, which is
its own work, and the last two are money, which this product does not have.

`isNewMission` already moved to `lib/utils/mission.ts` in that same commit and
is untouched here.

New home: **`lib/reciprocity.ts`**, pure and import-free in the shape of
`lib/access.ts` — the ratio, the average and the labels, so the arithmetic is
testable without a database.

## §4 — Plan section

### 4.1 — The migration

```sql
alter table accounts add column plan_id text;
```

Nullable. **Null means Community** — no backfill, because "has not been
assigned a plan" and "is on the free plan" are the same fact today, and writing
`'community'` into 41 rows creates a distinction the product does not have.

**No CHECK constraint.** The vocabulary is enforced in Zod, consistent with
`SKILLS`, `COUNTRIES` and the rest, and `CLAUDE.md` is explicit that fixed
vocabularies live in `lib/vocabulary.ts` rather than in the database.

Per-account rather than per-profile, because it sits on `accounts` — a person
could hold a Pro builder account and a plain tester one, and `CLAUDE.md`'s rule
is that anything scoped to a role lives on `accounts`.

### 4.2 — `lib/plans.ts`

Static TypeScript, not a table — the same reasoning as `lib/testTemplates.ts`:
this is content the team edits, not user data, and a table would mean a
migration every time a line changes.

Content from `docs/Twnhall_Monetisation_Plan_v4.docx` §3 — tester reports per
month, testers per mission, active missions, AI insights, CSV export, shareable
report, priority queue. **The same source `/pricing` uses**, so the two cannot
disagree about what Pro includes.

### 4.3 — What the section shows

The current plan, what the other tier includes, and a **contact CTA**.

**There is no checkout.** Per the plan's Phase 2, upgrading opens a
conversation → `/contact`. `CLAUDE.md`'s Do Not Touch entry on the pricing
page's honesty applies here word for word, and this section is closer to the
danger than the pricing page is — it sits inside an account, so a control here
reads as "change my plan" rather than "read about plans".

### 4.4 — The admin control

`app/(admin)/admin/users/` and `actions/admin/users.ts`, which today has
`suspendUser`, `banUser` and `reactivateUser`. A fourth: `setUserPlan`.

**Without it, adding the column does not let anyone record a sale** and the
manual upgrade path stays broken — which would make the whole migration
decorative.

Same pattern as its three neighbours: `requireAdmin()`, service-role client,
explicit column list, Zod on the plan id.

### 4.5 — Enforcement is not in this PR, and here is the list

Stated explicitly so nobody half-builds it: no report counting, no per-mission
tester ceiling, no active-mission limit, no blocked actions, no usage meter, no
"3 of 5 used". This PR **records** who is on which plan and **shows** it.

## §5 — The page after this PR

Settings becomes four sections. **Appearance already exists** — it landed with
the dashboard theming, so this PR adds two, not three:

1. **Profile** — the existing form, plus §2's account control
2. **Give and take** — §3
3. **Plan** — §4
4. **Appearance** — already there

PR 3 adds **Export** as the fifth.

At 360px: a metric row is a label and a number that must not collide, and a
two-tier plan comparison is the other thing that breaks narrow. Both stack
rather than scroll sideways.

## §6 — Tests

Following `TEST.md` §1 and the existing patterns.

**`lib/__tests__/reciprocity.test.ts`** — the arithmetic, which is where the
mistakes live:

| Case | Expected |
|---|---|
| given 6, received 3 | `2.0` |
| **received 0** | **`—`, never Infinity** |
| given 0, received 0 | empty state, not `0` |
| ratings `[5, 4, null]` | `4.5` — nulls excluded, not counted as zero |
| ratings all null | **`—`, never `0.0`** |
| ratings `[]` | `—` |

**`actions/__tests__/admin-users.test.ts`** — extended for `setUserPlan`: auth
rejection, a valid plan round-trips, an invalid plan id is refused by Zod
before the write, and the write touches `plan_id` and nothing else.

**`scripts/vocabulary.test.mts`** — extended for the plan vocabulary, alongside
`SKILLS` and the rest.

**`actions/__tests__/profile.test.ts` passes unchanged** — this PR adds a
control beside `SettingsForm`, it does not change what the form writes.

**Not covered, and stated rather than implied:** that the account control
renders the right variant, and that the empty states look right. Those need a
DOM, and `vitest.config.mts` is `environment: "node"` with no Testing Library —
the same constraint recorded in `SPEC-onboarding-flow.md` §9. The variant logic
is a two-branch expression on `hasTesterAccount`; the *content* of each branch
is in `lib/plans.ts` and `lib/reciprocity.ts` and is asserted there.

## §7 — Files

**New**
```
supabase/migrations/<date>_add_accounts_plan_id.sql
lib/plans.ts                    tier content, from the monetisation plan §3
lib/reciprocity.ts              ratio, average, labels — pure
lib/__tests__/reciprocity.test.ts
components/settings/GiveAndTake.tsx
components/settings/PlanSection.tsx
components/settings/AccountControl.tsx
```

**Edited**
```
components/layout/Sidebar.tsx         three items, Sign out at every width
components/layout/TopNav.tsx          loses Sign out
app/(developer)/settings/page.tsx     the new sections and their reads
components/SettingsForm.tsx           hosts the account control
actions/admin/users.ts                + setUserPlan
app/(admin)/admin/users/page.tsx      the plan column and control
lib/vocabulary.ts                     PLAN_IDS
lib/validation/schemas.ts             the plan schema
CLAUDE.md                             accounts.plan_id in the data model
DESIGN.md                             the settings section pattern
```

## Acceptance criteria

1. The sidebar's bottom section is exactly Settings, Replay page tour, Sign out.
2. **Sign out is reachable at every width**, and exists once rather than in two
   blocks plus `TopNav`.
3. "Add tester account" / "Switch to tester account" is in Settings and gone
   from the sidebar, with copy that names the verification step.
4. "Give and take" shows the five metrics, and the ratio renders `—` when
   received is 0.
5. A user with no tester account sees a prompt, not zeros.
6. A user with nothing done sees an empty state per `DESIGN.md` §8.
7. `accounts.plan_id` exists, nullable, no CHECK; null reads as Community.
8. The plan section shows both tiers and a `/contact` CTA — **no checkout, no
   usage meter, no account state beyond which plan**.
9. An admin can set a plan and it round-trips.
10. **Nothing is enforced** — every action available before this PR is
    available after it, on every plan.
11. Both themes, and 360px without horizontal scroll.
12. `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`,
    `npm test`.

## Manual test plan

- **Sign out from a phone-width viewport.** Open the sheet, find it, use it.
  Then the desktop rail. This is the regression the brief warns about.
- As a builder with no tester account: Settings → "Add tester account" → lands
  on `/choose-account` → creating one lands on `/verify/tester`, which the
  button said it would.
- As a builder who holds both: the control says "Switch", and switching lands
  on `/explore`.
- A builder with feedback received but nothing tested: ratio `—`, not `0`.
- A brand-new account: empty state, no zeros, no `NaN`.
- Set a plan from the admin console, reload Settings, see it.
- Both themes on Settings and on `/admin/users`, at 360px and desktop.

## Commit sequence

1. `feat(plans): add accounts.plan_id and the plan vocabulary`
2. `feat(settings): recover averageRating and add the reciprocity model`
3. `feat(settings): add the give-and-take section`
4. `feat(settings): add the plan section`
5. `feat(admin): let an admin set a plan`
6. `refactor(nav): move sign out into the sidebar and the rest into settings`
7. `test(settings): cover the ratio, the average and the plan write`
8. `docs: record plan_id and the settings sections`

Commit 6 is last on purpose: the sidebar only loses "Add tester account" once
Settings has somewhere to put it.

## Open questions

**One, and it is a discoverability judgement rather than a technical one.**
§1.2 — "How it works" moving into Settings, which is not where people look for
documentation. This spec builds what the brief asks; the alternatives are
listed there, and it is worth a look once rendered.
