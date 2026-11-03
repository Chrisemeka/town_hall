# SPEC: Paid Reports That Weren't Delivered Carry Over

**Status:** Ready — C1–C3 decided 3 Nov 2026 (§6), all as recommended.
**Branch:** `feat/paid-report-carryover`
**Base:** `main` (independent of PR 1)
**Source:** `docs/TWNHALL_PAYSTACK_MSA_PROMPT.md`, PR 2; `docs/Twnhall_Paystack_MSA_Review.md` §2.2
**Migration:** one, `20261103_01_carried_reports.sql`. It replaces `close_mission` (same signature) and adds an optional backfill (C2).
**New dependency:** none
**New env var:** none
**Risk:** medium. This touches the ledger the cohort is paid against. The
change is additive: one new pool, one new kind, one new pure function. All
arithmetic stays in `lib/allowance.ts`.

## Summary

Paystack's MSA, Section D §3, lists the grounds on which a merchant is assessed
for a dispute. The first is **"value is not given for transactions"**. Section
B warns that "high Dispute rates (typically those exceeding 1% of the total
payment volume) may result in your inability to accept Card Payments." At
Twnhall's volume, one ₦30,000 dispute is roughly 15% of a month.

**Today a builder can lose reports they paid for and never got:**

1. Publishing reserves slots, from this month's paid pool first (`reserve()`).
2. Testers fill fewer than reserved. Supply is the ceiling on the whole
   business (Compensation Model §5), so this will happen.
3. The builder closes the test case. `release()` returns the unused slots "to
   their own month, and if that month has ended the slots expire with it"
   (`lib/allowance.ts`, comment on `release`).

> A Starter builder publishes on 25 October and gets 3 of 5 reports. On 2
> November they close the test case. The 2 undelivered reports go back into
> October, which has ended. They paid for 5, received 3, and the other 2 are
> gone.

That is the textbook shape of a "value not delivered" chargeback.

**The fix:** when a close returns paid slots whose month has already ended,
they come back as **carried** reports, which never expire.

Monthly reports a builder **never published** still expire at month end. That's
the plan as sold, and the pricing FAQ already says so. The fix protects only
reports that were reserved on a live test case and never delivered.

## §0 — Verified before writing this

- `release()` (`lib/allowance.ts:115`) returns slots with their original bucket
  and period. `closeMission()` (`lib/allowanceDb.ts:167`) sends them to
  `close_mission` as `p_rows`.
- `close_mission` (current body in `20261101_03_closed_test_cases.sql:85`)
  inserts every element of `p_rows` with kind `'released'`, then sets
  `is_active = false, closed_at = now()`.
- `balance()` counts a monthly row only where `period === monthOf(now)`. A
  release into an ended month changes nothing anyone can spend.
- `held()` keys on bucket and period, and reads only `reserved` and `released`
  rows. `report_landed` does the same in SQL (`20261101_03:159`:
  `kind in ('reserved', 'released')`).
- **Only `close_mission` releases.** `report_landed` closes a full test case,
  which has nothing unused. `deleteMission` (`actions/missions.ts:191`)
  deletes the mission row without closing it first. Its ledger rows keep their
  slots, with `mission_id` set null, so **a deleted live test case's reserved
  slots are never returned at all**. See C3.
- No SQL compares a bucket string. Vocabularies live in code
  (`20260930_01:36`: "No CHECK on kind or bucket").
- `cohortEligible()` decides which pools the paid cohort may serve: monthly and
  grant.
- `/admin/accounts/[id]` shows a Report balance panel with Monthly / Grant /
  Earned / Total (`page.tsx:170`).
- `lib/__tests__/closedMigration.test.ts` pins the three allowance functions'
  bodies in `20261101_03`. This migration needs a sibling test (§7).

**Run before writing the migration** and record the result here. C2 depends on
it.

```sql
-- Paid slots that already expired this way: released into a month that had
-- ended by the time they were released.
select profile_id, mission_id, period, slots, created_at
from public.report_ledger
where kind = 'released'
  and bucket = 'monthly'
  and period < date_trunc('month', created_at at time zone 'Africa/Lagos')::date
order by created_at;
```

Result (3 Nov 2026, production, read-only): **0 rows, 0 slots, 0 builders.** One
monthly `released` row exists in total, and it went back to its own month.

## §1 — A fourth pool: carried

In `lib/allowance.ts`:

```ts
/** Spend order. A Starter or Pro builder must never spend earned credit while this month's sits unused. */
export const BUCKETS = ["monthly", "carried", "grant", "earned"] as const
export const LEDGER_KINDS = ["grant", "earned", "reserved", "released", "carried"] as const
export type Balance = { monthly: number; carried: number; grant: number; earned: number; total: number }
```

- **Carried never expires.** `period` is null on every carried row, as on grant
  and earned. A builder who paid for a report and didn't get it keeps it, on any
  plan, until they spend it.
- **Spend order: monthly, carried, grant, earned.** This month's pool expires,
  so it goes first; that's the existing rule. Carried is paid credit, so it goes
  before the two free pools.
- **`balance()`**: `carried = max(0, Σ slots on bucket 'carried')`, clamped on
  its own. `total` includes it.
- **`reserve()`**: unchanged. `period` is still
  `bucket === "monthly" ? monthOf(now) : null`, so a carried reservation has a
  null period.
- **`held()`**: unchanged. A carried slot re-reserved on a new test case is a
  `reserved` row with bucket `carried`, which `held()` already counts. The
  `carried` *kind* rows (§2) are neither reserved nor released, so `held()`
  ignores them. That's correct: they aren't held by any test case.
- **`release()`**: the rank becomes earned 0, grant 1, carried 2, monthly 3, with
  the newest month first among monthly as today. The existing reasoning holds:
  delivered reports are taken to have used the pool that expires.
- **`cohortEligible()`**: monthly, grant and **carried** (C1).

### 1.1 — Why not put them back into this month's monthly pool

That was the obvious design, and it fails twice:

1. **`held()` keys on bucket and period.** An October reservation released into
   November leaves October's slots still "held" by the test case. Release
   stops being idempotent, and `cohortSlots()` pays the cohort against slots
   that already came back.
2. **`balance()` clamps monthly at zero** to forgive a mid-month downgrade
   ("zero left, not a debt"). A carry added inside that clamp vanishes for any
   builder who downgraded mid-month with more reserved than the new plan
   allows. Example: Pro→Starter with 10 reserved and 2 carried gives
   `max(0, 5 − 10 + 2) = 0`.

A pool of its own has neither problem.

## §2 — The carry

A new pure function in `lib/allowance.ts`:

```ts
/**
 * What a close owes beyond its release: paid slots whose month has ended come
 * back as carried credit, which does not expire. It runs on the release's own
 * output, so a second close, which releases nothing, carries nothing.
 */
export function carryOver(released: readonly Slots[], now: Date): Slots[]
```

- Every released slot with `bucket === "monthly"` and
  `period < monthOf(now)` adds to **one** entry,
  `{ bucket: "carried", period: null, slots }`. Two ended months make one
  entry.
- Monthly slots from **this** month: nothing is carried. They return to this
  month's pool, as today.
- Carried, grant and earned don't expire, so there's nothing to carry.

`closeMission()` (`lib/allowanceDb.ts`) sends both, inside the existing retry
loop:

```ts
const now = new Date()
const back = release(held(rows.filter((r) => r.mission_id === missionId)), received)
const carried = carryOver(back, now)
// p_rows:
[...asRows(back, 1), ...asRows(carried, 1).map((r) => ({ ...r, kind: "carried" as const }))]
```

**The October `released` row stays.** It records that the slots came back
unused, and `mission_closed_unfilled` (`lib/alerts/run.ts:56`) reads it. The
`carried` row, with the same `mission_id`, records that they became spendable
again.

When at least one slot is carried, record `allowance.carried` through
`recordEventLater` with
`{ slots, subjectType: "mission", subjectId: missionId }`, and add the name to
`EVENT_NAMES` in `lib/events.ts`. It then shows on the account's activity
timeline in admin.

**Month edge:** a close that reads its rows at 23:59:59 on the 31st and commits
after midnight releases into the month that just ended, and carries nothing. The
window is the length of one RPC, so the spec accepts it. A builder who closes on
the last day gets the slots back for that day only; the policy page says so
plainly.

## §3 — Migration `20261103_01_carried_reports.sql`

**`close_mission`**: copy its current definition from `20261101_03`. Keep the
same signature and the `closed_at` line. Change one thing, in the insert loop:

```sql
v_kind := coalesce(v_row->>'kind', 'released');
-- A close may give back what was held, or carry it. It may never mint a grant
-- or an earned credit.
if v_kind not in ('released', 'carried') then
  raise exception 'close_mission: % is not a kind a close may write', v_kind;
end if;
insert into public.report_ledger (profile_id, account_id, mission_id, kind, bucket, period, slots)
values (
  p_profile_id, p_account_id, p_mission_id, v_kind,
  v_row->>'bucket', (v_row->>'period')::date, (v_row->>'slots')::int
);
```

(`declare v_kind text;`.) Restate `revoke`/`grant`. **Rollback:** re-run
`close_mission` from `20261101_03`.

**Unchanged, confirmed by diff:**

- `publish_mission` already inserts `p_rows` with the bucket it's given, and has
  no bucket check.
- `report_landed` already filters `kind in ('reserved', 'released')`.

**Backfill (only if C2 is yes):** append, never update. For each row the §0
query returns, insert one row:
`(profile_id, account_id, mission_id, 'carried', 'carried', null, slots)`.
Guard it with `not exists` on a carried row for the same `mission_id`, so the
migration is safe to re-run.

## §4 — Where it shows

- **`/admin/accounts/[id]`, Report balance**: add **Carried** between Monthly
  and Grant. Keep Total last.
- **Builder**: `AllowanceNotice` reads `total`, so it needs no change.
  `/settings` shows no pools, by rule.
- **`/pricing` FAQ, "Do unused monthly reports roll over?"** The current answer
  ("Reports from a test case you close early go back to the month they came
  from") becomes incomplete the moment this merges, so it changes **in this PR**:
  > Monthly reports you don't use expire at the end of the month. Reports you
  > did use — published on a test case — that testers didn't deliver are never
  > lost: close the test case and they come back. If their month has already
  > ended, they come back as carried reports, which don't expire. Reports you
  > earn by testing don't expire either.

  The question's text stays the same.

## §5 — The cohort and payouts

`cohortSlots()` (`lib/payouts.ts:66`) filters `held()` by `cohortEligible()`.
With carried eligible (C1), a test case published from carried slots is open to
the paid cohort, and those reports are payable. Nothing else in `payouts.ts`
changes.

## §6 — Decisions

**C1 — Decided: yes.** May the paid cohort serve carried slots, including for a builder whose
plan has since lapsed to Community?** **Recommend yes.** The builder paid for
them. Compensation Model §8's line "A Community user must never be served a
paid cohort report" protects the *free* entitlement, and these aren't free. Each
one costs ₦1,300 that the builder already paid for. If no, a lapsed builder's
carried slots can only be filled by reciprocity, which means the policy page has
to say so.

**C2 — Decided: no backfill;** §0 found nothing to backfill. Backfill the paid slots that already expired this way?** **Recommend yes
if §0's count is small.** Each row is a builder who paid and didn't receive. An
optional email from the admin broadcast can say so. If no, the policy applies
from the merge date and the page says that.

**C3 — Decided: yes.** Should deleting a live test case close it first?** **Recommend yes.**
Today `deleteMission` drops the row and the reserved slots never come back,
whatever the month. With this change it calls `closeMission(missionId, user.id)`
first when `is_active` is not false, then deletes. The delete returns unused
slots and carries them like a close. If the close throws, the delete doesn't
happen.

## §7 — Tests

**`lib/__tests__/allowance.test.ts`**

- **`carryOver`**:
  - ended-month monthly gives one carried entry with a null period;
  - two ended months sum into one entry;
  - this month's monthly gives nothing;
  - grant, earned or carried give nothing;
  - empty gives empty.
- **`balance`**: carried is counted and isn't eaten by the monthly clamp
  (Pro→Starter with 10 reserved this month and 2 carried gives monthly 0,
  carried 2, total 2).
- **`reserve`**: spend order is monthly, then carried, then grant, then earned.
  A carried reservation has a null period.
- **`release`**: carried comes back after earned and grant, before monthly.
  Running it over its own output still returns nothing.
- **`cohortEligible("carried")`** is true.
- **The worked example, end to end** in pure functions:
  - reserve 5 in October, receive 3, close on 2 November;
  - this gives released October 2 plus carried 2;
  - the November balance shows carried 2;
  - a second close produces no rows.
- The existing rank-order assertion changes to the new order. **No other
  existing assertion changes.** If one has to, stop and say why.

**`lib/__tests__/allowanceDb.test.ts`**

- `closeMission` sends `kind: "carried"` rows only when an ended month is
  released, and none on a second close.

**`lib/__tests__/carriedMigration.test.ts`** (new, in the shape of
`closedMigration.test.ts`)

- `close_mission` still contains
  `set is_active = false, closed_at = now() where id = p_mission_id`.
- The kind guard allows exactly `released` and `carried`.
- Grants are restated to `service_role` alone.

**`lib/__tests__/payouts.test.ts`**

- A test case reserving carried slots has that many cohort slots.

**`actions/__tests__/missions.test.ts`** (C3)

- `deleteMission` on a live test case calls `closeMission` before the delete.
- On a closed one it doesn't call it.
- A close that throws leaves the row undeleted.

**`components/public/__tests__/pricing.test.ts`**

- The roll-over answer mentions carried reports.

## §8 — Docs

- **`CLAUDE.md`**, at the end of the allowance paragraph:
  > **Paid reports a builder published and didn't receive are never lost.** A
  > close that releases monthly slots from an ended month carries them into
  > the `carried` pool, which never expires (`carryOver()`, `20261103_01`).
  > Monthly reports never published still expire. `close_mission` may write
  > only `released` and `carried`.
- **`lib/allowance.ts`**: rewrite the `release()` comment's last sentence so it
  no longer says the slots expire.
- **Compensation Model §8**: add one line saying carried slots are
  cohort-eligible (C1). Update both copies, `docs/` and the project's
  `claude/` copy.
- **Checklist**: a QA row for the worked example.

## Acceptance criteria

1. The worked example holds on a preview deployment with the migration applied.
   The builder sees the 2 reports back in their balance in November.
2. A second close appends nothing.
3. On `/admin/payouts`, a cohort report that fills a carried slot is payable
   (if C1 is yes).
4. Deleting a live test case returns its unused slots (if C3 is yes).
5. All four gates pass. `allowance.test.ts` changes only where this spec names
   a change.

## Commit sequence

1. `docs(spec): paid reports carry over`
2. `feat(db): close_mission may write a carried row`
3. `feat(lib): the carried pool and carryOver`
4. `feat(allowance): a close carries what an ended month would lose`
5. `fix(missions): deleting a live test case closes it first` (C3)
6. `feat(admin): carried in the report balance`
7. `feat(pricing): say what happens to undelivered reports`
8. `test(allowance): carry, spend order, the month edge`
9. `docs: record the carried pool`

## Out of scope

- Unused monthly reports a builder never published. They expire, as sold.
- Refunds in money. That's the policy (PR 3) and an admin action, not ledger
  arithmetic.
- The invitation model, and any turnaround promise.
