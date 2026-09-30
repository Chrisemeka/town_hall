# SPEC: Report Allowance

**Status:** Implemented on `feat/report-allowance` — migration not yet applied
**Branch:** `feat/report-allowance`
**Base:** `feat/tier-definitions` (PR 1) — reads `lib/plans.ts`'s numeric fields
**Depends on:** PR 1.
**Blocks:** `feat/cohort-payouts` (PR 3), `feat/shareable-report`.
**Source:** `docs/TWNHALL_ALLOWANCE_COHORT_PROMPT.md`, PR 2; numbers from
`docs/Twnhall_Cohort_Compensation_Model.md` §1, §7, §8
**Migration:** `20260930_01_report_ledger.sql` — one new table, four RPCs, two backfills
**Risk:** high — the first thing in the app that can tell a builder "no", and
the ledger is the record the cohort is paid against.

## Summary

A builder's reports become a balance. Publishing a mission reserves slots from
it; closing the mission returns what was not used. The balance is an
append-only ledger (`report_ledger`) read by one pure function
(`lib/allowance.ts`). **Enforcement happens at publish and nowhere else** — a
submission is never blocked, a tester is never blocked.

## Non-goals

- No submission-time check, no draft/claim state, no invitation model.
- No checkout, no overage billing. Refusal points at `/explore` and the contact route.
- No cohort visibility filter — PR 3. This PR records the bucket it will read.
- No usage meter in `/settings`. The balance is shown where it is spent (§7).
- No AI-insight limit (compensation doc §10: deferred until metering has data).

## Decisions taken at approval

All five open questions went with the recommendation: the active-mission
limit is enforced in `publish_mission`; the builder does not choose a tester
count; duplicate submissions get a separate fix before PR 3; earned credits are
backfilled one per distinct (tester, mission); the month is `Africa/Lagos`.

## Where the build differs from the draft

- **`planIdOf()` was not added** — `planIdFor()` in `lib/vocabulary.ts`
  already did it. `lib/allowanceDb.ts` uses that.
- **`deleteMission` does not close first.** Only an inactive mission can be
  deleted (the button renders for drafts and closed missions only), so there
  is never a held reservation to return.
- **A fourth RPC, `reports_without_credit()`,** backs the `/admin` tile. The
  anti-join is not expressible through PostgREST.
- **"Write a report" links to `/choose-account`,** not `/explore`: the person
  reading it is on their builder account, and `/explore` is tester-only.
- **`publish_mission` also answers `already`** for a mission that is live, so a
  double-click cannot reserve twice — the retry loop would otherwise re-read
  and reserve again.
- **Tests:** the RPC contract is exercised in `lib/__tests__/allowanceDb.test.ts`
  against an in-memory fake that implements compare-and-append, including two
  concurrent publishes and a concurrent double close.

## Six things the brief does not say, found in the code

These change the design. Each is resolved below; the ones marked **(decide)**
are in Open questions.

1. **`on delete cascade` on `account_id` defeats §2.7.** Deleting an account
   would delete its grant row, and the grant re-triggers — the exact case the
   brief says to prevent. It would also erase `reserved` rows, which PR 3 pays
   against. → Rows carry `profile_id` (not null, cascade — a deleted *person*
   is the fresh-email case the brief accepts) and `account_id` becomes nullable,
   `on delete set null`. Grant-once is a partial unique index on `profile_id`.
2. **The allowance crosses roles.** Credits are earned on the *tester* account
   and spent on the *builder* account. A per-account balance would strand every
   earned credit. → The balance is per profile: every row the profile owns,
   whichever account wrote it. `account_id` records which side did.
3. **Nothing stops a live mission taking more reports than it reserved.**
   `testers_needed` is display-only and `submitTestResult` does not read
   `is_active`. Without a stop, "5 slots" is a label and the cohort is paid for
   report six. → A mission **closes itself when it fills** (§6), after the
   submission is saved, never before it.
4. **Nothing stops a tester submitting twice on one mission** — no unique
   `(mission_id, tester_id)` in the migrations, no check in the action. With
   earned credits that is a farm: file junk on any live mission, repeat. →
   **One earned credit per tester per mission**, a partial unique index. The
   submission itself still lands (§2.9 of the brief). Whether to also refuse a
   duplicate *submission* is **(decide)**.
5. **Every existing account has a balance of zero at ship.** The grant fires in
   `createAccount`, which existing users have already passed. → The migration
   backfills one grant per existing profile. Backfilling earned credits for
   past reports is **(decide)**.
6. **Missions live at ship have no reservation.** → Grandfathered: they stay
   live, `testers_needed` stays null, they never self-close, and closing one
   releases nothing because nothing was reserved. The arithmetic handles this
   without a branch.

## §1 — The table

```sql
create table public.report_ledger (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  account_id  uuid references public.accounts(id) on delete set null,
  mission_id  uuid references public.missions(id) on delete set null,
  kind        text not null,   -- 'grant' | 'earned' | 'reserved' | 'released'
  bucket      text not null,   -- 'monthly' | 'grant' | 'earned'
  period      date,            -- monthly bucket only: the month the slots belong to
  slots       int  not null,   -- negative for 'reserved', positive otherwise
  created_at  timestamptz not null default now()
);
alter table public.report_ledger enable row level security;  -- no policies

create unique index report_ledger_one_grant
  on public.report_ledger (profile_id) where kind = 'grant';
create unique index report_ledger_one_credit_per_mission
  on public.report_ledger (profile_id, mission_id) where kind = 'earned';
create index report_ledger_profile on public.report_ledger (profile_id);
create index report_ledger_mission on public.report_ledger (mission_id);
```

| Decision | Reason |
|---|---|
| `profile_id` not null, cascade | Finding 1 and 2. The balance's owner. |
| `account_id` set null | Which role wrote the row; must not take the row with it. |
| `mission_id` set null | Per the brief: a deleted mission does not un-spend. |
| `bucket` not null, on every row | A grant row is bucket `grant`; an earned row, `earned`. Then every pool is one `sum` over one bucket — no kind-to-bucket mapping. |
| `period` | §3: a monthly release must return to the month it came from, and only a row can say which month that was. |
| No CHECKs on `kind`/`bucket` | House rule — vocabularies in code (`LEDGER_KINDS`, `BUCKETS` in `lib/allowance.ts`). |
| Unique indexes are the enforcement | Grant-once and credit-once are the database's job, not care. `on conflict do nothing` makes both writes idempotent. |

`comment on table` states: this is the record of what was reserved and
therefore what the cohort may be paid for; nothing here is ever updated or
deleted.

## §2 — `lib/allowance.ts`, pure and import-free

```ts
export const BUCKETS = ["monthly", "grant", "earned"] as const   // spend order
export const ALLOWANCE_TIMEZONE = "Africa/Lagos"

export function monthOf(at: Date): string                 // "2026-10-01"
export function balance(monthlyReports: number, rows: LedgerRow[], now: Date): Balance
export function reserve(b: Balance, requested: number): Reservation   // capped split
export function release(reservedByBucket: Pools, received: number): Pools
export function cohortEligible(bucket: Bucket): boolean   // monthly, grant → true
```

`balance` returns `{ monthly, grant, earned, total }`. It takes the plan's
number, not the plan, so it imports nothing.

**Timezone.** `Africa/Lagos` is UTC+1 with no DST, so `monthOf` is
`at + 1h`, truncated — no `Intl`, no library. PR 3's payout month uses the same
function, so a report and the slot it filled can never land in different months.
`// ponytail:` comment names the ceiling: if the timezone ever gains DST, this
needs `Intl.DateTimeFormat`.

## §3 — The pools

| Pool | Value in month *M* |
|---|---|
| monthly | `max(0, plan.monthlyReports + Σ slots where bucket='monthly' and period=M)` |
| grant | `Σ slots where bucket='grant'` |
| earned | `Σ slots where bucket='earned'` |

- **Monthly is derived, not stored.** No rows are written at the turn of a month.
- **Spend order monthly → grant → earned** is `BUCKETS`' order, and `reserve`
  walks it. A reservation spanning pools returns one row per pool.
- **Release is the reverse order: earned → grant → monthly.** The reports that
  did arrive are taken to have consumed the monthly pool first, so what comes
  back is the non-expiring credit. Same principle as spend order: the software
  never makes the builder's position worse than they would choose.
- **The month-boundary answer:** a `released` monthly row carries the `period`
  of the reservation it returns. A mission reserved in October and closed in
  November returns its monthly slots to October, which has ended, so they
  expire. Grant and earned have no period and come back in full.
- **Downgrade mid-month:** entitlement drops to 0, the `max(0, …)` holds the
  monthly pool at zero, and grant/earned are untouched. Nothing to write.

## §4 — Where the plan comes from

`planIdOf(planId: string | null): PlanId` in `lib/plans.ts` — null and unknown
are Community, per the `plan_id` migration. Read off the **builder** account.
`feat/shareable-report` uses this helper rather than reading `plan_id` itself.

## §5 — Publish: compare-and-append

The brief wants the arithmetic in one pure function and the check-and-reserve
atomic. Doing the split in plpgsql would be a second copy of §3's arithmetic,
and the two would drift. So TypeScript computes and the database only
**refuses a stale computation**:

```
publish_mission(p_mission_id, p_profile_id, p_account_id,
                p_seen_rows int, p_testers int, p_rows jsonb) returns text
  lock the builder's accounts row (select … for update)
  if (select count(*) from report_ledger where profile_id = p_profile_id) <> p_seen_rows
    return 'stale'
  insert p_rows as 'reserved'
  update missions set is_active = true, testers_needed = p_testers where id = p_mission_id
  return 'ok'
```

The action reads the rows, computes `reserve()`, calls the RPC, and on `stale`
re-reads and retries — three attempts, then a plain "try again". Two publishes
in the same second: both read *n* rows, one appends and makes it *n + k*, the
other gets `stale`, re-reads, and sees the balance the first one left. Rows are
only ever appended, so the count is a version number.

SECURITY DEFINER, `set search_path = public`, execute revoked from `public`,
`anon`, `authenticated`, granted to `service_role` — restated in the migration,
per `CLAUDE.md`.

**What is requested.** The builder does not choose a number (see Open
questions): a mission requests `plan.testersPerMission`, 5 on both tiers.

| Balance | Result |
|---|---|
| ≥ 5 | Live with 5 slots |
| 1–4 | **Live, capped** to the balance. The mission page says: *"You have 3 reports available, so this mission opens to 3 testers. Write a report for someone else to earn more."* |
| 0 | **Not published.** Stays a draft. *"You have no reports available. Write a report for someone else to earn one, or get in touch about Pro."* — links to `/explore` and `mailto()` from `lib/contact.ts`. |

**The publish paths — all three go through one `publishMission()` helper:**

- `createMission` with `intent=publish`: insert as a **draft**, then publish.
  At zero the draft exists and the builder lands on it with the message —
  returning an error to the form instead would make a resubmit create a
  duplicate.
- `updateMission` with `intent=publish`: reserves **only on a draft → live
  transition**. Re-saving a live mission does not reserve again.
- `toggleMissionStatus(…, true)`: reopening a closed mission is a fresh
  reservation. It now returns `{ ok } | { error }` instead of throwing, so the
  mission page can show the message.

## §6 — Close, and close-on-fill

```
close_mission(p_mission_id, p_profile_id, p_seen_rows, p_seen_received, p_rows)
  lock, compare ledger count and count(test_results for mission), else 'stale'
  insert p_rows as 'released'; update missions set is_active = false
```

Released = `release(reserved − released so far, by bucket; received)`, where
*received* is `count(test_results)` on the mission. Cumulative, so reopen-and-
close cycles need no special case.

- Fewer reports than slots → the difference comes back.
- Every slot filled → `release` returns nothing, no row written.
- **Closed twice** → the second call sees the first call's `released` rows in
  "released so far", computes zero, writes nothing. Idempotent by arithmetic,
  and the count check means a retry racing the first call gets `stale`.

**Close-on-fill** (finding 3). After `submit_audit_log` succeeds,
`submitTestResult` calls `report_landed(p_result_id)`, which in one
transaction:

1. inserts the tester's `earned` row — `on conflict do nothing` (finding 4);
2. if the mission's received count now meets its outstanding reservation,
   sets `is_active = false`. Nothing is released: it filled.

It runs **after** the submission is committed and is **non-fatal**: its failure
is logged with the tag `[allowance] missed credit` and the submission returns
success. A report arriving on a mission that has just filled or closed is
accepted, as the brief requires; it is the cost of not having claims, and the
ledger records it rather than hiding it.

**Deleting a mission** (`deleteMission`) closes it first, so an unused
reservation comes back. Admin deletion of a flagged project does not — that is
moderation, and the slots stay spent.

## §7 — The alert on a missed credit

There is no alerting system. Rather than invent one: `/admin` gets one number,
**"Reports without a credit"** — `test_results` joined against `earned` rows,
for reports after the ship date. Zero is the healthy state; anything else is a
tester to make whole, and the fix is an admin inserting the row (the unique
index makes re-running safe). The log tag is for Vercel's log search.

## §8 — The grant

`createAccount` inserts `{ kind: 'grant', bucket: 'grant', slots: 3 }`
(`SIGNUP_GRANT`) with `on conflict do nothing`, after the upsert. Once per
profile across both accounts, and a re-created account finds the row still
there. Non-fatal, same tag. The migration backfills it for every profile that
already holds an account.

## §9 — What the builder sees

- The two mission forms, beside the publish button: *"You have N reports
  available."* — the only place the balance appears, the moment it matters.
- The mission page: the capped sentence (derived from `testers_needed` <
  `testersPerMission`, not from a query param), or the zero-balance message on
  a draft.
- `/settings` Plan tab: unchanged. The `CLAUDE.md` "no usage meter" rule stays.

## §10 — What must never happen (the brief's §2.9, as tests)

- A submission at zero balance succeeds.
- A submission on a full, closed or grandfathered mission succeeds.
- `report_landed` failing leaves the submission successful.
- Nothing in the tester's path reads `report_ledger`.

## §11 — Tests

**`lib/__tests__/allowance.test.ts`** — the arithmetic
| Assertion |
|---|
| Pro with 10 monthly and 4 earned, requesting 5 → 5 from monthly, earned untouched |
| Spend spans pools: 2 monthly + 3 grant → two rows |
| Capped: balance 3, request 5 → 3; balance 0 → 0 |
| Release reverse order: reserved 3 monthly + 2 earned, received 1 → 2 earned + 2 monthly back |
| Release when full → nothing; release computed twice over its own output → nothing |
| October monthly released in November → does not raise November's balance |
| Downgrade: Pro rows, plan 0 → monthly clamps at 0 |
| `monthOf`: 2026-10-31T23:30Z is November in Lagos; 22:59Z is October |
| `cohortEligible`: monthly ✓, grant ✓, earned ✗ |

**`actions/__tests__/missions.test.ts`** — extended: publish capped, publish at
zero stays draft with the contact route, `stale` retries then succeeds, re-save
of a live mission does not reserve, close releases, double close releases once.

**`actions/__tests__/accounts.test.ts`** — grant once across two accounts;
`on conflict` path is silent.

**`actions/__tests__/submissions.test.ts`** — success at zero balance;
`report_landed` failing still returns success.

**Concurrency** is proved by the compare-and-append contract (mocked `stale`
path) plus a manual two-tab check below; the unit suite has no database.
`scripts/access.test.mts` unchanged and passing.

## §12 — Files

**New**
```
supabase/migrations/20261001_01_report_ledger.sql   table, indexes, 3 RPCs, backfill
lib/allowance.ts
lib/__tests__/allowance.test.ts
actions/__tests__/accounts.test.ts
```

**Edited**
```
lib/plans.ts                header warning → pointer to lib/allowance.ts; planIdOf()
lib/types/db.ts             ReportLedgerRow
actions/missions.ts         publishMission(), close paths
actions/accounts.ts         the grant
actions/submissions.ts      report_landed, non-fatal
components/AddMissionForm.tsx, EditMissionForm.tsx    the balance line
app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx   capped / zero lines
app/(admin)/admin/page.tsx  "Reports without a credit"
app/(public)/guides/builder/page.tsx   the testers_needed comment is now wrong
CLAUDE.md                   ledger, publish-not-submission, plan_id note
TownHall_Checklist (1).xlsx QA rows (brief's list)
```

## Acceptance criteria

1. Publishing reserves from the balance in spend order; capped at partial
   balance; refused only at zero, with `/explore` and the contact route.
2. Closing releases the unused remainder once; a mission closes itself when full.
3. Grant once per profile; earned once per tester per mission.
4. No submission is ever refused or failed by anything in this PR.
5. `report_ledger` RLS on, no policies; RPCs service-role only.
6. The four gates.

## Manual test plan

- Apply the migration; confirm RLS, no policies, the grant backfill count equals
  profiles-with-accounts.
- Community builder, fresh: publish → 3 slots, capped line. Publish again → refused.
- Test someone else's mission as that person → balance 1.
- Two tabs, one available slot, publish both → one live, one refused.
- Fill a 3-slot mission → it leaves `/explore` after the third report.
- Close a mission with 1 of 3 reports → 2 back; close again → still 2.

## Commit sequence

1. `docs(spec): report allowance`
2. `feat(db): add report_ledger and the publish/close RPCs`
3. `feat(allowance): the balance as a pure function`
4. `feat(missions): reserve at publish, release at close`
5. `feat(allowance): grant at first account, credit per report`
6. `feat(admin): count reports without a credit`
7. `test(allowance): spend order, caps, release and never-block`
8. `docs: record the ledger and publish-time enforcement`

## Open questions

1. **Active-mission limit (2 / 5).** The brief doesn't mention it, but
   `/pricing` lists it and this PR removes the "nothing enforced" warning.
   It is one `count(*)` inside the same `publish_mission` lock. **Recommend: in.**
   Otherwise the header warning has to stay, half-true.
2. **Does the builder choose a tester count?** Recommend **no** for this PR:
   request the plan's 5, cap by balance. The pricing page argues five is a
   method, not a ration, and a number input is a form change with its own
   validation. Easy to add later — `p_testers` is already a parameter.
3. **Refuse a second submission by the same tester on the same mission?**
   Finding 4. This PR only stops the credit. Refusing the submission touches
   the tester path this PR promises not to touch. **Recommend: separate fix,
   before PR 3** — PR 3 pays per report and would pay twice.
4. **Backfill earned credits for past reports?** Testers were promised "+1 for
   every report" by the old pricing page. **Recommend: yes, one per distinct
   (tester, mission)**, dated at the migration, so the promise is kept and the
   farm in finding 4 isn't grandfathered.
5. **Timezone** — `Africa/Lagos`. Confirm.
