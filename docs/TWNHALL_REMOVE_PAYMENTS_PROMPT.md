# Twnhall — Remove Payments: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Twnhall is removing every trace of payment from the product. Missions no longer carry a payout, submissions are never "paid", and testers no longer see a balance. Testing on Twnhall is reciprocal and unpaid.

This is a **deletion PR**. Its success condition is that a user cannot find any reference to money anywhere in the product, and that a developer reading the code cannot find a dormant payment path they might accidentally re-activate.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions. Note that it currently contains a **"Do Not Touch — `missions.payout_cents`"** entry; that entry is being removed by this PR, and updating it is part of the work.
2. Read `DESIGN.md` §5 and §8 before changing any UI.
3. Read `TEST.md` §1 for the server-action test pattern.
4. Read `docs/specs/SPEC-tester-audit-log.md` and the other existing specs, and **match their structure** when you write this one.

**Branch:** `chore/remove-payments`
**Base:** `main`
**Migration:** one, destructive
**Risk:** high — drops a live column, rewrites a CHECK constraint, and rewrites user-facing legal text

Write the spec into `docs/specs/SPEC-remove-payments.md` first. **Stop and get it approved before implementing.** Then implement with the repo's commit granularity: migration → shared logic → server actions → UI → legal copy → tests, each a separate commit.

All four gates before done: `npx tsc --noEmit` clean, `npm run lint` with no new `as any`, `npm run build` clean, `npm test` green.

---

## Decisions already made — do not relitigate

- **Drop the columns entirely.** `missions.payout_cents` is dropped and `paid` is removed from the `test_results.status` CHECK constraint. Not left dormant.
- **Cut the whole tester panel.** `ProfilePanel` ("Earnings & Reputation") is removed in full — earnings *and* reputation. See the note under §3 about what this costs and how to bring reputation back later.
- **Rewrite the legal pages in this PR.** Terms, Privacy and Guidelines are updated so they match the product on the day it ships.

---

## STEP 0 — Before you write the migration (do this first, and report back)

The migration is destructive and irreversible. **Do not write it until you have looked at the live data.** Run these read-only queries and show the user the results:

```sql
SELECT status, count(*) FROM test_results GROUP BY status;
SELECT count(*) FROM missions WHERE payout_cents > 0;
SELECT id, title, payout_cents FROM missions WHERE payout_cents > 0 ORDER BY payout_cents DESC;
```

What you are looking for:

- **Any row with `status = 'paid'`.** These must be migrated to `approved` before the CHECK constraint is rewritten, or the migration fails. If any exist, tell the user how many and confirm that collapsing them to `approved` is acceptable — that is a real change to a tester's visible submission history.
- **Any mission with `payout_cents > 0`.** A builder advertised a payout on these. Dropping the column silently retracts an offer that was made. If any exist, **stop and tell the user before proceeding** — they may want to notify those builders, or honour outstanding approved work, before the data is gone.

If both counts are zero, say so and proceed. If either is non-zero, wait for a decision.

---

## STEP 1 — Migration

`supabase/migrations/<YYYYMMDD>_01_remove_payments.sql`. Follow the existing migrations' house style: a comment block at the top explaining *why*, `if exists` / `if not exists` guards, and safe to run more than once.

Order matters. The `UPDATE` must run **before** the constraint is rewritten:

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

Two things to get right:

- **Do not drop `test_results.rating`, `review_note`, or `reviewed_at`.** Those belong to the review flow, not to payment. The builder still approves, rates, and notes.
- **Do not touch `missions.load_test_at` or `testers_needed`.** They were added in the same original migration as `payout_cents` but are load-testing columns and are unrelated.

The index `test_results_tester_status_idx` on `(tester_id, status)` stays — the feed still filters by status.

---

## STEP 2 — Shared logic

### `lib/review.ts`

This is the state machine and it is the load-bearing file. It currently exists, per its own header comment, to stop money moving before a human approved the work. That reason is gone; the file's remaining job is the approve / request-changes cycle. **Rewrite the header comment to say what it is actually for now** — do not leave a comment describing a payment guard that no longer exists.

- `SubmissionStatus` → `"pending" | "approved" | "changes_requested"`
- `ReviewAction` → `"approve" | "request_changes"`
- `SUBMISSION_STATUSES` and `STATUS_LABEL` → drop the `paid` entries
- `nextStatus()` → drop the `if (current === "paid") return null` guard and the `mark_paid` case
- `isComplete()` → `status === "approved"` only
- `isWithdrawable()` → **delete the function entirely**

Consider whether `approved` should now be terminal in `nextStatus()`. Previously `paid` was the terminal state and `approved` could still move to `changes_requested`. With `paid` gone, a builder can currently approve and then un-approve indefinitely. Raise this in the spec as a question for the user — do not decide it silently. The safest default is to leave the current behaviour unchanged, since nothing in this PR asked for it.

### `lib/tester.ts`

The file header says "Tester reputation and earnings — all derived, no tables" and carries a `ponytail:` note about adding a payouts ledger. Most of this file is going.

Delete: `formatMoney`, `earningsFrom`, `Earnings`, `EarningsInput`, the `isWithdrawable` import, and the payouts-ledger `ponytail:` comment.

Also delete, because the panel that consumed them is being cut: `RANKS`, `Rank`, `rankFor`, `averageRating`.

Keep: `isNewMission` — it powers the "new" flag on `MissionStrip` and has nothing to do with payment.

If `isNewMission` is all that remains, the file's name and header comment are both wrong. Either rewrite the header honestly or move the function somewhere it belongs (`lib/utils/` has precedent). Do not leave a file called "tester reputation and earnings" containing one date helper.

### `lib/validation/schemas.ts`

- Delete `MISSION_PAYOUT_MAX`, the `payout` field from `missionFields`, and the `toCents()` helper along with its comment.
- `reviewSchema` → `action: z.enum(["approve", "request_changes"])`, and update the error message from `"Choose approve, request changes, or mark paid."` to `"Choose approve or request changes."`

### `lib/types/db.ts`

Remove `payout_cents` from the missions row type.

---

## STEP 3 — Server actions

### `actions/missions.ts`

Remove `payout: formData.get("payout")` from both parse blocks (~lines 51 and 111), `payout` from both destructurings (~lines 64 and 124), and `payout_cents: toCents(payout)` from both explicit column lists (~lines 79 and 138). Remove the now-unused `toCents` import.

### `actions/review.ts`

Remove the `mark_paid` branch and its two error strings (~lines 86–88). The remaining rejection message should read naturally on its own rather than being the leftover half of a ternary. Update the comment at ~line 109 — "The tester's home reads status, payout, and rating straight off this row" — since payout is gone.

---

## STEP 4 — Components

### Delete outright

- **`components/MissionRewardFields.tsx`** — payout was its only remaining field (its own comment records that category moved to `TestCaseEditor`). The component has no reason to exist. Remove it and its imports from `AddMissionForm.tsx` and `EditMissionForm.tsx`.
- **`components/tester/ProfilePanel.tsx`** — the whole panel, including the `TrustSignal` type and the `Row` sub-component.

### `components/AddMissionForm.tsx` / `components/EditMissionForm.tsx`

Remove the `MissionRewardFields` import and usage, `payout: fd.get("payout")` from the client-side parse, `fieldErrors.payout`, and in `EditMissionForm` the `initialPayoutCents` prop, its type, and the `initialPayoutCents > 0 ? initialPayoutCents / 100 : undefined` expression.

Removing the field leaves a gap in the form's flow. Check the spacing and the section that contained it — if a wrapper div or heading now wraps nothing, delete it too. Do not leave an empty grid cell.

### `components/SubmissionReview.tsx`

- Remove `paid` from the status style map (~line 13)
- Remove `const isPaid = status === "paid"` and the `!isPaid &&` condition guarding the action block (~lines 74, 91)
- Remove the entire "Mark as Paid" button and its `<input type="hidden" name="action" value="mark_paid" />` (~lines 109–111)
- Remove the now-unused `Banknote` icon import from lucide-react

With `paid` gone, the approve / request-changes pair is the whole action set. Re-check the button hierarchy against `DESIGN.md`: **one voltage CTA per viewport.** If "Mark as Paid" was carrying the voltage treatment, Approve should now take it.

### `components/tester/SubmissionsFeed.tsx`

- Remove the `{ label: "Paid", status: "paid" }` filter tab (~line 25)
- Remove the `paid` entry from `STATUS_STYLE` (~line 33)
- Remove the payout chip block at ~lines 151–156 (`s.payoutCents > 0 && ...`) and the `formatMoney` import
- Remove `payoutCents` from the submission prop type

### `components/tester/MissionStrip.tsx`

Remove the payout chip (~line 91) and the `formatMoney` import. Remove `payoutCents` from the mission prop type. Check what the card looks like without it — if the metadata row is now sparse, the category and device-target chips from the v2 work are the natural things to give it space.

### `components/MissionResultRow.tsx`

The comment at ~line 208 reads "REVIEW — approve / request changes / rate, and the payout stub". Update it; check whether the payout stub it refers to is still rendered and remove it if so.

### `components/tours/tours.tsx`

**This one will break silently if you miss it.** The tester tour has a step at ~lines 195–202: icon 💰, title "Get paid for approved work", content referencing a balance, and `selector: "#earnings"`.

That selector points at the wrapper div around `ProfilePanel`, which this PR deletes. A tour step whose selector matches nothing will either crash Onborda or leave the user stuck on a step that never anchors. **Remove the entire step object**, not just its copy.

Then walk the whole tester tour and confirm the remaining steps still form a coherent sequence — if this was the final step, the one before it now needs to be the closer.

---

## STEP 5 — Pages

### `app/(tester)/tester/page.tsx`

The most-affected file. Remove:

- The `earningsFrom` and `averageRating` imports (~line 5)
- `payout_cents` from every Supabase `.select()` string (~lines 65, 73) and from the row types (~lines 30, 39)
- `payoutCents: mission?.payout_cents ?? 0` and `payoutCents: m.payout_cents ?? 0` (~lines 93, 125)
- The earnings computation and its comment block (~lines 99–101)
- The `{ label: "Earnings History", href: "#earnings", icon: LineChart, primary: false }` quick-action (~line 50), and the `LineChart` import if it becomes unused
- The `<div id="earnings">` wrapper, the `<ProfilePanel>` call, and the `signals` array including `{ label: "Add payout method", earned: false }` (~lines 195–207)

**Then fix the layout.** The grid at ~line 194 is `lg:grid-cols-[minmax(0,1fr)_340px]` — a two-column layout whose right-hand 340px column was the panel. With the panel gone that column is empty and the feed will render at 1fr against dead space. Collapse it to a single-column layout and let `SubmissionsFeed` take the full width.

Update the zone comment at ~line 193 — "Zones 2 + 3 — Submissions feed alongside earnings/reputation" — since zone 3 no longer exists.

Take a screenshot or describe the resulting page in the PR. Tester Home loses a third of its content; it may now look thin, and that is worth the user seeing before merge.

### `app/(developer)/dashboard/[projectId]/mission/[missionId]/edit/page.tsx`

Remove `initialPayoutCents={mission.payout_cents ?? 0}` (~line 71) and drop `payout_cents` from that page's `.select()`.

### `app/choose-account/page.tsx`

The tester blurb (~line 24) reads *"Pick up missions, submit real feedback with proof, get paid, and build a reputation."* Rewrite it. Note that it also promises reputation, which this PR removes — the replacement must promise only what the product now does.

### `app/page.tsx`

Line ~165 already reads *"No points, no rewards — just accountability."* That is now more accurate than before. Leave it, but read the surrounding landing copy for any other payment promise.

---

## STEP 6 — Legal and policy copy

This is editorial work, not find-and-replace. Read each page in full before editing. Where you are unsure whether a clause should be deleted or reworded, **leave it and flag it in the PR description** rather than guessing at legal wording.

### `app/terms/page.tsx`

- **Line ~38** — the welcome paragraph says testers work *"in exchange for feedback credit and, on some missions, payment."* Remove the payment half.
- **Section 3, "Missions, Payouts and Fees"** (~lines 62–76) — this section is now entirely about something the product does not do. Remove the payout paragraphs (~64, 67, 73, 76). If anything survives about missions generally, retitle the section to match; if nothing does, remove the section and renumber every section after it. **Check for cross-references to section numbers elsewhere on the page before renumbering.**
- **Line ~107** — *"do not include personal data, credentials, or payment details of other people in a screenshot"* — **keep this.** It is about not leaking third-party payment data in screenshots, which is still exactly right.
- **Line ~122** — *"Submitting low-effort feedback to collect a payout... grounds for termination and forfeiture of any unpaid balance."* Keep the low-effort prohibition, remove the payout motive and the forfeiture clause.
- **Line ~140** — the payment-violation forfeiture clause. Remove.
- **Line ~147** — *"Changes that affect payouts, fees, or how earnings are calculated..."* Remove or rewrite generically.

### `app/privacy/page.tsx`

**Line ~49**, the "Earnings Information" block, describes collecting payout amounts and anticipates collecting bank details. Twnhall no longer collects any of it. Remove the block entirely rather than rewriting it — a privacy policy should not describe a category of data that does not exist.

### `app/guidelines/page.tsx`

- **Line ~66** — *"Testing here is treated as work. Some missions carry a payout; all of them build a rating and a rank..."* Both halves are now wrong: no payouts, and this PR removes the rank display. Rewrite around what remains true — testing is real work, and it is reciprocal.
- **Line ~89** — *"Add a payout and a skill tag if you want to pay for the work."* Remove.
- **Lines ~125, ~132–133** — the status explainer cards. Remove the **Paid** card. The **Approved** card mentions "any payout on the mission becomes part of your available balance" — remove that clause.
- **Line ~138** — *"Approval is the gate on payment."* The surrounding guidance about reviewing promptly and in good faith is worth keeping; rewrite the framing so approval is the gate on the tester's completed-work record instead.
- **Line ~146** — the *"Withdrawals aren't live yet"* block. Remove.
- **Line ~197** — *"...and on a paid mission, it's taking money for work you didn't do."* Remove that clause, keep the rest.
- **Line ~201** — *"don't request changes to delay a payout."* Remove that clause, keep the rest.
- **Line ~305** — the payment-violation forfeiture paragraph. Remove. **Keep** the final sentence about enforcement applying to the person across both accounts — that is unrelated to payment and is a rule worth stating.

---

## STEP 7 — Tests

- **`actions/__tests__/missions.test.ts`** — remove `payout: "0"` from the fixture (~line 39) and `"payout_cents"` from the asserted column list (~line 278). That assertion is doing real work; make sure it still asserts the full remaining set rather than being loosened.
- **`scripts/review.test.mts`** — remove every `paid` and `mark_paid` case. Add a case proving `mark_paid` is now rejected as an invalid action, and one proving `nextStatus` never returns `paid` for any input.
- **`actions/__tests__/review.test.ts`** (if present) — same treatment.
- Search the whole `actions/__tests__/` and `scripts/` trees for `paid`, `payout`, and `earnings` and clean up anything left.
- If any test file existed solely to cover `earningsFrom`, `rankFor`, or `averageRating`, delete it.

---

## STEP 8 — Documentation

- **`CLAUDE.md`** — remove `missions.payout_cents` from the Data Model table and **remove the entire "Do Not Touch — `missions.payout_cents`" entry**, since the column no longer exists. Update the `test_results` row to show the three-state status. Check the plpgsql section: it cites `commit_mission_credits` and `request_withdrawal` as examples of the pattern — those were already reverted, but confirm the wording does not now imply payment exists.
- **`README.md`** — check the "How it Works" and target-audience sections for any payment or incentive language.
- **`TownHall_Checklist (1).xlsx`** — remove or update any QA row referencing payout, paid status, or earnings.
- **`docs/specs/`** — do not retro-edit merged specs. They are a historical record.

---

## Final sweep — the acceptance test for this PR

Run these and confirm each returns nothing but false positives you can justify:

```
grep -rniE "payout|payment|earning|withdraw|balance|_cents|bounty|\bpaid\b" \
  --include=*.ts --include=*.tsx actions lib components app emails
```

Expected surviving matches, and nothing else:

- `lib/testTemplates.ts` — the `checkout-payment` test template. **This is correct and must stay.** It is a template for a builder testing *their own* product's checkout flow. It has nothing to do with Twnhall paying anyone.
- `app/terms/page.tsx` ~line 107 — the "don't put other people's payment details in screenshots" rule.

Anything else is a miss. Also grep for `mint` / `#3FFFA2` — that colour was the `paid` badge; if nothing else uses it, remove it from the palette rather than leaving an orphan token.

Then click through manually: create a mission, submit an audit log, review it as a builder, and load Tester Home. Confirm no money appears and nothing is visually broken by the removals.

---

## Two things to raise with the user in the PR description

**This is irreversible, and the business model plans to undo it.** The `Twnhall_Business_Model_v2.pdf` in the project describes credit packs, tester payouts, and a 20–25% marketplace take-rate as the core revenue model. Dropping `payout_cents` and the `paid` status means that work starts from a clean slate later. That is a defensible choice — the old columns were a half-built stub, and a real credit system will not look like them — but it should be a decision, not a surprise. Say so plainly in the PR.

**Cutting reputation costs more than cutting payments.** Section 7.3 of `Twnhall_Strategy_Summary.pdf` names the reputation layer as the bridge to the tester job-opportunity incentive, and the v2 baseline doc lists it as an unbuilt pillar. Ranks, average rating and completed-mission counts are not payment features — they were only removed because they shared a panel with the balance.

The underlying data survives: `test_results.rating` and the approved-submission count are untouched, and the builder still rates every submission. Only the tester-facing display is going. Make the removal clean enough that a future PR can reintroduce a reputation-only panel from existing data — and note in the spec that `rankFor`, `RANKS` and `averageRating` were deleted from `lib/tester.ts` and can be recovered from this PR's diff.
