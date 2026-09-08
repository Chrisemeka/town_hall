# SPEC: Drop the Tester's Expected Result, Explain the Statuses

**Status:** In progress
**Branch:** `feat/audit-log-simplify`
**Base branch:** `main`
**Migration:** one — a column default and a function replacement
**Depends on:** `20260907_01`, whose shape this repeats exactly

## Summary

Two changes to the tester's audit log.

1. **"What you expected" is removed.** It was prefilled from the builder's own step and testers
   almost never changed it, so it asked them to retype a sentence the row already carried.
2. **Pass / Fail / Blocked get an explanation** where the choice is made, because nothing in the
   product has ever said what they mean.

## Why — what the live data says

Eleven entries exist. The audit log is new, so that is the whole population, and it is small enough
that this is evidence rather than proof.

| | |
|---|---|
| Total entries | 11 — `pass` 6, `fail` 3, `blocked` 2 |
| `expected_result` left exactly as prefilled | **10 of 11 (91%)** |
| Edited by the tester | 1, on a `fail` |
| `expected_result` identical to `issue_summary` | 0 of the 4 entries that have one |

The single edit:

```
builder said : "The account is created and you are told what happens next"
tester wrote : "I expected the form to submit normally with a success indicator."
issue summary: "No form field error indicator or note"
```

So the "a tester who disagrees about what should have happened is exactly the signal the builder
wants" rationale in `draftFor` has fired once, on a failure — where `issue_summary` is collected
anyway and where that sentence plainly belongs. It has never fired on a pass.

**It is not literally the same input as "Summary of the issue"** — zero entries have the two
identical. The case against it is duplication of `step_expected`, not of `issue_summary`.

Since `20260907_01` a pass collected only this field. Removing it means **a pass now collects
nothing but the status**, which is right: a pass means "it did what the builder said", the builder's
words are already snapshotted on the row as `step_expected`, and there is nothing left to add.

## Non-goals

- **No change to `step_expected`.** It is the snapshot of the builder's wording at submission time
  and stays exactly as it is. It is what "Expected" now means on the builder's side.
- **No dropped column.** `expected_result` keeps the eleven values it holds, including the one real
  tester edit. See below.
- **No change to `actual_result`, `issue_summary` or `steps_to_reproduce`**, or to which statuses owe
  them.
- **No tooltip library.** `@radix-ui/react-tooltip` is a dependency for something CSS does.

## Migration — `supabase/migrations/20260908_01_default_expected_result.sql`

Identical in shape to `20260907_01`, for the same two reasons:

```sql
alter table public.test_result_entries
  alter column expected_result set default '';
```

and `submit_audit_log` replaced so it writes `coalesce(v_entry->>'expected_result', '')`. `->>` on a
missing key returns `NULL`, a column default does not fire for an explicit `NULL`, and the parsed
entry will no longer carry the key at all — so without this the first submission after deploy fails
the insert.

**The column is not dropped.** `20260906_03` dropped `payout_cents` because a dormant payment path
was the thing being eliminated; here the column holds eleven rows of real tester writing, one of
which says something `step_expected` does not. Defaulting it costs nothing and keeps that.

Grants restated rather than assumed, as before.

## Schema — `lib/validation/schemas.ts`

`expected_result` leaves `auditEntrySchema` entirely. Not made optional: an optional field nothing
sends and nothing renders is a field a future reader has to work out the status of.

`ENTRY_TEXT_MIN` keeps its remaining users (`actual_result`, `issue_summary`, `steps_to_reproduce`).

## The form — `components/tester/AuditLogSteps.tsx`

- `DraftEntry` loses `expected_result`; `draftFor` stops seeding it.
- `firstIncompleteEntry` loses its `expected_result` clause. **A pass is now complete as soon as the
  status is set** — which is the point.
- A restored `localStorage` draft written before this carries the old key. Zod strips unknown keys,
  and the action passes the *parsed* entries to the RPC, so a stale draft cannot smuggle it through.

## The builder's side — `components/submissions/SubmissionBody.tsx`

It renders `step_action` but never `step_expected`, and shows `Expected` from `expected_result`. With
nothing writing that field, the builder would lose the "what should have happened" line entirely.

```tsx
<Row label="Expected" value={entry.step_expected} />
{differs(entry) && <Row label="Tester expected" value={entry.expected_result} />}
```

`step_expected` is already on `SubmissionEntry` and already in all three `select()` lists, so this
costs nothing. The second row exists for the one historical entry whose tester disagreed — dropping
the field must not silently delete what it collected.

## The status explanation — `components/ui/InfoTip.tsx`

Nothing in the product has ever said what Pass, Fail and Blocked mean. `lib/vocabulary.ts` explains
Blocked to *developers*, in a comment.

A `?` affordance beside "How did it go?" on each step card, revealing:

> **Pass** — it did what the builder said it would.
> **Fail** — it ran, and did something else.
> **Blocked** — you could not get to this step at all.

Per step rather than once at the top, because the choice is made per step and the icon costs no
vertical space — which matters on a form that is already several screens tall.

CSS-only: a `<button>` with `group-hover` / `group-focus-within` on an absolutely positioned panel.
No JavaScript, no dependency. It is a real button so it is keyboard reachable and works on touch,
where `:hover` never fires, and `aria-describedby` ties the panel to it so a screen reader gets the
text rather than a bare "?".

## Tests

| ID | Case | Expected |
|---|---|---|
| ENT-09 | `auditEntrySchema` accepts an entry with no `expected_result` | accepted |
| ENT-10 | An entry that still carries one | accepted, key stripped |
| ENT-11 | A pass with only a status | accepted |
| AUD-23 | `firstIncompleteEntry` on a pass with only a status | `null` |
| AUD-24 | ENT-08's cross-product, rebuilt without the field | form and server still agree everywhere |
| RPC-02 | `submit_audit_log` with `expected_result` absent | row written, column `''` — against the live function |

## Acceptance criteria

- The tester's step card shows status, then nothing else on a pass.
- Marking a step Pass completes it; the submit hint stops asking for more.
- Fail and Blocked are unchanged — actual result, summary, reproduction, all required.
- The `?` opens on hover, on keyboard focus, and on tap, and is announced with the button.
- A builder reading an existing submission still sees what was expected, and still sees the one
  tester who wrote their own.
- `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm test` — all clean.
