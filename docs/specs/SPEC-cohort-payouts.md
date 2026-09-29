# SPEC: Cohort Payouts

**Status:** Approved — implementing
**Branch:** `feat/cohort-payouts`
**Base:** `main`, after `feat/report-allowance` **and** `fix/one-report-per-mission` merge
(built on `feat/report-allowance` with `fix/one-report-per-mission` merged in)
**Depends on:** both of the above — the ledger's buckets decide what is payable, and
without the one-report rule a tester could be paid twice for one mission.
**Source:** `docs/TWNHALL_ALLOWANCE_COHORT_PROMPT.md`, PR 3; rates from
`docs/Twnhall_Cohort_Compensation_Model.md` §1, §6, §8
**Migration:** `20261001_01_cohort_payouts.sql` — two columns on `accounts`, one log table, one RPC
**Risk:** medium. Nothing here moves money; it produces the sheet money is moved against.

## Summary

Marks which testers are in the paid cohort, keeps unpaid missions out of their
feed, produces a monthly payout sheet for an admin to pay from by bank
transfer, and logs every plan change an admin makes.

## Non-goals

- No payment rails, wallet, balance of money, or `paid` state. The CSV is the record.
- No automatic rating cut-off — the threshold is undecided (compensation doc §10).
- No invitation model or SLA clock (§4, deferred).
- No change to who may *submit*: the allowance rule and the one-report rule stand.

## Decisions taken at approval

All four open questions went with the recommendation: email is in the payout
CSV; the downloaded CSV is the payment record, and the page says so;
`RATING_FLAG_BELOW = 3.5`; no reciprocity ratio on the page yet.

## Five things the brief does not say, found in the code

1. **Hiding a mission is not a boundary here.** `missions` is readable by anyone
   (`using (true)`), and `components/GlobalSearch.tsx` queries it **from the
   browser**. A cohort tester can reach any mission and submit to it. So the
   feed filter (§3) is for their convenience; **the money boundary is the
   payout calculation (§4)**, which only pays cohort reports against slots the
   cohort was allowed to serve. A cohort report beyond that is an ordinary,
   unpaid reciprocity report — it still earns them +1 like anyone's — and the
   mission page tells them so before they start.
2. **Nothing sets `cohort_member_at`.** The brief adds the column but no way to
   write it. → An admin control next to the plan control (§2).
3. **Clearing the flag would rewrite past months.** If membership is a single
   nullable timestamp, removing someone erases the fact they were paid in
   March. → `cohort_member_at` plus `cohort_left_at`; a report is payable if
   it was filed between them. Re-joining is a new start, recorded in the log.
4. **Setting a plan back to Community writes `'community'`, not null.**
   `UserPlanControl` offers both `PLAN_IDS` and `setUserPlan` writes whichever
   comes. The brief and the `plan_id` migration say clearing means null. →
   `'community'` is written as null. Existing `'community'` rows are left; they
   read identically through `planIdFor()`.
5. **Mixed missions.** A mission can reserve 2 grant slots and 3 earned. The
   cohort may serve 2 of its 5 reports. → Per mission, *cohort slots* = net
   reserved slots from `monthly` and `grant` (reserved minus released, from the
   ledger — `cohortEligible()` already exists). The first N cohort reports on a
   mission, by `created_at`, are payable; any after that are not.

## §1 — Migration

```sql
alter table public.accounts
  add column cohort_member_at timestamptz,
  add column cohort_left_at   timestamptz;

create table public.admin_account_changes (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid references public.accounts(id) on delete set null,
  profile_id  uuid not null,       -- denormalised: outlives the account
  field       text not null,       -- 'plan_id' | 'cohort'
  from_value  text,
  to_value    text,
  changed_by  uuid not null,       -- the admin's profile id
  created_at  timestamptz not null default now()
);
-- RLS on, no policies.
```

`set_account_field(p_user_id, p_type, p_field, p_value, p_admin_id)` — one
plpgsql function that reads the old value, writes the new, and inserts the log
row **in one transaction**, so a change is never made without its record.
SECURITY DEFINER, pinned `search_path`, service role only. Two fields only:
`plan_id` (tester or builder — the RPC does not decide; the action does) and
`cohort` (sets `cohort_member_at = now(), cohort_left_at = null`, or
`cohort_left_at = now()`).

## §2 — Admin controls

`actions/admin/users.ts`:

- `setUserPlan` → calls the RPC; `community` is written as null (finding 4).
  Still builder-only, still `requireAdmin()`.
- **`setCohortMember(userId, on)`** → same RPC, tester account only; refuses a
  user with no tester account.

`/admin/users` gains a cohort toggle beside the plan select, same component
shape as `UserPlanControl`. A small "History" list per user reads
`admin_account_changes` — the log is only useful if someone can see it.

## §3 — The cohort feed

`lib/cohortDb.ts`: `cohortSlotsFor(missionIds)` → `Map<missionId, number>`,
from the ledger via service role (`held()` + `cohortEligible()` from
`lib/allowance.ts` — no new arithmetic). And `isCohortTester(userId)`.

For a cohort tester, the server-rendered mission lists drop missions with no
cohort slots left (cohort slots minus cohort reports already filed). Surfaces:
`/explore`, `/explore/missions`, `/explore/project/[id]`, `/tester`.
`GlobalSearch` is client-side and is **not** filtered — per finding 1 it
couldn't be made a boundary anyway, and hiding search results a tester can
reach by URL only confuses.

`/mission/[id]`, for a cohort tester on a mission with no cohort slots left,
shows one line above the form: *"This mission isn't paid for cohort testers.
You can still test it — it earns you a report, like anyone else."*

Tested at the query helper (`lib/__tests__/cohort.test.ts` over the pure part:
given ledger rows and filed reports, which missions are open to the cohort).

## §4 — The payout sheet

**Pure: `lib/payouts.ts`**, import-free.

```ts
// Compensation doc §1. A business decision that will change — change it here,
// once. Naira, whole units.
export const PAYOUT_RATES = { perReportNgn: 1_000, bonusNgn: 3_000, bonusAtReports: 10 } as const
// Compensation doc §6/§10: undecided. Display only — flags, never withholds.
export const RATING_FLAG_BELOW = 3.5

export function payableReports(reports, cohortSlotsByMission, membership): PayableReport[]
export function payoutFor(payableThisMonth: number): { base, bonus, total }
export function payoutMonth(reports, month): TesterPayout[]
```

- **Month**: `monthOf()` from `lib/allowance.ts` — **Africa/Lagos** — so a
  report and the slot it filled can never fall in different months. A report at
  23:50 WAT on the 31st is in that month; at 00:10 it is in the next. One
  function, tested at both edges.
- **Payable** = a cohort tester's report, filed while a member (between
  `cohort_member_at` and `cohort_left_at`), within its mission's cohort slots
  (finding 5). Not rating-dependent, **not approval-dependent** — paid on
  submission, per compensation doc §6.
- **Bonus** at ≥ 10 payable reports in the month: 9 → ₦9,000; 10 → ₦13,000;
  11 → ₦14,000.
- **Rolling average**: `averageRating()` from `lib/reciprocity.ts` over every
  rated report the tester has filed, to date. Below `RATING_FLAG_BELOW` → a
  text flag ("Below 3.5") in the row. Nothing else happens.

**Page: `/admin/payouts?month=2026-10`**, `requireAdmin()` + middleware (it is
under `/admin`). Per tester: name, payable reports, unpaid cohort reports (shown,
so a gap is visible), bonus yes/no, rolling average with flag, total ₦. A month
total. Month picker is prev/next links. Theme tokens only.

**CSV: `app/api/admin/payouts/route.ts`** — `requireAdmin()` itself, because
`app/api` has no middleware. Through `toCsv()` / `CSV_BOM` in `lib/csv.ts`,
so a name starting `=` is neutralised. Columns: name, email, payable reports,
bonus, total ₦, rolling average, flagged. **Email is included** — see Open
questions; the builder-export rule is about files leaving to builders, this one
stays with admins.

## §5 — Tests

| File | Assertions |
|---|---|
| `lib/__tests__/payouts.test.ts` | rate; bonus at exactly 9, 10, 11; payable capped by cohort slots, in `created_at` order; reports before joining or after leaving unpaid; a report at 23:50 and 00:10 WAT on a month edge lands in exactly one month; rating below threshold flags and changes no total |
| `lib/__tests__/cohort.test.ts` | a mission with only earned slots is closed to the cohort; a mixed mission closes to the cohort once its eligible slots are filed; Pro monthly and grant open |
| `lib/__tests__/csv.test.ts` | a tester named `=HYPERLINK(...)` exports neutralised (already covered generically; one payout-shaped case) |
| `actions/__tests__/admin-users.test.ts` | plan change goes through the RPC with the admin's id; `community` writes null; cohort toggle refuses a user with no tester account; non-admin rejected |
| `app/api` route | non-admin gets 403, no body |

## §6 — Files

**New**
```
supabase/migrations/20261001_01_cohort_payouts.sql
lib/payouts.ts, lib/cohortDb.ts
lib/__tests__/payouts.test.ts, lib/__tests__/cohort.test.ts
app/(admin)/admin/payouts/page.tsx
app/api/admin/payouts/route.ts
components/admin/CohortControl.tsx
```

**Edited**
```
actions/admin/users.ts           RPC, community → null, setCohortMember
app/(admin)/admin/users/page.tsx cohort toggle, change history
app/(tester)/explore/**, app/(tester)/tester/page.tsx, app/(tester)/mission/[id]/page.tsx
lib/types/db.ts, CLAUDE.md, TownHall_Checklist (1).xlsx
```

## Acceptance criteria

1. An admin can add and remove a cohort tester and set or clear a plan; every
   change is logged with who and when, atomically.
2. A cohort tester's feed shows no mission without cohort slots left.
3. `/admin/payouts` and its CSV agree, per Lagos month, to the naira.
4. Nothing is withheld on rating or approval.
5. The four gates.

## Commit sequence

1. `docs(spec): cohort payouts`
2. `feat(db): cohort membership and the admin change log`
3. `feat(admin): log plan changes, add the cohort toggle`
4. `feat(cohort): keep unpaid missions out of the cohort feed`
5. `feat(admin): the monthly payout sheet and its CSV`
6. `test(payouts): rates, bonus edges, month edges, slot caps`
7. `docs: record cohort supply and the payout sheet`

## Open questions

1. **Email in the payout CSV?** Admins need to match a name to a bank
   transfer, and they already see emails in `/admin/users`. **Recommend: yes.**
2. **Deleting a submission after it was paid.** `deleteSubmission` removes it,
   and a re-run of that month's sheet would then show less than was paid.
   **Recommend: the downloaded CSV is the payment record; say so on the page.**
   A payments table would be a money ledger, which is out of scope by decision.
3. **`RATING_FLAG_BELOW = 3.5`** is a placeholder so the flag has something to
   compare to. It only colours a row. Confirm or give a number.
4. **The compensation doc's §9 end condition** (reciprocity ratio above [X] for
   two months) — not in scope, but the payout page could show the month's
   ratio beside its total at no cost. **Recommend: leave for when [X] is set.**
