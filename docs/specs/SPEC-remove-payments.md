# SPEC: Remove Payments

**Status:** Awaiting approval — **and blocked on two data decisions, see "Live data" below**
**Branch:** `chore/remove-payments`
**Base branch:** `main` (at `9df73cf`, after the four v2 PRs and the mobile fix)
**Depends on:** Nothing.
**Blocks:** Nothing. Independent of the v2 testing model, which never touched payout.

## Summary

Every trace of money leaves the product. `missions.payout_cents` is **dropped**, `paid` leaves the
`test_results.status` CHECK constraint, the tester's "Earnings & Reputation" panel is deleted whole,
and the legal pages are rewritten so they describe the product that actually ships.

Success condition is negative and testable: a user cannot find a reference to money anywhere in the
product, and a developer reading the code cannot find a dormant payment path to re-activate by
accident. That is why the columns are dropped rather than left dormant — a nullable `payout_cents`
sitting unused is exactly the thing someone wires back up in six months without knowing why it was
abandoned.

One migration, destructive and irreversible.

## Why

Testing on Twnhall is reciprocal and unpaid. The payment machinery was half-built and then reverted
— `commit_mission_credits` and `request_withdrawal` are already gone, `Withdraw` is an inert button
with a tooltip apologising for itself, and `earningsFrom` computes a balance nobody can draw. The
product currently promises money in eleven places and delivers it in none. That gap is a credibility
problem before it is a code problem.

## Live data — the two decisions this PR is blocked on

STEP 0 ran read-only against production. **Both counts are non-zero.**

```
test_results by status:  pending 19 | approved 3 | paid 1 | changes_requested 1   (24 total)
missions with payout_cents > 0:  4 of 16
```

### Decision 1 — the one `paid` submission

| | |
|---|---|
| Submission | `6b3b7bbd-64e6-4f25-8dba-3f527ea22c27` |
| Mission | "Test functionality" ($6.00), project "Samcleon" |
| Tester | Clinton Anyanwu Chukwuemeka &lt;anyanwuclinton693@gmail.com&gt; |
| Submitted | 2026-06-09 · reviewed 2026-06-30 |

The migration collapses it to `approved`. That is a real change to a tester's visible submission
history: a badge that reads **Paid** today will read **Approved** tomorrow, and the "Paid" filter tab
it currently sits under is being removed. **Confirm this is acceptable.**

### Decision 2 — four missions advertised a payout

| Payout | Mission | Project | Builder | Submissions |
|---|---|---|---|---|
| $12.00 | Login & Sign Up Flow | WishIT | NFORSHIFU234 Dev | 2 pending |
| $8.00 | General WishIT Mobile UI Experience | WishIT | NFORSHIFU234 Dev | 1 changes_requested |
| $6.00 | Test functionality | Samcleon | SAMUEL DADA | 2 pending, 1 approved, 1 paid |
| $1.00 | Inventory Tracking | Test | Ekiomo Darlington | none |

All four are still `is_active = true`, so the offer is live right now. Three distinct builders made
it, two of whom are not the account holder.

The number that matters: **$6.00 of approved-but-unpaid work**, one submission by Clinton Anyanwu
Chukwuemeka on SAMUEL DADA's mission, approved 2026-06-11 and never settled. Dropping the column
retracts that silently. Four more submissions sit `pending` or `changes_requested` against missions
that advertised $6–$12, filed by three different testers.

**This needs a decision before the migration runs**, and it is a product and comms decision, not a
technical one. The options, in the order I would take them:

1. **Notify then drop.** Message the three builders and the three testers, then run the migration.
   Slowest, and the only one that closes the loop with the people who were actually promised money.
2. **Settle the $6 out of band, then drop.** Honours the one approved submission; the pending ones
   were never approved, so nothing was owed on them.
3. **Drop now, notify after.** Fastest. Defensible given the sums, but the offer disappears from
   under a live mission with no warning.
4. **Drop now, notify nobody.** Not recommended — the amounts are trivial but the promise was real.

Nothing else in this spec is blocked on that answer. The migration is the only step that touches
this data, and it is the first commit.

## Non-goals

- **No replacement incentive.** Nothing takes payment's place in this PR — not credits, not points,
  not badges. `app/page.tsx` already says "No points, no rewards — just accountability," and that
  becomes true rather than aspirational.
- **No reputation replacement.** Ranks and average rating go out with the panel that held them. See
  "Recovering reputation later" — this is the part of the PR worth arguing with.
- **No change to the review flow's shape.** Approve, request changes, rate and note all stay.
  `test_results.rating`, `review_note` and `reviewed_at` are untouched — they belong to review, not
  to payment.
- **No touching `missions.load_test_at` or `testers_needed`.** They shipped in the same migration as
  `payout_cents` (`20260805_03_mission_payout.sql`) but are load-testing columns, unrelated.
- **No retro-editing merged specs.** `docs/specs/` is a historical record. `SPEC-mission-test-cases.md`
  and the rest keep their payout references.
- **No data backfill and no archive table.** The four payout figures are recorded in this spec and in
  the migration's comment block; that is the archive.
- **No removal of the `mint` token.** See the palette note under "Final sweep".

## Data model changes

`supabase/migrations/20260906_03_remove_payments.sql`

Order is load-bearing: the `UPDATE` must run before the constraint is rewritten, or the migration
fails on the one existing `paid` row.

```sql
-- 1. Collapse any paid submissions into approved. Must precede the new CHECK.
update public.test_results set status = 'approved' where status = 'paid';

-- 2. Rewrite the status constraint without 'paid'.
alter table public.test_results drop constraint if exists test_results_status_check;

do $$
begin
  alter table public.test_results
    add constraint test_results_status_check
    check (status in ('pending', 'approved', 'changes_requested'));
exception
  when duplicate_object then null;
end $$;

-- 3. Drop the payout column and its constraint.
alter table public.missions drop constraint if exists missions_payout_cents_check;
alter table public.missions drop column if exists payout_cents;
```

Guarded with `if exists` throughout and safe to run more than once — step 1 matches zero rows on a
second run, step 2 is wrapped against `duplicate_object`, step 3 is a no-op once the column is gone.

The comment block at the top records the four payout figures and the one collapsed submission, so
the numbers survive the column.

**`test_results_tester_status_idx` on `(tester_id, status)` stays.** The feed still filters by
status; only the vocabulary narrowed.

## Shared logic

### `lib/review.ts`

The state machine, and the load-bearing file. Its header currently says it exists "to stop money
moving before a human approved the work" — that reason is gone, and the comment gets rewritten to
describe what the file is actually for now: the approve / request-changes cycle.

| Symbol | Change |
|---|---|
| `SubmissionStatus` | drop `"paid"` |
| `ReviewAction` | drop `"mark_paid"` |
| `SUBMISSION_STATUSES` | drop `"paid"` |
| `STATUS_LABEL` | drop the `paid` entry |
| `nextStatus()` | drop the `if (current === "paid") return null` guard and the `mark_paid` case |
| `isComplete()` | `status === "approved"` |
| `isWithdrawable()` | **deleted** |

**Question for the user — is `approved` terminal now?** Previously `paid` was terminal and `approved`
could still move back to `changes_requested`. With `paid` gone, a builder can approve and un-approve
indefinitely, and nothing downstream stops them. Nothing in this PR asked for that to change, so
**the default is to leave the behaviour exactly as it is** and treat terminality as its own decision.
Flagging it because removing the terminal state without noticing is how a PR like this introduces a
bug that surfaces months later.

**`isComplete()` will have no caller in application code** once `earningsFrom` is deleted — only
`scripts/review.test.mts` uses it. It is kept per the decisions above, and it is the exact function a
reputation-only panel would need back. Worth knowing it is currently dead weight.

### `lib/tester.ts`

Most of the file goes. Deleted: `formatMoney`, `earningsFrom`, `Earnings`, `EarningsInput`, the
`isWithdrawable` import, and the payouts-ledger `ponytail:` comment. Also deleted, because the panel
that consumed them is being cut: `RANKS`, `Rank`, `rankFor`, `averageRating`.

That leaves `isNewMission` — a 24-hour date check powering the "new" flag on `MissionStrip`, with
nothing to do with payment or reputation.

A file called "Tester reputation and earnings" containing one date helper is a lie in the filename.
**`isNewMission` moves to `lib/utils/mission.ts`** and `lib/tester.ts` is deleted. `lib/utils/`
already holds `project.ts` and `screenshots.ts`, so both the precedent and the folder exist. One
import updated, in `app/(tester)/tester/page.tsx`.

### `lib/validation/schemas.ts`

- Delete `MISSION_PAYOUT_MAX`, the `payout` field from `missionFields`, and `toCents()` with its comment.
- `reviewSchema.action` → `z.enum(["approve", "request_changes"])`, message → `"Choose approve or request changes."`

### `lib/types/db.ts`

Drop `payout_cents` from `MissionRow`.

## Server actions

### `actions/missions.ts`

Remove `payout: formData.get("payout")` from both parse blocks, `payout` from both destructurings,
and `payout_cents: toCents(payout)` from both explicit column lists. Drop the `toCents` import.

Both column lists are asserted in full by `actions/__tests__/missions.test.ts` — that test is what
proves nothing else fell out of the list while payout was being removed from it.

### `actions/review.ts`

Remove the `mark_paid` branch and its two error strings. The `next === null` rejection currently
reads as one half of a ternary; with `mark_paid` gone, `nextStatus` can only return null for an
action the enum no longer permits, so the branch is unreachable in practice. It stays as a guard,
with a single message that reads properly on its own.

Update the `revalidatePath("/tester")` comment — "reads status, payout, and rating straight off this
row" — since payout is gone.

## UI

### Deleted outright

- **`components/MissionRewardFields.tsx`** — payout was its only remaining field; its own comment
  records that category moved to `TestCaseEditor`. Nothing left to hold.
- **`components/tester/ProfilePanel.tsx`** — the whole panel, `TrustSignal` type and `Row`
  sub-component included.

### `components/AddMissionForm.tsx` and `components/EditMissionForm.tsx`

Remove the `MissionRewardFields` import and usage, `payout: fd.get("payout")` from the client-side
parse, `fieldErrors.payout`, and in `EditMissionForm` the `initialPayoutCents` prop, its type, and
the `initialPayoutCents > 0 ? initialPayoutCents / 100 : undefined` expression.

Check the surrounding layout after removal — if a wrapper or heading now contains nothing, it goes
too. No empty grid cells.

### `components/SubmissionReview.tsx`

Remove `paid` from the status style map, `const isPaid`, the `!isPaid &&` guard on the action block,
the "Mark as Paid" button with its hidden `action` input, and the now-unused `Banknote` import.

**Voltage check.** `Approve` and `Mark as Paid` were both default-variant (voltage) and never visible
at once — Approve hides at `status === "approved"`, which is exactly when Mark as Paid appeared. With
Mark as Paid gone, an approved submission shows only `Request Changes` (secondary) and the block has
no voltage CTA at all, which is correct: there is no primary action left to take. Pending and
changes-requested keep exactly one voltage button. DESIGN.md §5.1 is satisfied without moving
anything.

### `components/tester/SubmissionsFeed.tsx`

Remove the `{ label: "Paid", status: "paid" }` filter tab, the `paid` entry in `STATUS_STYLE`, the
payout chip block, the `formatMoney` import, and `payoutCents` from the submission prop type.

The one collapsed submission lands under the existing **Approved** tab, which is where its owner will
look for it.

### `components/tester/MissionStrip.tsx`

Remove the payout chip, the `formatMoney` import, and `payoutCents` from the mission prop type.

The metadata row keeps the category and device-target chips PR 3 added, plus the "new" flag — it was
already the denser part of the card, and the payout chip only ever rendered on 4 of 16 missions.

### `components/MissionResultRow.tsx`

The comment "approve / request changes / rate, and the payout stub" is stale — it describes
`SubmissionReview`, and the stub inside it is what this PR removes. Update the comment; no other
change, the row itself renders no money.

### `components/tours/tours.tsx` — the one that breaks silently

The `tester-home` tour has **exactly two steps**, and the second is the earnings one: icon 💰, title
"Get paid for approved work", `selector: "#earnings"`. That selector points at the wrapper div this
PR deletes. Onborda given a selector that matches nothing either crashes or strands the user on a
step that never anchors.

The whole step object is removed.

**That leaves a one-step tour, and step 1's copy is also wrong** — "open missions, the work you've
submitted, and what you've earned." Its selector `#tour-tester-header` survives, so it still anchors;
only the copy needs rewriting, dropping the earnings clause and closing the tour properly rather than
trailing into a step that no longer exists.

A single-step tour is thin. Repointing it at the submissions feed as a genuine second step is a
sensible follow-up but is scope this PR did not ask for, so it is out — flagged, not done.

## Pages

### `app/(tester)/tester/page.tsx` — the most-affected file

Remove the `earningsFrom` and `averageRating` imports, `payout_cents` from both `.select()` strings
and both row types, both `payoutCents:` mappings, the earnings computation and its comment block, the
`{ label: "Earnings History", href: "#earnings", icon: LineChart }` quick action (and the `LineChart`
import), and the `<div id="earnings">` wrapper with the `ProfilePanel` call and its `signals` array —
including `{ label: "Add payout method", earned: false }`.

**Then fix the layout.** The grid is `lg:grid-cols-[minmax(0,1fr)_340px]` and the 340px column was the
panel. Left as is, the feed renders at `1fr` against 340px of dead space. It collapses to a single
column and `SubmissionsFeed` takes the full width. The zone comment ("Zones 2 + 3 — Submissions feed
alongside earnings/reputation") goes with it.

**Tester Home loses roughly a third of its content** and will look thinner. That is expected, and the
PR will carry a before/after screenshot at desktop width so it is a decision the user makes with
their eyes rather than a surprise after merge.

### `app/(developer)/dashboard/[projectId]/mission/[missionId]/edit/page.tsx`

Remove `initialPayoutCents={mission.payout_cents ?? 0}` and drop `payout_cents` from the `.select()`.

### `app/choose-account/page.tsx`

The tester blurb — "Pick up missions, submit real feedback with proof, get paid, and build a
reputation" — promises two things this PR removes. Rewritten to promise only what the product does:
real testing work on real products, with the builder's response on the record.

### `app/page.tsx`

Line ~165 already reads "No points, no rewards — just accountability." Left alone. The rest of the
landing copy gets read for stray payment promises; anything found is listed in the PR.

## Legal and policy copy

Editorial, not find-and-replace. Each page is read in full first. Anything where deletion versus
rewording is a genuine legal question is **left in place and flagged in the PR** rather than guessed
at.

### `app/terms/page.tsx`

- **~38** — welcome paragraph: "in exchange for feedback credit and, on some missions, payment."
  Payment half removed.
- **§3 "Missions, Payouts and Fees"** (~62–76) — every paragraph in it is about payout. The section
  is removed and **§4–§12 renumber to §3–§11**. Checked: the page has **no cross-references to
  section numbers** anywhere, and `Section` takes `number` as a prop, so renumbering is contained.
- **~107** — "do not include personal data, credentials, or payment details of other people in a
  screenshot" — **kept, unchanged.** It is about third-party payment data in screenshots and is still
  exactly right.
- **~122** — keep the low-effort prohibition, remove the payout motive and the forfeiture clause.
- **~140** — payment-violation forfeiture clause. Removed.
- **~147** — "Changes that affect payouts, fees, or how earnings are calculated..." rewritten
  generically to cover material changes to how the platform works.

### `app/privacy/page.tsx`

**~49, the "Earnings Information" block** — describes collecting payout amounts and anticipates
collecting bank details. Removed entirely rather than reworded: a privacy policy must not describe a
category of data that does not exist.

### `app/guidelines/page.tsx`

- **~66** — "Some missions carry a payout; all of them build a rating and a rank." Both halves are
  now false. Rewritten around what stays true: testing is real work, it is reciprocal, and both sides
  are accountable.
- **~89** — "Add a payout and a skill tag if you want to pay for the work." Removed.
- **~100** — "Approved work counts toward your rating, your rank, and your balance." Rank and balance
  both go; rating survives on the row.
- **~121** — "Nothing counts toward your rating or balance while a submission sits here." Balance
  removed.
- **~125, ~132–133** — status explainer cards. The **Paid** card is removed; the **Approved** card
  loses "any payout on the mission becomes part of your available balance."
- **~138** — "Approval is the gate on payment." The surrounding guidance on reviewing promptly and in
  good faith is worth keeping; reframed so approval is the gate on the tester's completed-work record.
- **~146** — the "Withdrawals aren't live yet" block. Removed.
- **~197** — "and on a paid mission, it's taking money for work you didn't do." Clause removed, rest
  kept.
- **~201** — "don't request changes to delay a payout." Clause removed, rest kept.
- **~305** — payment-violation forfeiture paragraph removed. **The final sentence is kept** — that
  enforcement applies to the person across both accounts is unrelated to payment and worth stating.

## Tests

| ID | Case | Expected |
|---|---|---|
| RM-01 | `nextStatus` never returns `"paid"` for any status × action pair | holds across the full cross-product |
| RM-02 | `mark_paid` rejected by `reviewSchema` as an invalid action | field error, not a 500 |
| RM-03 | `SUBMISSION_STATUSES` is exactly the three remaining statuses | no `paid` |
| RM-04 | `SUBMISSION_STATUSES.filter(isComplete)` | `["approved"]` |
| RM-05 | `createMission` writes its explicit column list | full remaining set asserted, no `payout_cents` |
| RM-06 | `updateMission` likewise | as above |
| RM-07 | `isWithdrawable` no longer exported | compile-time, via `tsc` |

- **`actions/__tests__/missions.test.ts`** — drop `payout: "0"` from the fixture and `"payout_cents"`
  from the asserted column list. The assertion must still name **every remaining column** rather than
  being loosened to a subset — it is the only thing standing between this PR and a silently dropped
  column.
- **`scripts/review.test.mts`** — every `paid` and `mark_paid` case removed, RM-01 and RM-02 added.
  The earnings block (`earningsFrom`, `formatMoney`) and the rank block (`rankFor`, `averageRating`)
  are deleted along with the functions they cover. The file header — "Approval-to-payout status flow"
  — is rewritten.
- No test file exists solely for `earningsFrom` / `rankFor` / `averageRating`; they are covered inside
  `scripts/review.test.mts` only, so nothing gets deleted wholesale.
- `actions/__tests__/review.test.ts` does not exist. `reviewSchema` coverage lands in
  `scripts/review.test.mts` alongside the state machine.

**Gates:** `npx tsc --noEmit`, `npm run lint` (at zero — this PR holds it there, no new `as any`),
`npm run build`, `npm test`.

`tsc` is doing unusually heavy lifting here. Removing a member from `SubmissionStatus` turns every
stale reference into a compile error rather than a runtime surprise, which is the main reason the
union is narrowed rather than the values merely stopped being written.

## Final sweep

```
grep -rniE "payout|payment|earning|withdraw|balance|_cents|bounty|\bpaid\b" \
  --include=*.ts --include=*.tsx actions lib components app emails
```

Expected survivors, and nothing else:

- `lib/testTemplates.ts` — the `checkout-payment` template. **Correct, and stays.** It is a template
  for a builder testing *their own* product's checkout flow; it has nothing to do with Twnhall paying
  anyone.
- `app/terms/page.tsx` ~107 — the third-party-payment-details-in-screenshots rule.

**The `mint` / `#3FFFA2` token stays.** Checked rather than assumed: besides the `paid` badge it backs
`Badge.tsx` (`active`, `complete`, `positive`), the pass state in `AuditLogSteps.tsx`, the pass
styling in `SubmissionBody.tsx`, the success state in `AuditLogForm.tsx`, and a check icon in
`MissionResultRow.tsx`. Only the `paid` instances in `SubmissionReview.tsx` and `SubmissionsFeed.tsx`
go. It is not orphaned.

Then a manual click-through: create a mission, submit an audit log, review it as a builder, load
Tester Home. No money anywhere, nothing visually broken by the removals.

## Documentation

- **`CLAUDE.md`** — `payout_cents` out of the Data Model table, `test_results.status` shown as the
  three remaining states, and the **entire "Do Not Touch — `missions.payout_cents`" entry removed**;
  the column will not exist. The Atomicity section cites `commit_mission_credits` and
  `request_withdrawal` as examples of the plpgsql pattern — both already reverted, but the wording is
  checked so it does not imply payment exists.
- **`README.md`** — "How it Works" and the audience sections checked for incentive language.
- **`TownHall_Checklist (1).xlsx`** — QA rows referencing payout, paid status or earnings removed or
  updated. Appended at sheet end, never via `insert_rows`, which silently destroyed rows last time.
- **`docs/specs/`** — merged specs are not retro-edited.

## Rollout

**Order: deploy the code, then run the migration.** The reverse of the usual, and deliberate.

Dropping `payout_cents` while the deployed build still selects it breaks every query naming it —
PostgREST errors the whole select, so Tester Home, the mission edit page and the tester feed would all
fail rather than degrade. Deploying first is safe in the other direction: the new code simply stops
referencing a column that still exists, and `status = 'paid'` renders as a label the narrowed
`STATUS_LABEL` no longer has a key for. That affects exactly one row, for the minutes between deploy
and migration.

Ordering the two the other way trades a one-row cosmetic gap for three broken pages.

**Rollback:** revert the code. The migration does **not** roll back — `payout_cents` and the four
payout figures are gone, and the collapsed `paid` row cannot be told apart from a genuinely approved
one afterwards. The figures are recorded in this spec and in the migration comment; that is the only
recovery path.

**Recovering reputation later.** `rankFor`, `RANKS` and `averageRating` are recoverable verbatim from
this PR's diff, and the data they read has not moved: `test_results.rating` and the approved-submission
count are untouched, and builders still rate every submission. A reputation-only panel is a
components-and-page change with no migration.

## Acceptance criteria

1. The migration collapses `paid` → `approved` **before** rewriting the CHECK, and is re-runnable.
2. `missions.payout_cents` and `missions_payout_cents_check` no longer exist.
3. `test_results.status` accepts only `pending`, `approved`, `changes_requested`.
4. `test_results.rating`, `review_note`, `reviewed_at`, `missions.load_test_at` and
   `missions.testers_needed` are all untouched.
5. `isWithdrawable`, `earningsFrom`, `formatMoney`, `rankFor`, `RANKS`, `averageRating` and
   `MissionRewardFields` do not exist anywhere in the tree.
6. `lib/tester.ts` is gone; `isNewMission` lives in `lib/utils/mission.ts`.
7. `SubmissionStatus` and `ReviewAction` have three and two members; `tsc` finds no stale reference.
8. The tester tour has no step selecting `#earnings`, and step 1's copy no longer mentions earnings.
9. Tester Home is a single-column layout with no empty 340px track.
10. Terms §3 is gone, §4–§12 renumbered, and the screenshot rule at ~107 survives verbatim.
11. The privacy policy contains no "Earnings Information" block.
12. Guidelines has no Paid card, no withdrawal block, and no payout clauses.
13. The final-sweep grep returns only the two justified survivors.
14. `mint` / `#3FFFA2` still backs the badge, pass and success states it always did.
15. All four gates pass; lint stays at zero.

## Manual test plan

**Builder:** create a mission — confirm no payout field and no gap where it was. Edit it — same. Open
a submission and review it: Approve and Request Changes only, no Mark as Paid, one voltage CTA.

**Tester:** load Tester Home. Confirm no balance, no rank, no "Earnings History" quick action, and a
full-width feed with no dead column. Open the tour: it runs, anchors, and ends without a missing
step. Check the filter tabs — no Paid tab, and the collapsed submission appears under Approved.

**The collapsed row:** find `6b3b7bbd-64e6-4f25-8dba-3f527ea22c27` in that tester's feed and confirm
it reads Approved and renders normally.

**Legal:** read Terms, Privacy and Guidelines end to end as a user would. No money, correct section
numbering, and no orphaned sentence left behind by a deleted clause.

**Regression:** submit an audit log against a mission that used to carry a payout ("Login & Sign Up
Flow") and confirm the whole submit → review loop still works.

## Reference

- Codebase patterns: `CLAUDE.md` — Data Model, Data Mutations, Validation, Do Not Touch
- Buttons and the one-voltage-CTA rule: `DESIGN.md` §5.1; badges §5.4; empty states §8
- Server-action test pattern: `TEST.md` §1
- Prior specs: `SPEC-tester-audit-log.md`, `SPEC-mission-test-cases.md`, `SPEC-project-category.md`
- Original payout migration: `supabase/migrations/20260805_03_mission_payout.sql`
